import { Hono } from "hono";
import { z } from "zod";
import { createItinerary, fetchNearbyPois, applyBudgetAdjustment, applyPaceChange } from "../lib/engine";
import type { Env, Itinerary, PlanRequest } from "./types";
import { cacheKey, rateLimit, slugify, withCache } from "./utils";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const limited = await rateLimit(c.env, ip);
  if (!limited.ok) {
    return c.json({ error: "Rate limit exceeded" }, 429);
  }
  await next();
});

app.get("/api/geocode", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json([], 200);

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const result = await withCache(c.env, cacheKey("geo-autocomplete", q), ttl, async () => {
    const url = `${c.env.NOMINATIM_BASE_URL}/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const response = await fetch(url, { headers: { "User-Agent": "WayfareAI/1.0" } });
    const data = await response.json() as Array<any>;
    return data.map((item) => ({
      name: item.display_name,
      bbox: [Number(item.boundingbox[2]), Number(item.boundingbox[0]), Number(item.boundingbox[3]), Number(item.boundingbox[1])],
      center: [Number(item.lon), Number(item.lat)]
    }));
  });

  return c.json(result);
});

app.get("/api/pois", async (c) => {
  const bbox = c.req.query("bbox");
  if (!bbox) return c.json({ error: "bbox query required" }, 400);

  const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
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
    const response = await fetch(c.env.OVERPASS_BASE_URL, { method: "POST", body: query });
    return response.json();
  });

  return c.json(data);
});

app.get("/api/osrm/table", async (c) => {
  const profile = c.req.query("profile") || "walking";
  const coordinates = c.req.query("coordinates");
  if (!coordinates) return c.json({ error: "coordinates required" }, 400);

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const data = await withCache(c.env, cacheKey("osrm-table-route", profile, coordinates.slice(0, 300)), ttl, async () => {
    const url = `${c.env.OSRM_BASE_URL}/table/v1/${profile}/${coordinates}?annotations=duration`;
    const response = await fetch(url);
    return response.json();
  });

  return c.json(data);
});

app.get("/api/osrm/route", async (c) => {
  const profile = c.req.query("profile") || "walking";
  const coordinates = c.req.query("coordinates");
  if (!coordinates) return c.json({ error: "coordinates required" }, 400);

  const ttl = Number(c.env.CACHE_TTL_SECONDS || "21600");
  const data = await withCache(c.env, cacheKey("osrm-route-route", profile, coordinates.slice(0, 300)), ttl, async () => {
    const url = `${c.env.OSRM_BASE_URL}/route/v1/${profile}/${coordinates}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    return response.json();
  });

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
  budgetSaver: z.boolean()
});

app.post("/api/plan", async (c) => {
  const payload = planSchema.parse(await c.req.json()) as PlanRequest;
  const itinerary = await createItinerary(c.env, payload);
  return c.json(itinerary);
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
    const clone = structuredClone(itinerary);
    const targetDay = clone.days.find((d) => d.dayNumber === day);
    if (!targetDay) {
      assistantMessage = `Day ${day} was not found in your itinerary.`;
    } else {
      targetDay.stops = [...targetDay.stops].reverse();
      targetDay.explanation = `Replanned Day ${day} with a reversed stop order to reduce backtracking from your current list.`;
      updatedItinerary = clone;
      assistantMessage = `Day ${day} has been replanned.`;
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
        day.stops[idx] = {
          ...stop,
          name: replacement.name,
          category: replacement.category,
          lat: replacement.lat,
          lon: replacement.lon,
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

async function maybeCallOpenAI(env: Env, message: string, itinerary: Itinerary): Promise<string | null> {
  if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL) return null;

  const response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You are Wayfare Assistant. Never invent POIs. Only use itinerary stops and provided data."
        },
        {
          role: "user",
          content: `Message: ${message}\nItinerary: ${JSON.stringify(itinerary).slice(0, 9000)}`
        }
      ]
    })
  });

  if (!response.ok) return null;
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? null;
}

app.post("/api/chat", async (c) => {
  const { message, itinerary } = chatSchema.parse(await c.req.json()) as { message: string; itinerary: Itinerary };
  const stream = c.req.query("stream") === "true";

  const ruleResult = await runRuleAssistant(c.env, message, itinerary);
  const modelReply = await maybeCallOpenAI(c.env, message, ruleResult.updatedItinerary ?? itinerary);
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
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare("SELECT itinerary_json FROM shared_itineraries WHERE slug = ?1").bind(slug).first<{ itinerary_json: string }>();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(JSON.parse(row.itinerary_json));
});

app.get("/api/health", (c) => c.json({ ok: true, service: "wayfare-ai-worker" }));

export default app;

