import { Hono } from "hono";
import { z } from "zod";
import { createItinerary, fetchNearbyPois, applyBudgetAdjustment, applyPaceChange, replanDayInItinerary } from "../lib/engine";
import type { Env, Itinerary, PlanRequest } from "./types";
import { validateEnv } from "./types";
import { cacheKey, rateLimit, slugify, withCache, withRetry, callGLM, callGLMForItinerary } from "./utils";

const app = new Hono<{ Bindings: Env }>();

// Environment validation middleware
app.use("/*", async (c, next) => {
  try {
    validateEnv(c.env);
  } catch (error) {
    console.error("Environment validation failed:", error);
    return c.json(
      { error: "Server configuration error", details: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
  await next();
});

// Security headers middleware
app.use("/*", async (c, next) => {
  await next();

  // Add security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), camera=(), microphone=()");

  // CORS headers for API routes
  if (c.req.path.startsWith("/api/")) {
    const origin = c.req.header("Origin");
    const allowedOrigins = (c.env.ALLOWED_ORIGINS || "*").split(",").map(o => o.trim());

    if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      c.header("Access-Control-Max-Age", "86400");
    }

    if (c.req.method === "OPTIONS") {
      return c.text("", 204);
    }
  }
});

// Request logging middleware
app.use("/api/*", async (c, next) => {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  await next();

  const duration = Date.now() - startTime;
  const status = c.res.status;

  // Log request details for monitoring
  console.log(`${method} ${path} ${status} ${duration}ms`);

  // Store metrics in Cloudflare Analytics or external service
  if (c.env.REQUEST_METRICS) {
    try {
      await c.env.REQUEST_METRICS.put(
        `metric:${Date.now()}`,
        JSON.stringify({ path, method, status, duration, timestamp: new Date().toISOString() }),
        { expirationTtl: 86400 } // 24 hours
      );
    } catch (e) {
      // Silently fail if metrics storage fails
    }
  }
});

app.use("/api/*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const limited = await rateLimit(c.env, ip, "api-global");
  if (!limited.ok) {
    console.warn(`Rate limit exceeded for IP: ${ip}`);
    return c.json(
      { error: "Rate limit exceeded", retryAfter: c.env.RATE_LIMIT_WINDOW_SECONDS },
      429
    );
  }
  await next();
});

app.get("/api/geocode", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const scopedLimit = await rateLimit(c.env, ip, "geo", 80, 60);
  if (!scopedLimit.ok) {
    return c.json({ error: "Geocode rate limit exceeded", retryAfter: 60 }, 429);
  }

  const q = c.req.query("q");
  if (!q || q.length < 2) return c.json([], 200);

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  try {
    const result = await withCache(c.env, cacheKey("geo-autocomplete", q), ttl, async () => {
      return await withRetry(
        async () => {
          const url = `${c.env.NOMINATIM_BASE_URL}/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`;
          const response = await fetch(url, {
            headers: { "User-Agent": "WayfareAI/1.0", "Accept-Language": "en-US,en;q=0.9" },
            signal: AbortSignal.timeout(15000) // 15s timeout with more tolerance
          });

          if (!response.ok) {
            const error = new Error(`Nominatim API error: ${response.status}`);
            (error as any).status = response.status;
            throw error;
          }

          const data = await response.json() as Array<any>;

          // Handle empty results gracefully
          if (!data || data.length === 0) {
            return [];
          }

          return data.map((item) => ({
            name: item.display_name || item.name,
            bbox: [Number(item.boundingbox[2]), Number(item.boundingbox[0]), Number(item.boundingbox[3]), Number(item.boundingbox[1])],
            center: [Number(item.lon), Number(item.lat)]
          }));
        },
        { maxRetries: 2, baseDelay: 1000 } // Fewer retries for geocoding
      );
    });

    return c.json(result);
  } catch (error) {
    console.error("Geocode error:", error);
    // Return empty array instead of throwing to prevent 500 errors
    return c.json([], 200);
  }
});

app.get("/api/pois", async (c) => {
  const bbox = c.req.query("bbox");
  if (!bbox) return c.json({ error: "bbox query required" }, 400);

  const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);

  // Validate bbox coordinates
  if ([minLon, minLat, maxLon, maxLat].some(n => !Number.isFinite(n))) {
    return c.json({ error: "Invalid bbox coordinates" }, 400);
  }

  const query = `
[out:json][timeout:25];
(
  node["tourism"~"museum|attraction|viewpoint"](${minLat},${minLon},${maxLat},${maxLon});
  node["amenity"~"cafe|restaurant|bar|pub"](${minLat},${minLon},${maxLat},${maxLon});
  node["leisure"~"park|garden"](${minLat},${minLon},${maxLat},${maxLon});
);
out body 80;
`;

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const data = await withCache(c.env, cacheKey("pois-route", bbox), ttl, async () => {
    return await withRetry(
      async () => {
        const response = await fetch(c.env.OVERPASS_BASE_URL, {
          method: "POST",
          body: query,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(30000) // 30s timeout for Overpass
        });

        if (!response.ok) {
          const error = new Error(`Overpass API error: ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }

        return response.json();
      },
      { maxRetries: 2, baseDelay: 2000 } // Fewer retries for Overpass
    );
  });

  return c.json(data);
});

app.get("/api/osrm/table", async (c) => {
  const profile = c.req.query("profile") || "walking";
  const coordinates = c.req.query("coordinates");

  if (!coordinates) {
    return c.json({ error: "coordinates query required" }, 400);
  }

  // Validate profile
  if (!["walking", "driving"].includes(profile)) {
    return c.json({ error: "Invalid profile. Use 'walking' or 'driving'." }, 400);
  }

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const data = await withCache(
    c.env,
    cacheKey("osrm-table-route", profile, coordinates.slice(0, 300)),
    ttl,
    async () => {
      return await withRetry(
        async () => {
          const url = `${c.env.OSRM_BASE_URL}/table/v1/${profile}/${coordinates}?annotations=duration`;
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) }); // 15s timeout

          if (!response.ok) {
            const error = new Error(`OSRM table API error: ${response.status}`);
            (error as any).status = response.status;
            throw error;
          }

          return response.json();
        },
        { maxRetries: 3, baseDelay: 1000 }
      );
    }
  );

  return c.json(data);
});

app.get("/api/osrm/route", async (c) => {
  const profile = c.req.query("profile") || "walking";
  const coordinates = c.req.query("coordinates");

  if (!coordinates) {
    return c.json({ error: "coordinates query required" }, 400);
  }

  // Validate profile
  if (!["walking", "driving"].includes(profile)) {
    return c.json({ error: "Invalid profile. Use 'walking' or 'driving'." }, 400);
  }

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const data = await withCache(
    c.env,
    cacheKey("osrm-route-route", profile, coordinates.slice(0, 300)),
    ttl,
    async () => {
      return await withRetry(
        async () => {
          const url = `${c.env.OSRM_BASE_URL}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson`;
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) }); // 15s timeout

          if (!response.ok) {
            const error = new Error(`OSRM route API error: ${response.status}`);
            (error as any).status = response.status;
            throw error;
          }

          return response.json();
        },
        { maxRetries: 3, baseDelay: 1000 }
      );
    }
  );

  return c.json(data);
});

const planSchema = z.object({
  city: z.string().min(2),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  days: z.number().optional(),
  dailyStartTime: z.string(),
  dailyEndTime: z.string(),
  budget: z.number().positive(),
  currency: z.string(),
  travelStyle: z.enum(["Relaxed", "Balanced", "Packed"]),
  transportMode: z.enum(["walking", "driving"]),
  mustSee: z.array(z.string()),
  preferences: z.record(z.boolean()),
  rainPlan: z.boolean(),
  budgetSaver: z.boolean(),
  useAI: z.boolean().optional()
});

app.post("/api/plan", async (c) => {
  try {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const scopedLimit = await rateLimit(c.env, ip, "plan", 5, 60);
    if (!scopedLimit.ok) {
      return c.json({ error: "Plan rate limit exceeded", retryAfter: 60 }, 429);
    }

    const payload = planSchema.parse(await c.req.json()) as PlanRequest;
    const itinerary = await createItinerary(c.env, payload);
    return c.json(itinerary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        { error: "Validation failed", issues: error.issues },
        400
      );
    }
    console.error("Plan endpoint error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const lower = message.toLowerCase();
    const status = lower.includes("nominatim") || lower.includes("overpass") || lower.includes("osrm") ? 503 : 500;
    return c.json({ error: "Failed to generate itinerary", details: message }, status);
  }
});

const describeStopSchema = z.object({
  stop: z.object({
    id: z.string().optional(),
    name: z.string(),
    category: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    tags: z.record(z.string()).optional(),
    address: z.string().optional(),
    website: z.string().optional(),
    opening_hours: z.string().optional(),
    cuisine: z.string().optional(),
    wikipedia: z.string().optional(),
    wikidata: z.string().optional()
  }).strict(),
  tripContext: z.object({
    city: z.string().optional(),
    dayNumber: z.number().optional(),
    travelStyle: z.string().optional(),
    preferences: z.record(z.boolean()).optional()
  }).strict().optional(),
  tone: z.enum(["premium", "friendly", "concise"]).optional()
}).strict();

const describeResponseSchema = z.object({
  about: z.string().min(1).max(400),
  why_this_stop: z.string().min(1).max(300),
  quick_tip: z.string().min(1).max(220),
  confidence: z.enum(["high", "medium", "low"])
}).strict();

function stripUnsafeText(input: string) {
  return input.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

function safeFallbackDescription(input: z.infer<typeof describeStopSchema>) {
  const stop = input.stop;
  const tagsCount = Object.keys(stop.tags ?? {}).length;
  const mediumSignals = [stop.website, stop.opening_hours, stop.wikipedia, stop.wikidata].filter(Boolean).length;
  const confidence: "high" | "medium" | "low" =
    mediumSignals >= 3 || tagsCount >= 8 ? "high" : mediumSignals >= 1 || tagsCount >= 5 ? "medium" : "low";
  return {
    about: `${stop.name} is included as a ${stop.category ?? "place"} stop based on available map data${stop.address ? ` in ${stop.address}` : ""}.`,
    why_this_stop: confidence !== "low"
      ? "This stop fits the route because supporting place details are available and it aligns with your itinerary flow."
      : "This stop supports route flow, though source metadata is limited.",
    quick_tip: stop.opening_hours
      ? `Check listed hours before arrival (${stop.opening_hours}).`
      : "Verify opening hours and access details before visiting.",
    confidence
  } as const;
}

function extractJsonObject(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

async function describeStopWithGLM(env: Env, payload: z.infer<typeof describeStopSchema>) {
  if (!env.GLM_API_KEY || !env.GLM_BASE_URL) return safeFallbackDescription(payload);

  const systemPrompt = [
    "Use only given facts. If unknown, generalize.",
    "Never invent prices, ratings, history, popularity, or claims not in input.",
    "Keep tone premium but factual.",
    "Output JSON only with exactly: about, why_this_stop, quick_tip, confidence."
  ].join(" ");

  const completion = await withRetry(async () => {
    const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: env.GLM_MODEL || "glm-4.7",
        temperature: 0.2,
        max_tokens: 320,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Input facts:\n${JSON.stringify(payload)}` }
        ]
      })
    });
    if (!res.ok) {
      const err = new Error(`Describe-stop model error: ${res.status}`);
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }, { maxRetries: 1, baseDelay: 1200 });

  const raw = completion?.choices?.[0]?.message?.content;
  const asString = typeof raw === "string" ? raw : raw ? JSON.stringify(raw) : "";
  const extracted = extractJsonObject(asString);
  if (!extracted) return safeFallbackDescription(payload);

  try {
    const parsed = describeResponseSchema.parse(JSON.parse(extracted));
    return {
      about: stripUnsafeText(parsed.about),
      why_this_stop: stripUnsafeText(parsed.why_this_stop),
      quick_tip: stripUnsafeText(parsed.quick_tip),
      confidence: parsed.confidence
    };
  } catch {
    return safeFallbackDescription(payload);
  }
}

app.post("/api/describe-stop", async (c) => {
  try {
    const payload = describeStopSchema.parse(await c.req.json());
    const tone = payload.tone ?? "premium";
    const key = cacheKey(
      "describe-stop",
      payload.stop.id ?? payload.stop.name.toLowerCase(),
      tone,
      payload.tripContext?.city ?? "",
      payload.tripContext?.dayNumber ?? ""
    );

    const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
    const result = await withCache(c.env, key, ttl, async () => describeStopWithGLM(c.env, payload));
    return c.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", issues: error.issues }, 400);
    }
    console.error("Describe-stop error:", error);
    return c.json({ error: "Failed to describe stop" }, 500);
  }
});

const chatSchema = z.object({
  message: z.string().min(1),
  itinerary: z.any(),
  preferences: z.record(z.boolean()).optional()
});

function routeIntent(message: string) {
  const text = message.toLowerCase();
  if (text.includes("replan_day(")) return "replan_day";
  if (text.includes("swap_stop(")) return "swap_stop";
  if (text.includes("suggest_nearby(")) return "suggest_nearby";
  if (text.includes("adjust_budget(")) return "adjust_budget";
  if (text.includes("change_pace(")) return "change_pace";
  return "default";
}

function parseArg(message: string): string {
  const match = message.match(/\(([^)]*)\)/);
  return match?.[1] || "";
}

async function runRuleAssistant(env: Env, message: string, itinerary: Itinerary) {
  const intent = routeIntent(message);
  let updatedItinerary: Itinerary | undefined;
  let assistantMessage = "I can help replan days, swap stops, suggest nearby places, adjust budget, or change pace.";

  if (intent === "replan_day") {
    const day = Number(parseArg(message)) || 1;
    const targetDay = itinerary.days.find((d) => d.dayNumber === day);
    if (!targetDay) {
      assistantMessage = `Day ${day} was not found in your itinerary.`;
    } else {
      updatedItinerary = replanDayInItinerary(itinerary, day);
      assistantMessage = `Day ${day} has been replanned while preserving trip-wide balance.`;
    }
  }

  if (intent === "swap_stop") {
    const stopId = parseArg(message).trim();
    const clone = structuredClone(itinerary);
    const day = clone.days.find((d) => d.stops.some((s) => s.id === stopId));
    const stop = day?.stops.find((s) => s.id === stopId);
    if (!day || !stop) {
      assistantMessage = "I could not find that stop ID. Use a stop ID from the timeline.";
    } else {
      const nearby = await fetchNearbyPois(env, stop, 2000);
      const replacement = nearby.find((p) => p.name.toLowerCase() !== stop.name.toLowerCase());
      if (replacement) {
        const idx = day.stops.findIndex((s) => s.id === stop.id);
        const tags = replacement.sourceTags ?? {};
        const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ").trim();
        day.stops[idx] = {
          ...stop,
          name: replacement.name,
          category: replacement.category,
          lat: replacement.lat,
          lon: replacement.lon,
          tags,
          address: address || stop.address,
          website: tags.website,
          opening_hours: tags.opening_hours,
          cuisine: tags.cuisine,
          wikipedia: tags.wikipedia,
          wikidata: tags.wikidata,
          notes: "Swapped by assistant within 2km"
        };
        assistantMessage = `Swapped ${stop.name} with ${replacement.name}.`;
        updatedItinerary = clone;
      } else {
        assistantMessage = "No valid nearby replacement was found within 2km.";
      }
    }
  }

  if (intent === "suggest_nearby") {
    const [category, radiusRaw] = parseArg(message).split(",");
    const firstStop = itinerary.days[0]?.stops[0];
    if (!firstStop) {
      assistantMessage = "I need at least one stop to suggest nearby places.";
    } else {
      const nearby = await fetchNearbyPois(env, firstStop, Number(radiusRaw || "2000"), category?.trim());
      assistantMessage = nearby.length
        ? `Nearby ${category || "places"}: ${nearby.slice(0, 5).map((p) => p.name).join(", ")}.`
        : "No nearby places found for that filter.";
    }
  }

  if (intent === "adjust_budget") {
    const newBudget = Number(parseArg(message));
    if (Number.isFinite(newBudget) && newBudget > 0) {
      updatedItinerary = applyBudgetAdjustment(itinerary, newBudget);
      assistantMessage = `Budget adjusted to approximately ${itinerary.currency} ${newBudget.toFixed(0)}.`;
    } else {
      assistantMessage = "Please provide a valid budget amount.";
    }
  }

  if (intent === "change_pace") {
    const pace = parseArg(message).trim() as "Relaxed" | "Balanced" | "Packed";
    if (["Relaxed", "Balanced", "Packed"].includes(pace)) {
      updatedItinerary = applyPaceChange(itinerary, pace);
      assistantMessage = `Pace updated to ${pace}.`;
    } else {
      assistantMessage = "Use one of: Relaxed, Balanced, Packed.";
    }
  }

  return { assistantMessage, updatedItinerary };
}

/**
 * Call GLM z.AI for chat assistance (replaces OpenAI)
 */
async function maybeCallGLM(env: Env, message: string, itinerary: Itinerary): Promise<string | null> {
  return await callGLM(env, message, itinerary);
}

app.post("/api/chat", async (c) => {
  const { message, itinerary } = chatSchema.parse(await c.req.json()) as { message: string; itinerary: Itinerary };
  const stream = c.req.query("stream") === "true";

  const ruleResult = await runRuleAssistant(c.env, message, itinerary);
  const modelReply = await maybeCallGLM(c.env, message, ruleResult.updatedItinerary ?? itinerary);
  const assistantMessage = modelReply || ruleResult.assistantMessage;

  if (!stream) {
    return c.json({ assistantMessage, updatedItinerary: ruleResult.updatedItinerary });
  }

  const encoder = new TextEncoder();
  const tokenChunks = assistantMessage.split(" ");

  const body = new ReadableStream({
    start(controller) {
      tokenChunks.forEach((token, idx) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "token", value: `${idx === 0 ? "" : " "}${token}` })}\n`));
      });
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "final", updatedItinerary: ruleResult.updatedItinerary })}\n`));
      controller.close();
    }
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store"
    }
  });
});

app.post("/api/share", async (c) => {
  const body = await c.req.json() as { itinerary: Itinerary };
  if (!body?.itinerary) return c.json({ error: "itinerary required" }, 400);

  const slug = `${slugify(body.itinerary.city)}-${crypto.randomUUID().slice(0, 8)}`;
  await c.env.DB.prepare(
    "INSERT INTO shared_itineraries (slug, city, itinerary_json, created_at) VALUES (?1, ?2, ?3, ?4)"
  ).bind(slug, body.itinerary.city, JSON.stringify(body.itinerary), new Date().toISOString()).run();

  const base = c.env.APP_BASE_URL || new URL(c.req.url).origin;
  return c.json({ slug, url: `${base}/api/share/${slug}` });
});

app.get("/api/share/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Validate slug format to prevent SQL injection
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return c.json({ error: "Invalid slug" }, 400);
    }

    const row = await c.env.DB
      .prepare("SELECT itinerary_json FROM shared_itineraries WHERE slug = ?1")
      .bind(slug)
      .first<{ itinerary_json: string }>();

    if (!row) return c.json({ error: "Not found" }, 404);

    return c.json(JSON.parse(row.itinerary_json));
  } catch (error) {
    console.error("Share endpoint error:", error);
    return c.json({ error: "Failed to retrieve itinerary" }, 500);
  }
});

app.get("/api/health", async (c) => {
  const checks: Record<string, boolean | string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "wayfare-ai-worker"
  };

  // Check database connection
  try {
    const result = await c.env.DB.prepare("SELECT 1").first();
    checks.database = !!result;
  } catch (error) {
    checks.database = false;
    checks.database_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Check KV cache connection
  try {
    await c.env.CACHE.put("health-check", "ok", { expirationTtl: 60 });
    const value = await c.env.CACHE.get("health-check");
    checks.cache = value === "ok";
  } catch (error) {
    checks.cache = false;
    checks.cache_error = error instanceof Error ? error.message : "Unknown error";
  }

  // Check external service availability (optional, could slow down health check)
  checks.external_services = true; // Assume true unless we want to actually ping them

  const isHealthy = checks.database === true && checks.cache === true;
  return c.json(checks, isHealthy ? 200 : 503);
});

export default app;



