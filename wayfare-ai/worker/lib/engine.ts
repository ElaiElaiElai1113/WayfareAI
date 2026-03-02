import type { Env, GeocodeResult, Itinerary, PlanRequest, Poi, Stop, TransportMode, TravelStyle } from "../src/types";
import { cacheKey, fromTime, toTime, withCache } from "../src/utils";

type ScoredPoi = Poi & { score: number; cuisine?: string; distanceKm?: number; kind?: "indoor" | "outdoor" };
type EnergyLevel = "Light" | "Moderate" | "High";

const CHAIN_NAMES = ["jollibee","mcdonald's","mcdonalds","kfc","chowking","greenwich","mang inasal","gerry's grill","gerrys grill","shakey's","shakeys","pizza hut"];
const LUNCH_WINDOW: [number, number] = [690, 840];
const DINNER_WINDOW: [number, number] = [1080, 1200];
const ENERGY_LIMIT: Record<TravelStyle, number> = { Relaxed: 4, Balanced: 6, Packed: 8 };
const DEFAULT_POI_COST: Record<string, number> = { museum: 16, park: 0, cafe: 8, restaurant: 18, viewpoint: 0, attraction: 12, shopping: 15, nightlife: 20 };
const TEMPLATE: Record<TravelStyle, { attractionsMin: number; attractionsMax: number; cafe: boolean }> = {
  Relaxed: { attractionsMin: 2, attractionsMax: 2, cafe: true },
  Balanced: { attractionsMin: 3, attractionsMax: 3, cafe: true },
  Packed: { attractionsMin: 4, attractionsMax: 5, cafe: true }
};
const PREFERENCE_CATEGORY_MAP: Record<string, string[]> = {
  nature: ["park", "viewpoint", "attraction"],
  museums: ["museum"],
  cafes: ["cafe", "restaurant"],
  localFood: ["restaurant", "cafe"],
  nightlife: ["nightlife"],
  shopping: ["shopping"],
  hiddenGems: ["attraction", "viewpoint", "park"]
};

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sa = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

function normalizeCategory(tags: Record<string, string>) {
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.amenity === "cafe") return "cafe";
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.tourism === "museum") return "museum";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.shop) return "shopping";
  if (tags.amenity === "bar" || tags.amenity === "pub") return "nightlife";
  return "attraction";
}

function normalizePois(elements: Array<any>, forceCategory?: string): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const item of elements) {
    const lat = item.lat ?? item.center?.lat;
    const lon = item.lon ?? item.center?.lon;
    const name = item.tags?.name;
    if (!lat || !lon || !name) continue;
    const key = `${String(name).toLowerCase()}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: `poi_${item.type}_${item.id}`, name, category: forceCategory ?? normalizeCategory((item.tags ?? {}) as Record<string, string>), lat: Number(lat), lon: Number(lon), sourceTags: (item.tags ?? {}) as Record<string, string> });
  }
  return out;
}

function preferenceMatch(p: Poi, prefs: Record<string, boolean>): boolean {
  const active = Object.entries(prefs).filter(([, v]) => v).map(([k]) => k);
  if (!active.length) return true;
  return active.some((k) => (PREFERENCE_CATEGORY_MAP[k] ?? []).includes(p.category));
}

async function fetchOverpassPois(env: Env, key: string, query: string, forceCategory?: string): Promise<Poi[]> {
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, key, ttl, async () => {
    const response = await fetch(env.OVERPASS_BASE_URL, { method: "POST", body: query });
    if (!response.ok) throw new Error(`Overpass error: ${response.status}`);
    const data = (await response.json()) as { elements?: Array<any> };
    return normalizePois(data.elements ?? [], forceCategory);
  });
}

async function geocodeCity(env: Env, city: string): Promise<GeocodeResult> {
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("geo", city.toLowerCase()), ttl, async () => {
    const response = await fetch(`${env.NOMINATIM_BASE_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`, { headers: { "User-Agent": "WayfareAI/1.0" } });
    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
    const data = (await response.json()) as Array<{ display_name: string; boundingbox: [string, string, string, string]; lon: string; lat: string }>;
    if (!data.length) throw new Error("City not found");
    const top = data[0];
    return { name: top.display_name, bbox: [Number(top.boundingbox[2]), Number(top.boundingbox[0]), Number(top.boundingbox[3]), Number(top.boundingbox[1])], center: [Number(top.lon), Number(top.lat)] };
  });
}

function attractionQuery(bbox: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bb = `${minLat},${minLon},${maxLat},${maxLon}`;
  return `\n[out:json][timeout:25];\n(\n  node["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](${bb});\n  node["historic"](${bb});\n  node["leisure"~"park|garden|nature_reserve"](${bb});\n  way["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](${bb});\n  way["historic"](${bb});\n  way["leisure"~"park|garden|nature_reserve"](${bb});\n);\nout center tags 400;\n`;
}

function foodQuery(center: [number, number], radius: number, amenity: "restaurant" | "cafe") {
  const [lon, lat] = center;
  return `\n[out:json][timeout:20];\n(\n  node(around:${radius},${lat},${lon})["amenity"="${amenity}"];\n  way(around:${radius},${lat},${lon})["amenity"="${amenity}"];\n);\nout center tags 200;\n`;
}

function isChain(name: string, tags: Record<string, string>) {
  const mix = `${name} ${tags.brand || ""} ${tags.operator || ""}`.toLowerCase();
  return Boolean(tags.brand || tags.operator || CHAIN_NAMES.some((c) => mix.includes(c)));
}

function cuisineOf(tags: Record<string, string>) { return (tags.cuisine || "").toLowerCase().split(/[;,]/).map((x) => x.trim()).filter(Boolean)[0] || "generic"; }
function isLocalCuisine(tags: Record<string, string>) { return (tags.cuisine || "").toLowerCase().includes("filipino") || (tags.cuisine || "").toLowerCase().includes("local"); }
function kindFor(category: string): "indoor" | "outdoor" { return ["museum", "shopping", "cafe", "restaurant"].includes(category) ? "indoor" : "outdoor"; }

function attractionScore(p: Poi) {
  const t = p.sourceTags;
  let s = 0;
  if (t.wikipedia || t.wikidata) s += 3;
  if (t.website) s += 2;
  if (t.opening_hours) s += 1;
  if (t.tourism) s += 1;
  if (Object.keys(t).length < 3) s -= 2;
  return s;
}

function restaurantScore(p: Poi, center: [number, number]) {
  const d = haversineKm({ lat: p.lat, lon: p.lon }, { lat: center[1], lon: center[0] });
  let s = 0;
  if (isLocalCuisine(p.sourceTags)) s += 3;
  if (!p.sourceTags.brand && !p.sourceTags.operator) s += 2;
  if (p.sourceTags.website) s += 1;
  if (Object.keys(p.sourceTags).length >= 5) s += 1;
  if (isChain(p.name, p.sourceTags)) s -= 3;
  if (d > 1.5) s -= 2;
  if (d >= 0.8 && d <= 1.5) s += 1;
  return { score: s, distanceKm: d };
}

function cafeScore(p: Poi, center: [number, number]) {
  const d = haversineKm({ lat: p.lat, lon: p.lon }, { lat: center[1], lon: center[0] });
  let s = 0;
  if (!p.sourceTags.brand && !p.sourceTags.operator) s += 2;
  if (p.sourceTags.website) s += 1;
  if (Object.keys(p.sourceTags).length >= 5) s += 1;
  if (d > 1.5) s -= 2;
  return { score: s, distanceKm: d };
}

function clampWindow(mins: number, w: [number, number]) { if (mins < w[0]) return w[0]; if (mins > w[1]) return w[1]; return mins; }
function energyLevel(score: number): EnergyLevel { if (score <= 3) return "Light"; if (score <= 6) return "Moderate"; return "High"; }

export function calculateEnergy(stops: Stop[]) {
  let score = 0, walking = 0, travel = 0;
  for (let i = 0; i < stops.length; i += 1) {
    const c = stops[i].category;
    if (c === "museum" || c === "attraction") score += 2;
    if (c === "park" || c === "viewpoint") score += 1;
    if (i > 0) {
      walking += haversineKm({ lat: stops[i - 1].lat, lon: stops[i - 1].lon }, { lat: stops[i].lat, lon: stops[i].lon });
      travel += stops[i].travelMinutesFromPrev;
    }
  }
  if (walking > 5) score += 2;
  if (travel > 90) score += 1;
  return { energyScore: score, energyLevel: energyLevel(score), walkingKm: Number(walking.toFixed(2)), travelTimeMinutes: travel };
}

function timeBucket(mins: number): "morning" | "midday" | "afternoon" | "evening" {
  if (mins < 690) return "morning";
  if (mins < 870) return "midday";
  if (mins < 1050) return "afternoon";
  return "evening";
}

export function applyTimeOfDayWeights(
  attractions: ScoredPoi[],
  startMinutes: number,
  weekend: boolean,
  nightlifePref: boolean,
  style: TravelStyle
): ScoredPoi[] {
  let cursor = startMinutes;
  return attractions.map((p) => {
    let s = p.score;
    const b = timeBucket(cursor);
    if (b === "morning" && p.kind === "outdoor") s += 2;
    if (b === "midday" && p.kind === "indoor") s += 2;
    if (b === "afternoon" && (p.category === "park" || p.category === "viewpoint")) s += 2;
    if (b === "evening" && nightlifePref && p.category === "nightlife") s += 2;
    if (weekend && b === "midday" && p.category === "museum") s -= 2;
    cursor += stopDuration(style, p.category);
    return { ...p, score: s };
  }).sort((a, b) => b.score - a.score);
}

export function enforceDiversity(candidates: ScoredPoi[], memory: string[]): ScoredPoi[] {
  const out: ScoredPoi[] = [];
  const m = [...memory];
  for (const c of candidates) {
    const last = m.slice(-2);
    if (last.length === 2 && last[0] === c.category && last[1] === c.category) continue;
    out.push(c);
    m.push(c.category);
    if (m.length > 5) m.shift();
  }
  return out;
}
export function weekendAdjustments(attractions: ScoredPoi[], dateIso: string): ScoredPoi[] {
  const day = new Date(dateIso).getDay();
  if (day !== 0 && day !== 6) return attractions;
  return attractions.map((a) => ({ ...a, score: a.score + ((a.category === "park" || a.category === "viewpoint") ? 1 : 0) - (a.category === "museum" ? 1 : 0) })).sort((a, b) => b.score - a.score);
}

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function approxSunset(lat: number, dateIso: string) {
  const d = new Date(dateIso);
  const n = dayOfYear(d);
  const decl = (-23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10)) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const h = Math.acos(Math.max(-0.99, Math.min(0.99, -Math.tan(phi) * Math.tan(decl))));
  const dayLen = (2 * h * 24) / (2 * Math.PI);
  return Math.max(1035, Math.min(1185, Math.round((12 + dayLen / 2) * 60)));
}

export function placeSunsetStop(stops: Stop[], dateIso: string): { stops: Stop[]; sunsetPlacement: boolean } {
  const scenic = stops.findIndex((s) => s.category === "viewpoint" || s.category === "park");
  if (scenic < 0) return { stops, sunsetPlacement: false };
  const sunset = approxSunset(stops[scenic].lat, dateIso);
  const target = stops.findIndex((s) => fromTime(s.startTime) >= sunset - 30);
  if (target < 0 || target === scenic) return { stops, sunsetPlacement: true };
  const next = [...stops];
  const item = next.splice(scenic, 1)[0];
  next.splice(Math.max(0, Math.min(next.length - 1, target)), 0, item);
  return { stops: next, sunsetPlacement: true };
}

function stopDuration(style: TravelStyle, category: string) {
  if (category === "restaurant") return 70;
  if (category === "cafe") return 40;
  if (category === "museum") return style === "Packed" ? 60 : 85;
  if (category === "viewpoint" || category === "park") return style === "Relaxed" ? 70 : 50;
  return style === "Packed" ? 55 : style === "Relaxed" ? 85 : 70;
}

function estimateStopCost(category: string, budgetSaver: boolean) {
  const base = DEFAULT_POI_COST[category] ?? 10;
  return budgetSaver ? Math.max(0, base * 0.8) : base;
}

function buildAddress(tags: Record<string, string>) {
  const line1 = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
  const line2 = [tags["addr:suburb"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"], tags["addr:state"], tags["addr:country"]]
    .filter(Boolean)
    .join(", ")
    .trim();
  const address = [line1, line2].filter(Boolean).join(", ");
  return address || undefined;
}

function centroid(points: Array<{ lat: number; lon: number }>): [number, number] {
  const s = points.reduce((a, p) => ({ lat: a.lat + p.lat, lon: a.lon + p.lon }), { lat: 0, lon: 0 });
  return [s.lon / points.length, s.lat / points.length];
}

function clusterAttractionsByDay(attractions: ScoredPoi[], dayCount: number): ScoredPoi[][] {
  const sorted = [...attractions].sort((a, b) => b.score - a.score);
  const seeds = sorted.slice(0, Math.min(dayCount, sorted.length)).map((p) => [p.lon, p.lat] as [number, number]);
  const out: ScoredPoi[][] = Array.from({ length: dayCount }, () => []);
  for (const poi of sorted) {
    let best = 0, bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < seeds.length; i += 1) {
      const d = haversineKm({ lat: poi.lat, lon: poi.lon }, { lat: seeds[i][1], lon: seeds[i][0] }) + out[i].length * 0.08;
      if (d < bestD) { best = i; bestD = d; }
    }
    out[best].push(poi);
    seeds[best] = centroid(out[best]);
  }
  return out.map((c) => c.sort((a, b) => b.score - a.score));
}

function selectRestaurant(cands: ScoredPoi[], near: [number, number], usedNames: Set<string>, disallowCuisine?: string, cuisineMemory?: string[]) {
  return [...cands].filter((c) => !usedNames.has(c.name.toLowerCase())).filter((c) => !disallowCuisine || c.cuisine !== disallowCuisine).sort((a, b) => {
    const da = haversineKm({ lat: a.lat, lon: a.lon }, { lat: near[1], lon: near[0] });
    const db = haversineKm({ lat: b.lat, lon: b.lon }, { lat: near[1], lon: near[0] });
    let delta = (b.score - a.score) + (da - db) * 0.25;
    if (cuisineMemory?.includes(a.cuisine || "")) delta -= 1;
    if (cuisineMemory?.includes(b.cuisine || "")) delta += 1;
    return delta;
  })[0];
}

function updateTimes(stops: Stop[], startMinutes: number, mode: TransportMode = "walking"): Stop[] {
  let cursor = startMinutes;
  let food = 0;
  const minutesPerKm = mode === "driving" ? 3 : 12;
  return stops.map((s, i) => {
    const t = i === 0 ? 0 : Math.max(5, Math.round(haversineKm({ lat: stops[i - 1].lat, lon: stops[i - 1].lon }, { lat: s.lat, lon: s.lon }) * minutesPerKm));
    cursor += t;
    if (s.category === "restaurant") { food += 1; cursor = clampWindow(cursor, food === 1 ? LUNCH_WINDOW : DINNER_WINDOW); }
    const startTime = toTime(cursor);
    cursor += s.durationMinutes;
    return { ...s, startTime, travelMinutesFromPrev: t };
  });
}

async function osrmTable(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<number[][]> {
  if (coords.length < 2) return [coords.map(() => 0)];
  const q = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  return withCache(env, cacheKey("osrm-table", mode, q.slice(0, 320)), Number(env.CACHE_TTL_SECONDS || "21600"), async () => {
    const r = await fetch(`${env.OSRM_BASE_URL}/table/v1/${mode}/${q}?annotations=duration`);
    if (!r.ok) throw new Error(`OSRM table failed: ${r.status}`);
    const d = (await r.json()) as { durations: number[][] | null };
    return (d.durations ?? []).map((row) => row.map((sec) => (Number.isFinite(sec) ? Math.round(sec / 60) : 999)));
  });
}

async function osrmRoute(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<[number, number][]> {
  if (coords.length < 2) return [];
  const q = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  return withCache(env, cacheKey("osrm-route", mode, q.slice(0, 320)), Number(env.CACHE_TTL_SECONDS || "21600"), async () => {
    const r = await fetch(`${env.OSRM_BASE_URL}/route/v1/${mode}/${q}?overview=full&geometries=geojson`);
    if (!r.ok) throw new Error(`OSRM route failed: ${r.status}`);
    const d = (await r.json()) as { routes?: Array<{ geometry: { coordinates: [number, number][] } }> };
    return d.routes?.[0]?.geometry?.coordinates ?? [];
  });
}

function dayExplanation(cluster: [number, number], style: TravelStyle, energy: EnergyLevel, sunset: boolean, budgetAligned: boolean, weekend: boolean) {
  const a = weekend ? "Weekend crowd sensitivity was applied with earlier major attractions." : "Transit was minimized via cluster-first planning.";
  const b = sunset ? " A scenic stop is placed near sunset." : "";
  const c = budgetAligned ? " Budget stays aligned." : " Budget is slightly stretched for quality choices.";
  return `Day focuses on ${cluster[1].toFixed(3)}, ${cluster[0].toFixed(3)}. ${a} Energy is ${energy}, aligned with ${style} pace.${b}${c}`;
}

function diversityScore(days: Itinerary["days"]) {
  const cats = days.flatMap((d) => d.stops.map((s) => s.category));
  const uniq = new Set(cats);
  if (!cats.length) return 0;
  return Number((Math.min(1, uniq.size / Math.max(1, cats.length / 2)) * 100).toFixed(1));
}

function deriveDate(input: PlanRequest, idx: number) {
  return input.dateFrom ? new Date(new Date(input.dateFrom).getTime() + idx * 86400000).toISOString().slice(0, 10) : new Date(Date.now() + idx * 86400000).toISOString().slice(0, 10);
}

export function balanceLongTrip(days: Itinerary["days"], style: TravelStyle): Itinerary["days"] {
  if (days.length < 4) return days;
  const next = [...days];
  if (!next.some((d) => d.energyLevel === "Light")) {
    const i = next.findIndex((d) => (d.energyScore || 0) === Math.max(...next.map((x) => x.energyScore || 0)));
    if (i >= 0) {
      const j = next[i].stops.findLastIndex((s) => s.category !== "restaurant");
      if (j > 1) {
        next[i].stops.splice(j, 1);
        const e = calculateEnergy(next[i].stops);
        next[i].energyScore = e.energyScore;
        next[i].energyLevel = e.energyLevel;
      }
    }
  }
  if (!next.some((d) => d.title?.includes("Signature")) && next.length) next[0].title = `${next[0].title} - Signature`;
  return next;
}
export async function createItinerary(env: Env, input: PlanRequest): Promise<Itinerary> {
  const geocoded = await geocodeCity(env, input.city);
  const dayCount = input.days ?? (input.dateFrom && input.dateTo ? Math.max(1, Math.ceil((new Date(input.dateTo).getTime() - new Date(input.dateFrom).getTime()) / 86400000) + 1) : 3);

  const attractionsRaw = await fetchOverpassPois(env, cacheKey("attractions", ...geocoded.bbox.map((x) => x.toFixed(3))), attractionQuery(geocoded.bbox));
  const base: ScoredPoi[] = attractionsRaw
    .filter((p) => p.category !== "restaurant" && p.category !== "cafe")
    .filter((p) => preferenceMatch(p, input.preferences))
    .map((p) => ({ ...p, score: attractionScore(p), kind: kindFor(p.category) }))
    .sort((a, b) => b.score - a.score);

  const seeded = [...base];
  for (const must of input.mustSee.map((m) => m.toLowerCase())) {
    if (!seeded.some((p) => p.name.toLowerCase().includes(must))) {
      seeded.unshift({ id: `must_${must.replace(/[^a-z0-9]/g, "")}`, name: must, category: "attraction", lat: geocoded.center[1], lon: geocoded.center[0], sourceTags: { synthetic: "true" }, score: 6, kind: "outdoor" });
    }
  }

  const clusters = clusterAttractionsByDay(seeded, dayCount);
  const usedRestaurantNames = new Set<string>();
  const cuisineMemory: string[] = [];
  const diversityMemory: string[] = [];
  const clusterMemory = new Set<string>();
  const days: Itinerary["days"] = [];
  const skipCounts: Record<string, number> = {
    emptyCluster: 0,
    insufficientAttractions: 0,
    duplicateCluster: 0,
    insufficientRestaurants: 0,
    mealSelectionFailed: 0,
    compositionFailed: 0
  };

  for (let dayIdx = 0; dayIdx < dayCount; dayIdx += 1) {
    const cluster = clusters[dayIdx] ?? [];
    if (!cluster.length) {
      skipCounts.emptyCluster += 1;
      continue;
    }

    const date = deriveDate(input, dayIdx);
    const weekend = [0, 6].includes(new Date(date).getDay());
    const t = TEMPLATE[input.travelStyle];

    let attractions = weekendAdjustments(cluster.slice(0, 20), date);
    attractions = applyTimeOfDayWeights(attractions, fromTime(input.dailyStartTime), weekend, Boolean(input.preferences.nightlife), input.travelStyle);
    if (input.rainPlan) {
      attractions = attractions
        .map((p) => ({ ...p, score: p.score + (p.kind === "indoor" ? 3 : (p.category === "park" || p.category === "viewpoint") ? -2 : 0) }))
        .sort((a, b) => b.score - a.score);
    }
    attractions = enforceDiversity(attractions, diversityMemory).slice(0, t.attractionsMax);
    if (attractions.length < t.attractionsMin) {
      skipCounts.insufficientAttractions += 1;
      continue;
    }

    const center = centroid(attractions);
    const clusterKey = `${center[0].toFixed(2)}_${center[1].toFixed(2)}`;
    if (dayCount >= 4 && clusterMemory.has(clusterKey)) {
      skipCounts.duplicateCluster += 1;
      continue;
    }
    clusterMemory.add(clusterKey);

    const restaurants1500 = (await fetchOverpassPois(env, cacheKey("restaurants", center[0].toFixed(4), center[1].toFixed(4), 1500), foodQuery(center, 1500, "restaurant"), "restaurant"))
      .map((p) => {
        const rs = restaurantScore(p, center);
        return { ...p, score: rs.score, distanceKm: rs.distanceKm, cuisine: cuisineOf(p.sourceTags), kind: kindFor(p.category) } as ScoredPoi;
      })
      .filter((p) => (p.distanceKm ?? 99) <= 1.5)
      .filter((p) => !isChain(p.name, p.sourceTags))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const restaurants3000 = restaurants1500.length >= 2
      ? restaurants1500
      : (await fetchOverpassPois(env, cacheKey("restaurants", center[0].toFixed(4), center[1].toFixed(4), 3000), foodQuery(center, 3000, "restaurant"), "restaurant"))
        .map((p) => {
          const rs = restaurantScore(p, center);
          return { ...p, score: rs.score, distanceKm: rs.distanceKm, cuisine: cuisineOf(p.sourceTags), kind: kindFor(p.category) } as ScoredPoi;
        })
        .filter((p) => (p.distanceKm ?? 99) <= 3)
        .filter((p) => !isChain(p.name, p.sourceTags))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    const requiredRestaurantCount = input.travelStyle === "Relaxed" ? 1 : 2;
    const restaurants = restaurants3000;
    if (restaurants.length < requiredRestaurantCount) {
      skipCounts.insufficientRestaurants += 1;
      continue;
    }

    const lunch = selectRestaurant(restaurants, [attractions[0].lon, attractions[0].lat], usedRestaurantNames, undefined, cuisineMemory);
    if (!lunch) {
      skipCounts.mealSelectionFailed += 1;
      continue;
    }
    usedRestaurantNames.add(lunch.name.toLowerCase());

    let dinner = selectRestaurant(restaurants, [attractions[attractions.length - 1].lon, attractions[attractions.length - 1].lat], usedRestaurantNames, lunch.cuisine, cuisineMemory)
      ?? selectRestaurant(restaurants, [attractions[attractions.length - 1].lon, attractions[attractions.length - 1].lat], usedRestaurantNames, undefined, cuisineMemory);
    if (!dinner && requiredRestaurantCount >= 2) {
      skipCounts.mealSelectionFailed += 1;
      continue;
    }
    if (dinner) usedRestaurantNames.add(dinner.name.toLowerCase());
    if (lunch.cuisine) cuisineMemory.push(lunch.cuisine);
    if (dinner?.cuisine) cuisineMemory.push(dinner.cuisine);
    while (cuisineMemory.length > 5) cuisineMemory.shift();

    let cafe: ScoredPoi | undefined;
    if (t.cafe && input.preferences.cafes) {
      cafe = (await fetchOverpassPois(env, cacheKey("cafes", center[0].toFixed(4), center[1].toFixed(4), 1500), foodQuery(center, 1500, "cafe"), "cafe"))
        .map((p) => {
          const cs = cafeScore(p, center);
          return { ...p, score: cs.score, distanceKm: cs.distanceKm, kind: kindFor(p.category) } as ScoredPoi;
        })
        .filter((p) => (p.distanceKm ?? 99) <= 1.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)[0];
    }

    const seq: Poi[] = [];
    attractions.forEach((a, i) => {
      if (i === 2) seq.push({ ...lunch, category: "restaurant" });
      seq.push(a);
    });
    if (!seq.some((s) => s.category === "restaurant")) seq.splice(Math.min(2, seq.length), 0, { ...lunch, category: "restaurant" });
    if (cafe) seq.splice(Math.min(4, seq.length), 0, { ...cafe, category: "cafe" });
    if (dinner) {
      seq.push({ ...dinner, category: "restaurant" });
    }

    const cleaned: Poi[] = [];
    for (const p of seq) {
      const a = cleaned[cleaned.length - 1];
      const b = cleaned[cleaned.length - 2];
      if (a && a.category === "restaurant" && p.category === "restaurant") continue;
      if (a && b && a.category === p.category && b.category === p.category) continue;
      cleaned.push(p);
    }

    const coords = cleaned.map((p) => [p.lon, p.lat] as [number, number]);
    const matrix = await osrmTable(env, coords, input.transportMode);
    const routeGeometry = await osrmRoute(env, coords, input.transportMode);

    let cursor = fromTime(input.dailyStartTime);
    let food = 0;
    let stops: Stop[] = cleaned.map((p, i) => {
      const fallbackTravel = input.transportMode === "driving" ? 3 : 12;
      const travel = i === 0 ? 0 : matrix[i - 1]?.[i] ?? Math.round(haversineKm({ lat: cleaned[i - 1].lat, lon: cleaned[i - 1].lon }, { lat: p.lat, lon: p.lon }) * fallbackTravel);
      cursor += travel;
      if (p.category === "restaurant") { food += 1; cursor = clampWindow(cursor, food === 1 ? LUNCH_WINDOW : DINNER_WINDOW); }
      const startTime = toTime(cursor);
      const durationMinutes = stopDuration(input.travelStyle, p.category);
      const tags = p.sourceTags ?? {};
      cursor += durationMinutes;
      return {
        id: `stop_${dayIdx + 1}_${i + 1}`,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lon: p.lon,
        startTime,
        durationMinutes,
        travelMinutesFromPrev: travel,
        estimatedCost: estimateStopCost(p.category, input.budgetSaver),
        tags,
        address: buildAddress(tags),
        website: tags.website,
        opening_hours: tags.opening_hours,
        cuisine: tags.cuisine,
        wikipedia: tags.wikipedia,
        wikidata: tags.wikidata
      };
    });

    if (stops.filter((s) => s.category === "restaurant").length < requiredRestaurantCount || stops.filter((s) => s.category === "cafe").length > 1) {
      skipCounts.compositionFailed += 1;
      continue;
    }

    const sunset = placeSunsetStop(stops, date);
    stops = updateTimes(sunset.stops, fromTime(input.dailyStartTime), input.transportMode);

    let energy = calculateEnergy(stops);
    if (energy.energyScore > ENERGY_LIMIT[input.travelStyle]) {
      const drop = stops.findLastIndex((s) => s.category !== "restaurant" && s.category !== "cafe");
      if (drop > 1) stops = stops.filter((_, i) => i !== drop);
      energy = calculateEnergy(stops);
    }

    stops.forEach((s) => { diversityMemory.push(s.category); if (diversityMemory.length > 5) diversityMemory.shift(); });

    const dayCost = stops.reduce((a, s) => a + s.estimatedCost, 0);
    days.push({
      dayNumber: dayIdx + 1,
      date,
      title: `Day ${dayIdx + 1}: ${attractions[0]?.name || "Highlights"}`,
      routeGeometry,
      stops,
      dayCost,
      totalCost: dayCost,
      energyScore: energy.energyScore,
      energyLevel: energy.energyLevel,
      explanation: dayExplanation(center, input.travelStyle, energy.energyLevel, sunset.sunsetPlacement, dayCost <= input.budget / dayCount * 1.2, weekend)
    });
  }

  const balanced = balanceLongTrip(days, input.travelStyle);
  const totalEstimatedCost = balanced.reduce((a, d) => a + d.dayCost, 0);
  const e = balanced.map((d) => calculateEnergy(d.stops));
  return {
    city: input.city,
    bbox: geocoded.bbox,
    center: geocoded.center,
    currency: input.currency,
    totalEstimatedCost,
    days: balanced,
    tripSummary: {
      totalEstimatedCost,
      totalWalkingDistance: Number(e.reduce((a, x) => a + x.walkingKm, 0).toFixed(2)),
      travelTimeTotal: e.reduce((a, x) => a + x.travelTimeMinutes, 0),
      diversityScore: diversityScore(balanced)
    },
    preferences: input.preferences,
    generationDiagnostics: {
      requestedDays: dayCount,
      generatedDays: balanced.length,
      skippedDays: Math.max(0, dayCount - balanced.length),
      skipCounts
    },
    generatedAt: new Date().toISOString()
  };
}

export async function fetchNearbyPois(env: Env, stop: Stop, radiusMeters: number, category?: string): Promise<Poi[]> {
  const q = `\n[out:json][timeout:20];\n(\n  node(around:${radiusMeters},${stop.lat},${stop.lon})["tourism"];\n  node(around:${radiusMeters},${stop.lat},${stop.lon})["amenity"~"restaurant|cafe"];\n  node(around:${radiusMeters},${stop.lat},${stop.lon})["leisure"~"park|garden"];\n  way(around:${radiusMeters},${stop.lat},${stop.lon})["tourism"];\n  way(around:${radiusMeters},${stop.lat},${stop.lon})["amenity"~"restaurant|cafe"];\n  way(around:${radiusMeters},${stop.lat},${stop.lon})["leisure"~"park|garden"];\n);\nout center tags 120;\n`;
  const pois = await fetchOverpassPois(env, cacheKey("nearby", stop.id, radiusMeters, category ?? "all"), q);
  return pois.filter((p) => (!category || p.category.toLowerCase().includes(category.toLowerCase())) && haversineKm({ lat: stop.lat, lon: stop.lon }, { lat: p.lat, lon: p.lon }) <= radiusMeters / 1000);
}

function recalcSummary(it: Itinerary) {
  const totalEstimatedCost = it.days.reduce((a, d) => a + d.dayCost, 0);
  const e = it.days.map((d) => calculateEnergy(d.stops));
  return {
    totalEstimatedCost,
    totalWalkingDistance: Number(e.reduce((a, x) => a + x.walkingKm, 0).toFixed(2)),
    travelTimeTotal: e.reduce((a, x) => a + x.travelTimeMinutes, 0),
    diversityScore: diversityScore(it.days)
  };
}

export function replanDayInItinerary(itinerary: Itinerary, dayNumber: number): Itinerary {
  const clone = structuredClone(itinerary);
  const idx = clone.days.findIndex((d) => d.dayNumber === dayNumber);
  if (idx < 0) return clone;
  const day = clone.days[idx];

  const memory = clone.days.flatMap((d, i) => i === idx ? [] : d.stops.map((s) => s.category)).slice(-5);
  const attrs = enforceDiversity(day.stops.filter((s) => s.category !== "restaurant" && s.category !== "cafe").map((s) => ({ ...s, score: 0, sourceTags: {}, id: s.id } as unknown as ScoredPoi)), memory).map((x) => day.stops.find((s) => s.id === x.id)!).filter(Boolean);
  const lunch = day.stops.find((s) => s.category === "restaurant");
  const dinner = day.stops.filter((s) => s.category === "restaurant")[1];
  const cafe = day.stops.find((s) => s.category === "cafe");

  let stops = [...attrs];
  if (lunch) stops.splice(Math.min(2, stops.length), 0, lunch);
  if (cafe) stops.splice(Math.min(4, stops.length), 0, cafe);
  if (dinner) stops.push(dinner);
  stops = updateTimes(stops, fromTime(day.stops[0]?.startTime ?? "09:00"));

  const en = calculateEnergy(stops);
  day.stops = stops;
  day.dayCost = stops.reduce((a, s) => a + s.estimatedCost, 0);
  day.totalCost = day.dayCost;
  day.energyScore = en.energyScore;
  day.energyLevel = en.energyLevel;
  day.explanation = `${day.explanation.split(".")[0]}. Replanned this day only while preserving diversity and budget alignment. Energy is ${en.energyLevel}.`;

  clone.totalEstimatedCost = clone.days.reduce((a, d) => a + d.dayCost, 0);
  clone.tripSummary = recalcSummary(clone);
  return clone;
}

export function applyBudgetAdjustment(itinerary: Itinerary, newBudget: number): Itinerary {
  const factor = newBudget / Math.max(1, itinerary.totalEstimatedCost);
  const days = itinerary.days.map((d) => {
    const stops = d.stops.map((s) => ({ ...s, estimatedCost: Math.max(0, Number((s.estimatedCost * factor).toFixed(2))) }));
    const dayCost = stops.reduce((a, s) => a + s.estimatedCost, 0);
    const e = calculateEnergy(stops);
    return { ...d, stops, dayCost, totalCost: dayCost, energyScore: e.energyScore, energyLevel: e.energyLevel };
  });
  const out: Itinerary = { ...itinerary, days, totalEstimatedCost: days.reduce((a, d) => a + d.dayCost, 0) };
  out.tripSummary = recalcSummary(out);
  return out;
}

export function applyPaceChange(itinerary: Itinerary, mode: TravelStyle): Itinerary {
  const t = TEMPLATE[mode];
  const days = itinerary.days.map((d) => {
    const attrs = d.stops.filter((s) => s.category !== "restaurant" && s.category !== "cafe").slice(0, t.attractionsMax);
    const lunch = d.stops.find((s) => s.category === "restaurant");
    const dinner = d.stops.filter((s) => s.category === "restaurant")[1];
    const cafe = t.cafe ? d.stops.find((s) => s.category === "cafe") : undefined;
    let stops = [...attrs];
    if (lunch) stops.splice(Math.min(2, stops.length), 0, lunch);
    if (cafe) stops.splice(Math.min(4, stops.length), 0, cafe);
    if (dinner) stops.push(dinner);
    stops = updateTimes(stops, fromTime(d.stops[0]?.startTime ?? "09:00"));
    const e = calculateEnergy(stops);
    const dayCost = stops.reduce((a, s) => a + s.estimatedCost, 0);
    return { ...d, stops, dayCost, totalCost: dayCost, energyScore: e.energyScore, energyLevel: e.energyLevel, explanation: `Pace switched to ${mode}. ${d.explanation}` };
  });
  const out: Itinerary = { ...itinerary, days, totalEstimatedCost: days.reduce((a, d) => a + d.dayCost, 0) };
  out.tripSummary = recalcSummary(out);
  return out;
}
