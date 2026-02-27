import type { Env, GeocodeResult, Itinerary, PlanRequest, Poi, Stop, TransportMode, TravelStyle } from "../src/types";
import { cacheKey, fromTime, toTime, withCache } from "../src/utils";

const DEFAULT_POI_COST: Record<string, number> = {
  museum: 18,
  park: 0,
  cafe: 9,
  restaurant: 20,
  viewpoint: 0,
  nightlife: 24,
  shopping: 26,
  attraction: 15,
  hidden_gem: 8
};

const STYLE_STOP_COUNT: Record<TravelStyle, number> = {
  Relaxed: 4,
  Balanced: 6,
  Packed: 8
};

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

async function geocodeCity(env: Env, city: string): Promise<GeocodeResult> {
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("geo", city.toLowerCase()), ttl, async () => {
    const url = `${env.NOMINATIM_BASE_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`;
    const response = await fetch(url, { headers: { "User-Agent": "WayfareAI/1.0" } });
    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json() as Array<{
      display_name: string;
      boundingbox: [string, string, string, string];
      lon: string;
      lat: string;
    }>;

    if (!data.length) throw new Error("City not found");

    const result = data[0];
    return {
      name: result.display_name,
      bbox: [
        Number(result.boundingbox[2]),
        Number(result.boundingbox[0]),
        Number(result.boundingbox[3]),
        Number(result.boundingbox[1])
      ],
      center: [Number(result.lon), Number(result.lat)]
    };
  });
}

function buildOverpassQuery(bbox: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bb = `${minLat},${minLon},${maxLat},${maxLon}`;

  return `
[out:json][timeout:25];
(
  node["tourism"~"museum|attraction|viewpoint"](${bb});
  node["amenity"~"cafe|restaurant|bar|pub"](${bb});
  node["leisure"~"park|garden"](${bb});
  way["tourism"~"museum|attraction|viewpoint"](${bb});
  way["amenity"~"cafe|restaurant|bar|pub"](${bb});
  way["leisure"~"park|garden"](${bb});
);
out center tags 300;
`;
}

function normalizeCategory(tags: Record<string, string>): string {
  if (tags.amenity === "cafe") return "cafe";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "bar" || tags.amenity === "pub") return "nightlife";
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.tourism === "museum") return "museum";
  if (tags.shop) return "shopping";
  if (tags.tourism === "viewpoint") return "viewpoint";
  return "attraction";
}

function normalizePois(elements: Array<any>): Poi[] {
  const seen = new Set<string>();
  const pois: Poi[] = [];

  for (const item of elements) {
    const lat = item.lat ?? item.center?.lat;
    const lon = item.lon ?? item.center?.lon;
    if (!lat || !lon) continue;

    const name = item.tags?.name;
    if (!name) continue;

    const id = `poi_${item.type}_${item.id}`;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    const sourceTags = item.tags as Record<string, string>;
    pois.push({
      id,
      name,
      category: normalizeCategory(sourceTags),
      lat: Number(lat),
      lon: Number(lon),
      sourceTags
    });
  }

  return pois;
}

async function fetchPois(env: Env, bbox: [number, number, number, number]): Promise<Poi[]> {
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("pois", ...bbox.map((v) => v.toFixed(3))), ttl, async () => {
    const body = buildOverpassQuery(bbox);
    const response = await fetch(env.OVERPASS_BASE_URL, {
      method: "POST",
      body
    });

    if (!response.ok) {
      throw new Error(`Overpass error: ${response.status}`);
    }

    const data = await response.json() as { elements: Array<any> };
    return normalizePois(data.elements ?? []);
  });
}

async function osrmTable(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<number[][]> {
  if (coords.length < 2) return [coords.map(() => 0)];
  const coordString = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");

  return withCache(env, cacheKey("osrm-table", mode, coordString.slice(0, 300)), ttl, async () => {
    const url = `${env.OSRM_BASE_URL}/table/v1/${mode}/${coordString}?annotations=duration`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM table failed: ${response.status}`);
    const data = await response.json() as { durations: number[][] | null };
    return (data.durations ?? []).map((row) => row.map((sec) => Number.isFinite(sec) ? Math.round(sec / 60) : 999));
  });
}

async function osrmRoute(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<[number, number][]> {
  if (coords.length < 2) return [];
  const coordString = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");

  return withCache(env, cacheKey("osrm-route", mode, coordString.slice(0, 300)), ttl, async () => {
    const url = `${env.OSRM_BASE_URL}/route/v1/${mode}/${coordString}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM route failed: ${response.status}`);
    const data = await response.json() as { routes?: Array<{ geometry: { coordinates: [number, number][] } }> };
    return data.routes?.[0]?.geometry?.coordinates ?? [];
  });
}

function preferenceMatch(poi: Poi, preferences: Record<string, boolean>) {
  if (poi.category === "park") return preferences.nature;
  if (poi.category === "museum") return preferences.museums;
  if (poi.category === "cafe") return preferences.cafes;
  if (poi.category === "restaurant") return preferences.localFood;
  if (poi.category === "nightlife") return preferences.nightlife;
  if (poi.category === "shopping") return preferences.shopping;
  return preferences.hiddenGems;
}

function forceMustSee(input: PlanRequest, pois: Poi[]): Poi[] {
  if (!input.mustSee.length) return pois;
  const lower = input.mustSee.map((m) => m.toLowerCase());

  const matched = pois.filter((p) => lower.some((must) => p.name.toLowerCase().includes(must)));
  const missing = lower.filter((must) => !matched.some((m) => m.name.toLowerCase().includes(must)));

  const synthetic = missing.map((name, idx) => ({
    id: `must_${idx}_${name.replace(/[^a-z0-9]/g, "")}`,
    name,
    category: "attraction",
    lat: pois[0]?.lat ?? 0,
    lon: pois[0]?.lon ?? 0,
    sourceTags: { synthetic: "true" }
  }));

  return [...matched, ...synthetic, ...pois.filter((p) => !matched.find((m) => m.id === p.id))];
}

function clusterByDay(pois: Poi[], days: number, center: [number, number]): Poi[][] {
  const buckets = Array.from({ length: days }, () => [] as Poi[]);
  const sorted = [...pois].sort((a, b) => haversineKm({ lat: a.lat, lon: a.lon }, { lat: center[1], lon: center[0] }) - haversineKm({ lat: b.lat, lon: b.lon }, { lat: center[1], lon: center[0] }));

  sorted.forEach((poi, idx) => {
    buckets[idx % days].push(poi);
  });

  return buckets;
}

function nearestNeighborOrder(stops: Poi[], matrix: number[][]): Poi[] {
  if (stops.length <= 2) return stops;
  const visited = new Set<number>([0]);
  const order = [0];

  while (order.length < stops.length) {
    const last = order[order.length - 1];
    let bestIdx = -1;
    let bestCost = Number.POSITIVE_INFINITY;

    for (let i = 0; i < stops.length; i += 1) {
      if (visited.has(i)) continue;
      const cost = matrix[last]?.[i] ?? 999;
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;
    visited.add(bestIdx);
    order.push(bestIdx);
  }

  return order.map((idx) => stops[idx]);
}

function insertMeals(stops: Stop[]) {
  if (stops.length < 3) return stops;
  const lunchIndex = Math.floor(stops.length / 2);
  const dinnerIndex = Math.max(stops.length - 1, lunchIndex + 1);

  stops[lunchIndex] = { ...stops[lunchIndex], notes: "Lunch break nearby" };
  stops[dinnerIndex] = { ...stops[dinnerIndex], notes: "Dinner recommendation" };
  return stops;
}

function estimateStopCost(category: string, budgetSaver: boolean) {
  const base = DEFAULT_POI_COST[category] ?? 12;
  return budgetSaver ? base * 0.78 : base;
}

function durationForStyle(style: TravelStyle, category: string) {
  const baseline = category === "museum" ? 90 : category === "restaurant" ? 75 : 60;
  if (style === "Relaxed") return baseline + 25;
  if (style === "Packed") return Math.max(35, baseline - 15);
  return baseline;
}

function buildExplanation(dayStops: Stop[], travelStyle: TravelStyle, budgetSaver: boolean) {
  const categories = Array.from(new Set(dayStops.map((s) => s.category))).join(", ");
  const saver = budgetSaver ? "Budget saver mode prioritizes lower-cost venues." : "Balanced spend across highlights and meals.";
  return `${travelStyle} pacing with ${dayStops.length} stops across ${categories}. ${saver}`;
}

export async function createItinerary(env: Env, input: PlanRequest): Promise<Itinerary> {
  const geocoded = await geocodeCity(env, input.city);
  const dayCount = input.days ?? (input.dateFrom && input.dateTo ? Math.max(1, Math.ceil((new Date(input.dateTo).getTime() - new Date(input.dateFrom).getTime()) / 86400000) + 1) : 3);

  const allPois = await fetchPois(env, geocoded.bbox);
  const filtered = allPois.filter((p) => preferenceMatch(p, input.preferences));
  const withMustSee = forceMustSee(input, filtered.length ? filtered : allPois);

  const selected = withMustSee.slice(0, Math.max(dayCount * STYLE_STOP_COUNT[input.travelStyle], dayCount * 3));
  const clustered = clusterByDay(selected, dayCount, geocoded.center);

  const dailyBudget = input.budget / dayCount;
  const dailyPlans = [];

  for (let dayIdx = 0; dayIdx < clustered.length; dayIdx += 1) {
    const candidate = clustered[dayIdx].slice(0, STYLE_STOP_COUNT[input.travelStyle]);
    if (!candidate.length) continue;

    const coords = candidate.map((p) => [p.lon, p.lat] as [number, number]);
    const matrix = await osrmTable(env, coords, input.transportMode);
    const ordered = nearestNeighborOrder(candidate, matrix);

    const startMinutes = fromTime(input.dailyStartTime);
    let cursor = startMinutes;

    let dayCost = 0;
    const mapped: Stop[] = ordered.map((poi, idx) => {
      const travelMinutes = idx === 0 ? 0 : (matrix[idx - 1]?.[idx] ?? Math.round(haversineKm({ lat: ordered[idx - 1].lat, lon: ordered[idx - 1].lon }, { lat: poi.lat, lon: poi.lon }) * 10));
      cursor += travelMinutes;
      const durationMinutes = durationForStyle(input.travelStyle, poi.category);
      const estimatedCost = estimateStopCost(poi.category, input.budgetSaver);
      const stop: Stop = {
        id: `stop_${dayIdx + 1}_${idx + 1}`,
        name: poi.name,
        category: poi.category,
        lat: poi.lat,
        lon: poi.lon,
        startTime: toTime(cursor),
        durationMinutes,
        travelMinutesFromPrev: travelMinutes,
        estimatedCost
      };
      cursor += durationMinutes;
      dayCost += estimatedCost;
      return stop;
    });

    const withMeals = insertMeals(mapped);
    const routeGeometry = await osrmRoute(env, ordered.map((p) => [p.lon, p.lat]), input.transportMode);

    dailyPlans.push({
      dayNumber: dayIdx + 1,
      date: input.dateFrom ? new Date(new Date(input.dateFrom).getTime() + dayIdx * 86400000).toISOString().slice(0, 10) : `Day ${dayIdx + 1}`,
      routeGeometry,
      stops: withMeals,
      dayCost: Math.min(dayCost, dailyBudget * 1.35),
      explanation: buildExplanation(withMeals, input.travelStyle, input.budgetSaver)
    });
  }

  const totalEstimatedCost = dailyPlans.reduce((acc, d) => acc + d.dayCost, 0);

  return {
    city: input.city,
    bbox: geocoded.bbox,
    center: geocoded.center,
    currency: input.currency,
    totalEstimatedCost,
    days: dailyPlans,
    preferences: input.preferences,
    generatedAt: new Date().toISOString()
  };
}

export async function fetchNearbyPois(env: Env, stop: Stop, radiusMeters: number, category?: string): Promise<Poi[]> {
  const delta = radiusMeters / 111320;
  const bbox: [number, number, number, number] = [
    stop.lon - delta,
    stop.lat - delta,
    stop.lon + delta,
    stop.lat + delta
  ];

  const pois = await fetchPois(env, bbox);
  return pois.filter((poi) => {
    if (category && !poi.category.includes(category.toLowerCase())) return false;
    return haversineKm({ lat: stop.lat, lon: stop.lon }, { lat: poi.lat, lon: poi.lon }) <= radiusMeters / 1000;
  });
}

export function applyBudgetAdjustment(itinerary: Itinerary, newBudget: number): Itinerary {
  const factor = newBudget / Math.max(1, itinerary.totalEstimatedCost);
  const days = itinerary.days.map((day) => {
    const stops = day.stops.map((stop) => ({ ...stop, estimatedCost: Math.max(0, Number((stop.estimatedCost * factor).toFixed(2))) }));
    const dayCost = stops.reduce((acc, s) => acc + s.estimatedCost, 0);
    return { ...day, stops, dayCost };
  });

  return {
    ...itinerary,
    totalEstimatedCost: days.reduce((acc, day) => acc + day.dayCost, 0),
    days
  };
}

export function applyPaceChange(itinerary: Itinerary, mode: TravelStyle): Itinerary {
  const maxStops = STYLE_STOP_COUNT[mode];
  const days = itinerary.days.map((day) => ({
    ...day,
    stops: mode === "Packed" ? day.stops : day.stops.slice(0, maxStops),
    explanation: `${mode} pace applied. ${day.explanation}`
  }));

  return {
    ...itinerary,
    days
  };
}

