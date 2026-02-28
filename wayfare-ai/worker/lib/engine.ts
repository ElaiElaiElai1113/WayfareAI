import type { Env, GeocodeResult, Itinerary, PlanRequest, Poi, Stop, TransportMode, TravelStyle } from "../src/types";
import { cacheKey, fromTime, toTime, withCache } from "../src/utils";

type ScoredPoi = Poi & {
  score: number;
  distanceFromClusterKm?: number;
  cuisine?: string;
};

type DayTemplate = {
  attractionsMin: number;
  attractionsMax: number;
  includeCafeOptional: boolean;
  includeScenicOptional: boolean;
};

const CHAIN_NAMES = [
  "jollibee",
  "mcdonald's",
  "mcdonalds",
  "kfc",
  "chowking",
  "greenwich",
  "mang inasal",
  "gerry's grill",
  "gerrys grill",
  "shakey's",
  "shakeys",
  "pizza hut"
];

const DEFAULT_POI_COST: Record<string, number> = {
  museum: 16,
  park: 0,
  cafe: 8,
  restaurant: 18,
  viewpoint: 0,
  attraction: 12,
  hidden_gem: 7,
  shopping: 15,
  nightlife: 20
};

const DAY_TEMPLATES: Record<TravelStyle, DayTemplate> = {
  Relaxed: { attractionsMin: 2, attractionsMax: 2, includeCafeOptional: true, includeScenicOptional: true },
  Balanced: { attractionsMin: 3, attractionsMax: 3, includeCafeOptional: true, includeScenicOptional: false },
  Packed: { attractionsMin: 4, attractionsMax: 5, includeCafeOptional: true, includeScenicOptional: false }
};

const LUNCH_WINDOW: [number, number] = [11 * 60 + 30, 14 * 60];
const DINNER_WINDOW: [number, number] = [18 * 60, 20 * 60];

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

function normalizeCategory(tags: Record<string, string>): string {
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
  const pois: Poi[] = [];

  for (const item of elements) {
    const lat = item.lat ?? item.center?.lat;
    const lon = item.lon ?? item.center?.lon;
    const name = item.tags?.name;
    if (!lat || !lon || !name) continue;

    const key = `${String(name).toLowerCase()}_${Number(lat).toFixed(4)}_${Number(lon).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sourceTags = (item.tags ?? {}) as Record<string, string>;
    pois.push({
      id: `poi_${item.type}_${item.id}`,
      name,
      category: forceCategory ?? normalizeCategory(sourceTags),
      lat: Number(lat),
      lon: Number(lon),
      sourceTags
    });
  }

  return pois;
}

async function geocodeCity(env: Env, city: string): Promise<GeocodeResult> {
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("geo", city.toLowerCase()), ttl, async () => {
    const url = `${env.NOMINATIM_BASE_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(city)}`;
    const response = await fetch(url, { headers: { "User-Agent": "WayfareAI/1.0" } });
    if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);
    const data = (await response.json()) as Array<{
      display_name: string;
      boundingbox: [string, string, string, string];
      lon: string;
      lat: string;
    }>;
    if (!data.length) throw new Error("City not found");

    const top = data[0];
    return {
      name: top.display_name,
      bbox: [
        Number(top.boundingbox[2]),
        Number(top.boundingbox[0]),
        Number(top.boundingbox[3]),
        Number(top.boundingbox[1])
      ],
      center: [Number(top.lon), Number(top.lat)]
    };
  });
}

function buildAttractionQuery(bbox: [number, number, number, number]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const bb = `${minLat},${minLon},${maxLat},${maxLon}`;
  return `
[out:json][timeout:25];
(
  node["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](${bb});
  node["historic"](${bb});
  node["leisure"~"park|garden|nature_reserve"](${bb});
  way["tourism"~"attraction|museum|gallery|viewpoint|artwork|zoo|theme_park"](${bb});
  way["historic"](${bb});
  way["leisure"~"park|garden|nature_reserve"](${bb});
);
out center tags 400;
`;
}

function buildFoodQuery(center: [number, number], radiusMeters: number, amenity: "restaurant" | "cafe") {
  const [lon, lat] = center;
  return `
[out:json][timeout:20];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"="${amenity}"];
  way(around:${radiusMeters},${lat},${lon})["amenity"="${amenity}"];
);
out center tags 200;
`;
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

async function fetchCityAttractions(env: Env, bbox: [number, number, number, number]) {
  return fetchOverpassPois(env, cacheKey("attractions", ...bbox.map((v) => v.toFixed(3))), buildAttractionQuery(bbox));
}

async function fetchRestaurantsNear(env: Env, center: [number, number], radiusMeters: number) {
  return fetchOverpassPois(
    env,
    cacheKey("restaurants", center[0].toFixed(4), center[1].toFixed(4), radiusMeters),
    buildFoodQuery(center, radiusMeters, "restaurant"),
    "restaurant"
  );
}

async function fetchCafesNear(env: Env, center: [number, number], radiusMeters: number) {
  return fetchOverpassPois(
    env,
    cacheKey("cafes", center[0].toFixed(4), center[1].toFixed(4), radiusMeters),
    buildFoodQuery(center, radiusMeters, "cafe"),
    "cafe"
  );
}

async function osrmTable(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<number[][]> {
  if (coords.length < 2) return [coords.map(() => 0)];
  const coordString = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("osrm-table", mode, coordString.slice(0, 320)), ttl, async () => {
    const response = await fetch(`${env.OSRM_BASE_URL}/table/v1/${mode}/${coordString}?annotations=duration`);
    if (!response.ok) throw new Error(`OSRM table failed: ${response.status}`);
    const data = (await response.json()) as { durations: number[][] | null };
    return (data.durations ?? []).map((row) => row.map((sec) => (Number.isFinite(sec) ? Math.round(sec / 60) : 999)));
  });
}

async function osrmRoute(env: Env, coords: Array<[number, number]>, mode: TransportMode): Promise<[number, number][]> {
  if (coords.length < 2) return [];
  const coordString = coords.map((c) => `${c[0]},${c[1]}`).join(";");
  const ttl = Number(env.CACHE_TTL_SECONDS || "21600");
  return withCache(env, cacheKey("osrm-route", mode, coordString.slice(0, 320)), ttl, async () => {
    const response = await fetch(`${env.OSRM_BASE_URL}/route/v1/${mode}/${coordString}?overview=full&geometries=geojson`);
    if (!response.ok) throw new Error(`OSRM route failed: ${response.status}`);
    const data = (await response.json()) as { routes?: Array<{ geometry: { coordinates: [number, number][] } }> };
    return data.routes?.[0]?.geometry?.coordinates ?? [];
  });
}

function hasWiki(tags: Record<string, string>) {
  return Boolean(tags.wikipedia || tags.wikidata);
}

function isChain(name: string, tags: Record<string, string>) {
  const loweredName = name.toLowerCase();
  const brandText = `${tags.brand || ""} ${tags.operator || ""}`.toLowerCase();
  if (tags.brand || tags.operator) return true;
  return CHAIN_NAMES.some((chain) => loweredName.includes(chain) || brandText.includes(chain));
}

function cuisineTokens(tags: Record<string, string>) {
  return (tags.cuisine || "")
    .toLowerCase()
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function isLocalCuisine(tags: Record<string, string>) {
  const cuisines = cuisineTokens(tags);
  return cuisines.some((c) => c.includes("filipino") || c.includes("local") || c.includes("regional"));
}

function attractionScore(poi: Poi) {
  const tags = poi.sourceTags;
  let score = 0;
  if (hasWiki(tags)) score += 3;
  if (tags.website) score += 2;
  if (tags.opening_hours) score += 1;
  if (tags.tourism) score += 1;
  if (Object.keys(tags).length < 3) score -= 2;
  return score;
}

function restaurantScore(poi: Poi, clusterCenter: [number, number]) {
  const tags = poi.sourceTags;
  const distanceKm = haversineKm({ lat: poi.lat, lon: poi.lon }, { lat: clusterCenter[1], lon: clusterCenter[0] });
  let score = 0;

  if (isLocalCuisine(tags)) score += 3;
  if (!tags.brand && !tags.operator) score += 2;
  if (tags.website) score += 1;
  if (Object.keys(tags).length >= 5) score += 1;
  if (isChain(poi.name, tags)) score -= 3;
  if (distanceKm > 1.5) score -= 2;

  if (distanceKm >= 0.8 && distanceKm <= 1.5) score += 1;

  return { score, distanceKm };
}

function cafeScore(poi: Poi, clusterCenter: [number, number]) {
  const distanceKm = haversineKm({ lat: poi.lat, lon: poi.lon }, { lat: clusterCenter[1], lon: clusterCenter[0] });
  let score = 0;
  if (!poi.sourceTags.brand && !poi.sourceTags.operator) score += 2;
  if (poi.sourceTags.website) score += 1;
  if (Object.keys(poi.sourceTags).length >= 5) score += 1;
  if (distanceKm > 1.5) score -= 2;
  if (distanceKm >= 0.8 && distanceKm <= 1.5) score += 1;
  return { score, distanceKm };
}

function preferenceMatch(poi: Poi, preferences: Record<string, boolean>) {
  if (poi.category === "park" || poi.category === "viewpoint") return Boolean(preferences.nature);
  if (poi.category === "museum") return Boolean(preferences.museums);
  if (poi.category === "cafe") return Boolean(preferences.cafes);
  if (poi.category === "restaurant") return Boolean(preferences.localFood);
  if (poi.category === "nightlife") return Boolean(preferences.nightlife);
  if (poi.category === "shopping") return Boolean(preferences.shopping);
  return Boolean(preferences.hiddenGems);
}

function forceMustSee(input: PlanRequest, attractions: ScoredPoi[], fallbackCenter: [number, number]): ScoredPoi[] {
  if (!input.mustSee.length) return attractions;
  const must = input.mustSee.map((m) => m.toLowerCase());
  const existing = [...attractions];

  for (const item of must) {
    const already = existing.some((poi) => poi.name.toLowerCase().includes(item));
    if (already) continue;
    existing.unshift({
      id: `must_${item.replace(/[^a-z0-9]/g, "")}`,
      name: item,
      category: "attraction",
      lat: fallbackCenter[1],
      lon: fallbackCenter[0],
      sourceTags: { synthetic: "true" },
      score: 6
    });
  }

  return existing;
}

function centroid(points: Poi[]): [number, number] {
  if (!points.length) return [0, 0];
  const sums = points.reduce(
    (acc, p) => {
      acc.lon += p.lon;
      acc.lat += p.lat;
      return acc;
    },
    { lon: 0, lat: 0 }
  );
  return [sums.lon / points.length, sums.lat / points.length];
}

function clusterAttractionsByDay(attractions: ScoredPoi[], dayCount: number): ScoredPoi[][] {
  if (dayCount <= 1) return [attractions];
  if (attractions.length <= dayCount) {
    return Array.from({ length: dayCount }, (_, i) => (attractions[i] ? [attractions[i]] : []));
  }

  const sorted = [...attractions].sort((a, b) => b.score - a.score);
  const centroids: [number, number][] = sorted.slice(0, dayCount).map((p) => [p.lon, p.lat]);
  const buckets: ScoredPoi[][] = Array.from({ length: dayCount }, () => []);

  for (const poi of sorted) {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < centroids.length; i += 1) {
      const dist = haversineKm({ lat: poi.lat, lon: poi.lon }, { lat: centroids[i][1], lon: centroids[i][0] });
      const loadPenalty = buckets[i].length * 0.08;
      const adjusted = dist + loadPenalty;
      if (adjusted < bestDist) {
        best = i;
        bestDist = adjusted;
      }
    }
    buckets[best].push(poi);
    const c = centroid(buckets[best]);
    centroids[best] = c;
  }

  return buckets.map((bucket) => bucket.sort((a, b) => b.score - a.score));
}

function nearestNeighborAttractions(items: ScoredPoi[]): ScoredPoi[] {
  if (items.length <= 2) return items;
  const remaining = [...items];
  remaining.sort((a, b) => b.score - a.score);
  const ordered: ScoredPoi[] = [remaining.shift()!];

  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const dist = haversineKm({ lat: last.lat, lon: last.lon }, { lat: remaining[i].lat, lon: remaining[i].lon });
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }

  return ordered;
}

function pickAttractionsForTemplate(cluster: ScoredPoi[], style: TravelStyle): ScoredPoi[] {
  const template = DAY_TEMPLATES[style];
  const topAttractions = cluster.slice(0, 20);
  const ordered = nearestNeighborAttractions(topAttractions);
  const target =
    style === "Packed"
      ? Math.min(template.attractionsMax, Math.max(template.attractionsMin, ordered.length >= 5 ? 5 : 4))
      : template.attractionsMin;
  return ordered.slice(0, Math.max(1, target));
}

function clampToWindow(mins: number, window: [number, number]) {
  if (mins < window[0]) return window[0];
  if (mins > window[1]) return window[1];
  return mins;
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

function selectRestaurant(
  candidates: ScoredPoi[],
  nearPoint: [number, number],
  usedNames: Set<string>,
  disallowCuisine?: string
): ScoredPoi | undefined {
  const ranked = [...candidates]
    .filter((poi) => !usedNames.has(poi.name.toLowerCase()))
    .filter((poi) => !disallowCuisine || (poi.cuisine ?? "") !== disallowCuisine)
    .sort((a, b) => {
      const da = haversineKm({ lat: a.lat, lon: a.lon }, { lat: nearPoint[1], lon: nearPoint[0] });
      const db = haversineKm({ lat: b.lat, lon: b.lon }, { lat: nearPoint[1], lon: nearPoint[0] });
      return b.score - a.score + (da - db) * 0.3;
    });

  return ranked[0];
}

function buildDayExplanation(clusterCenter: [number, number]) {
  return `Day grouped around ${clusterCenter[1].toFixed(3)}, ${clusterCenter[0].toFixed(3)} to minimize travel time. Lunch is placed near morning anchors, and dinner is near the final cluster for convenience.`;
}

function buildDaySequence(
  attractions: ScoredPoi[],
  lunch: ScoredPoi,
  dinner: ScoredPoi,
  optionalCafe: ScoredPoi | undefined,
  style: TravelStyle
): Poi[] {
  const morningAnchor = attractions[0];
  const secondary = attractions[1];
  const afternoon = attractions.slice(2);

  const sequence: Poi[] = [];
  if (morningAnchor) sequence.push(morningAnchor);
  if (secondary) sequence.push(secondary);
  sequence.push({ ...lunch, category: "restaurant" });

  for (const a of afternoon) sequence.push(a);

  if (style === "Relaxed" && optionalCafe) {
    sequence.push({ ...optionalCafe, category: "cafe" });
  } else if (style !== "Relaxed" && optionalCafe && attractions.length >= 3) {
    sequence.splice(Math.min(sequence.length, 4), 0, { ...optionalCafe, category: "cafe" });
  }

  sequence.push({ ...dinner, category: "restaurant" });

  const cleaned: Poi[] = [];
  for (const stop of sequence) {
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.category === "restaurant" && stop.category === "restaurant") continue;
    cleaned.push(stop);
  }

  return cleaned;
}

export async function createItinerary(env: Env, input: PlanRequest): Promise<Itinerary> {
  const geocoded = await geocodeCity(env, input.city);
  const dayCount =
    input.days ??
    (input.dateFrom && input.dateTo
      ? Math.max(1, Math.ceil((new Date(input.dateTo).getTime() - new Date(input.dateFrom).getTime()) / 86400000) + 1)
      : 3);

  // 1) Fetch attractions city-wide
  const rawAttractions = await fetchCityAttractions(env, geocoded.bbox);

  // 2) Score and filter attractions
  const scoredAttractions: ScoredPoi[] = rawAttractions
    .filter((poi) => poi.category !== "restaurant" && poi.category !== "cafe")
    .filter((poi) => preferenceMatch(poi, input.preferences))
    .map((poi) => ({ ...poi, score: attractionScore(poi) }))
    .sort((a, b) => b.score - a.score);

  const seededAttractions = forceMustSee(input, scoredAttractions, geocoded.center);

  // 3) Cluster attractions geographically by day
  const clusters = clusterAttractionsByDay(seededAttractions, dayCount);

  const usedRestaurantNames = new Set<string>();
  const days: Itinerary["days"] = [];

  for (let dayIdx = 0; dayIdx < dayCount; dayIdx += 1) {
    const cluster = clusters[dayIdx] ?? [];
    if (!cluster.length) continue;

    // 4) Lock attraction selections per template
    const selectedAttractions = pickAttractionsForTemplate(cluster, input.travelStyle);
    const clusterCenter = centroid(selectedAttractions);

    // 5) Fetch restaurants for this day cluster only (never city-wide)
    const nearbyRestaurantsRaw = await fetchRestaurantsNear(env, clusterCenter, 1500);
    const restaurantCandidates: ScoredPoi[] = nearbyRestaurantsRaw
      .map((poi) => {
        const foodScore = restaurantScore(poi, clusterCenter);
        return {
          ...poi,
          score: foodScore.score,
          distanceFromClusterKm: foodScore.distanceKm,
          cuisine: cuisineTokens(poi.sourceTags)[0] || "generic"
        };
      })
      .filter((poi) => (poi.distanceFromClusterKm ?? 99) <= 1.5)
      .filter((poi) => !isChain(poi.name, poi.sourceTags))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    const fallbackRestaurants = restaurantCandidates.length
      ? restaurantCandidates
      : nearbyRestaurantsRaw
          .map((poi) => {
            const foodScore = restaurantScore(poi, clusterCenter);
            return {
              ...poi,
              score: foodScore.score,
              distanceFromClusterKm: foodScore.distanceKm,
              cuisine: cuisineTokens(poi.sourceTags)[0] || "generic"
            };
          })
          .filter((poi) => (poi.distanceFromClusterKm ?? 99) <= 1.5)
          .sort((a, b) => b.score - a.score)
          .slice(0, 15);

    const restaurantPool = fallbackRestaurants;
    if (restaurantPool.length < 2) continue;

    const lunchRef: [number, number] = [selectedAttractions[0].lon, selectedAttractions[0].lat];
    const dinnerAnchor = selectedAttractions[selectedAttractions.length - 1];
    const dinnerRef: [number, number] = [dinnerAnchor.lon, dinnerAnchor.lat];

    const lunch = selectRestaurant(restaurantPool, lunchRef, usedRestaurantNames);
    if (!lunch) continue;

    usedRestaurantNames.add(lunch.name.toLowerCase());
    const dinner =
      selectRestaurant(restaurantPool, dinnerRef, usedRestaurantNames, lunch.cuisine) ??
      selectRestaurant(restaurantPool, dinnerRef, usedRestaurantNames);
    if (!dinner) continue;
    usedRestaurantNames.add(dinner.name.toLowerCase());

    // Optional cafe: max 1/day, and never back-to-back food due sequence placement.
    let optionalCafe: ScoredPoi | undefined;
    if (DAY_TEMPLATES[input.travelStyle].includeCafeOptional && input.preferences.cafes) {
      const nearbyCafesRaw = await fetchCafesNear(env, clusterCenter, 1500);
      const cafes = nearbyCafesRaw
        .map((poi) => {
          const cafe = cafeScore(poi, clusterCenter);
          return { ...poi, score: cafe.score, distanceFromClusterKm: cafe.distanceKm };
        })
        .filter((poi) => (poi.distanceFromClusterKm ?? 99) <= 1.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      optionalCafe = cafes[0];
    }

    // 6) Anchor-based day structure
    const orderedPois = buildDaySequence(selectedAttractions, lunch, dinner, optionalCafe, input.travelStyle);

    const coords = orderedPois.map((poi) => [poi.lon, poi.lat] as [number, number]);
    const matrix = await osrmTable(env, coords, input.transportMode);
    const routeGeometry = await osrmRoute(env, coords, input.transportMode);

    const start = fromTime(input.dailyStartTime);
    let cursor = start;
    let foodCount = 0;
    let cafeCount = 0;

    const stops: Stop[] = orderedPois.map((poi, idx) => {
      const travel = idx === 0 ? 0 : matrix[idx - 1]?.[idx] ?? Math.round(haversineKm({ lat: orderedPois[idx - 1].lat, lon: orderedPois[idx - 1].lon }, { lat: poi.lat, lon: poi.lon }) * 12);
      cursor += travel;

      if (poi.category === "restaurant") {
        foodCount += 1;
        cursor = clampToWindow(cursor, foodCount === 1 ? LUNCH_WINDOW : DINNER_WINDOW);
      }

      if (poi.category === "cafe") {
        cafeCount += 1;
      }

      const durationMinutes = stopDuration(input.travelStyle, poi.category);
      const startTime = toTime(cursor);
      cursor += durationMinutes;

      const notes =
        poi.category === "restaurant"
          ? foodCount === 1
            ? "Lunch near morning attractions"
            : "Dinner near final stops"
          : idx === 0
            ? "Morning anchor attraction"
            : idx === 1
              ? "Secondary nearby attraction"
              : undefined;

      return {
        id: `stop_${dayIdx + 1}_${idx + 1}`,
        name: poi.name,
        category: poi.category,
        lat: poi.lat,
        lon: poi.lon,
        startTime,
        durationMinutes,
        travelMinutesFromPrev: travel,
        estimatedCost: estimateStopCost(poi.category, input.budgetSaver),
        notes
      };
    });

    // Strict rules post-check.
    const restaurants = stops.filter((s) => s.category === "restaurant");
    const cafes = stops.filter((s) => s.category === "cafe");
    const attractionsOnly = stops.filter((s) => s.category !== "restaurant" && s.category !== "cafe");
    const validLunch = restaurants[0] && fromTime(restaurants[0].startTime) >= LUNCH_WINDOW[0] && fromTime(restaurants[0].startTime) <= LUNCH_WINDOW[1];
    const validDinner = restaurants[1] && fromTime(restaurants[1].startTime) >= DINNER_WINDOW[0] && fromTime(restaurants[1].startTime) <= DINNER_WINDOW[1];

    if (restaurants.length !== 2 || cafes.length > 1 || !validLunch || !validDinner || attractionsOnly.length < DAY_TEMPLATES[input.travelStyle].attractionsMin) {
      continue;
    }

    const dayCost = stops.reduce((acc, stop) => acc + stop.estimatedCost, 0);
    days.push({
      dayNumber: dayIdx + 1,
      date: input.dateFrom
        ? new Date(new Date(input.dateFrom).getTime() + dayIdx * 86400000).toISOString().slice(0, 10)
        : `Day ${dayIdx + 1}`,
      routeGeometry,
      stops,
      dayCost,
      explanation: buildDayExplanation(clusterCenter)
    });
  }

  // Fallback in edge cases where strict filters were too narrow.
  if (!days.length && seededAttractions.length) {
    const fallback = seededAttractions.slice(0, 3);
    const stops: Stop[] = fallback.map((poi, idx) => ({
      id: `stop_fallback_${idx + 1}`,
      name: poi.name,
      category: poi.category,
      lat: poi.lat,
      lon: poi.lon,
      startTime: toTime(fromTime(input.dailyStartTime) + idx * 120),
      durationMinutes: 75,
      travelMinutesFromPrev: idx === 0 ? 0 : 20,
      estimatedCost: estimateStopCost(poi.category, input.budgetSaver),
      notes: idx === 0 ? "Morning anchor attraction" : "Curated fallback stop"
    }));

    days.push({
      dayNumber: 1,
      date: input.dateFrom ?? "Day 1",
      routeGeometry: [],
      stops,
      dayCost: stops.reduce((a, s) => a + s.estimatedCost, 0),
      explanation: "Fallback day centered on top-rated attractions due limited local dining data in the queried cluster."
    });
  }

  const totalEstimatedCost = days.reduce((acc, day) => acc + day.dayCost, 0);

  return {
    city: input.city,
    bbox: geocoded.bbox,
    center: geocoded.center,
    currency: input.currency,
    totalEstimatedCost,
    days,
    preferences: input.preferences,
    generatedAt: new Date().toISOString()
  };
}

export async function fetchNearbyPois(env: Env, stop: Stop, radiusMeters: number, category?: string): Promise<Poi[]> {
  const [lon, lat] = [stop.lon, stop.lat];
  const query = `
[out:json][timeout:20];
(
  node(around:${radiusMeters},${lat},${lon})["tourism"];
  node(around:${radiusMeters},${lat},${lon})["amenity"~"restaurant|cafe"];
  node(around:${radiusMeters},${lat},${lon})["leisure"~"park|garden"];
  way(around:${radiusMeters},${lat},${lon})["tourism"];
  way(around:${radiusMeters},${lat},${lon})["amenity"~"restaurant|cafe"];
  way(around:${radiusMeters},${lat},${lon})["leisure"~"park|garden"];
);
out center tags 120;
`;

  const pois = await fetchOverpassPois(
    env,
    cacheKey("nearby", stop.id, radiusMeters, category ?? "all"),
    query
  );

  return pois.filter((poi) => {
    if (category && !poi.category.toLowerCase().includes(category.toLowerCase())) return false;
    return haversineKm({ lat: stop.lat, lon: stop.lon }, { lat: poi.lat, lon: poi.lon }) <= radiusMeters / 1000;
  });
}

export function applyBudgetAdjustment(itinerary: Itinerary, newBudget: number): Itinerary {
  const factor = newBudget / Math.max(1, itinerary.totalEstimatedCost);
  const days = itinerary.days.map((day) => {
    const stops = day.stops.map((stop) => ({
      ...stop,
      estimatedCost: Math.max(0, Number((stop.estimatedCost * factor).toFixed(2)))
    }));
    return { ...day, stops, dayCost: stops.reduce((acc, s) => acc + s.estimatedCost, 0) };
  });

  return {
    ...itinerary,
    days,
    totalEstimatedCost: days.reduce((acc, day) => acc + day.dayCost, 0)
  };
}

export function applyPaceChange(itinerary: Itinerary, mode: TravelStyle): Itinerary {
  const template = DAY_TEMPLATES[mode];
  const maxAttractions = template.attractionsMax;

  const days = itinerary.days.map((day) => {
    const attractions = day.stops.filter((s) => s.category !== "restaurant" && s.category !== "cafe");
    const food = day.stops.filter((s) => s.category === "restaurant").slice(0, 2);
    const cafe = day.stops.find((s) => s.category === "cafe");

    const trimmedAttractions = attractions.slice(0, Math.max(1, maxAttractions));
    const rebuilt = [...trimmedAttractions, ...food, ...(cafe && template.includeCafeOptional ? [cafe] : [])];

    return {
      ...day,
      stops: rebuilt,
      dayCost: rebuilt.reduce((acc, s) => acc + s.estimatedCost, 0),
      explanation: `Pace switched to ${mode}. ${day.explanation}`
    };
  });

  return {
    ...itinerary,
    days,
    totalEstimatedCost: days.reduce((acc, day) => acc + day.dayCost, 0)
  };
}
