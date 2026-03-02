import type { Env } from "./types";
import { formatItineraryExamplesForPrompt, selectRelevantItineraryExamples } from "./itinerary-examples";

export function cacheKey(...parts: Array<string | number>) {
  return parts.join(":");
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @param maxDelay - Maximum delay in ms (default: 30000)
 * @returns Result of the function
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    shouldRetry = defaultShouldRetry
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error)) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
        const jitter = delay * 0.1 * (Math.random() * 2 - 1);
        const actualDelay = Math.max(0, delay + jitter);

        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${actualDelay.toFixed(0)}ms`, error);
        await new Promise((resolve) => setTimeout(resolve, actualDelay));
      }
    }
  }

  throw lastError;
}

function defaultShouldRetry(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as any;
  if (err.status !== undefined) {
    const status = err.status as number;
    return status >= 500 || status === 429;
  }

  return true;
}

export async function withCache<T>(env: Env, key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
  const cached = await env.CACHE.get(key, "json");
  if (cached) return cached as T;
  const value = await producer();
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}

export async function rateLimit(
  env: Env,
  ip: string,
  scope = "global",
  maxRequests = Number(env.RATE_LIMIT_MAX_REQUESTS || "80"),
  windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS || "60")
) {
  const key = cacheKey("rl", scope, ip, Math.floor(Date.now() / 1000 / windowSeconds));
  const current = Number((await env.RATE_LIMIT.get(key)) || "0") + 1;
  await env.RATE_LIMIT.put(key, String(current), { expirationTtl: windowSeconds + 5 });

  return {
    ok: current <= maxRequests,
    current,
    maxRequests
  };
}

export function parseOsrmCoordinates(value?: string): [number, number][] {
  if (!value) return [];
  const tuples = value.split(";").map((pair) => pair.split(",").map(Number));
  return tuples.filter((coords) => coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) as [number, number][];
}

export function toTime(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = String(Math.floor(normalized / 60)).padStart(2, "0");
  const m = String(normalized % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function fromTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function summarizeItineraryForModel(itinerary: unknown) {
  if (!itinerary || typeof itinerary !== "object") return itinerary;
  const it = itinerary as any;
  return {
    city: it.city,
    currency: it.currency,
    totalEstimatedCost: it.totalEstimatedCost,
    days: Array.isArray(it.days)
      ? it.days.map((day: any) => ({
        dayNumber: day.dayNumber,
        date: day.date,
        dayCost: day.dayCost,
        stops: Array.isArray(day.stops)
          ? day.stops.map((s: any) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            startTime: s.startTime,
            durationMinutes: s.durationMinutes
          }))
          : []
      }))
      : []
  };
}

export async function callGLM(
  env: Env,
  message: string,
  itinerary?: unknown
): Promise<string | null> {
  if (!env.GLM_API_KEY || !env.GLM_BASE_URL) {
    console.log("GLM API credentials not configured");
    return null;
  }

  try {
    const itinerarySummary = summarizeItineraryForModel(itinerary);
    const city = itinerarySummary && typeof itinerarySummary === "object" ? (itinerarySummary as any).city : undefined;
    const examples = selectRelevantItineraryExamples({ city, message });
    const exampleGuide = formatItineraryExamplesForPrompt(examples);

    const response = await withRetry(
      async () => {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GLM_API_KEY}`
          },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({
            model: env.GLM_MODEL || "glm-4.7",
            temperature: 0.3,
            max_tokens: 2000,
            messages: [
              {
                role: "system",
                content: `You are Wayfare Assistant, a travel planning AI.
Help users plan and modify their itineraries.
Use sample itinerary patterns only for pacing/style guidance.
Never copy or invent POIs not present in provided user itinerary data.
Never invent prices, ratings, or historical claims.

Relevant sample style patterns:
${exampleGuide}`
              },
              {
                role: "user",
                content: itinerarySummary
                  ? `Message: ${message}\n\nCurrent Itinerary:\n${JSON.stringify(itinerarySummary, null, 2)}`
                  : message
              }
            ]
          })
        });

        if (!res.ok) {
          const error = new Error(`GLM API error: ${res.status}`);
          (error as any).status = res.status;
          throw error;
        }

        return await res.json();
      },
      { maxRetries: 2, baseDelay: 2000 }
    );

    return response.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("GLM API call failed:", error);
    return null;
  }
}

export async function callGLMForItinerary(
  env: Env,
  request: {
    city: string;
    days: number;
    budget: number;
    currency: string;
    travelStyle: string;
    preferences: Record<string, boolean>;
    mustSee: string[];
  }
): Promise<string | null> {
  if (!env.GLM_API_KEY || !env.GLM_BASE_URL) {
    console.log("GLM API credentials not configured");
    return null;
  }

  try {
    const examples = selectRelevantItineraryExamples({
      city: request.city,
      style: request.travelStyle,
      budget: request.budget
    });
    const exampleGuide = formatItineraryExamplesForPrompt(examples);

    const response = await withRetry(
      async () => {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GLM_API_KEY}`
          },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            model: env.GLM_MODEL || "glm-4.7",
            temperature: 0.5,
            max_tokens: 4000,
            messages: [
              {
                role: "system",
                content: `You are Wayfare AI, a travel itinerary planner. Create ${request.days}-day itineraries for ${request.city}.
Budget: ${request.currency} ${request.budget}
Style: ${request.travelStyle}
Preferences: ${Object.entries(request.preferences)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}=${v}`)
  .join(", ")}
Must-see: ${request.mustSee.join(", ")}

Return JSON in this exact format:
{
  "stops": [
    {"name": "Attraction Name", "category": "Museum", "durationMinutes": 60},
    {"name": "Restaurant Name", "category": "Restaurant", "durationMinutes": 45}
  ]
}

Prioritize attractions (museums, viewpoints, parks, beaches, cultural sites) over restaurants. Include meals naturally - only 1-2 per day, not every stop. Mix different stop types. Create diverse itineraries in ${request.city}. Focus on must-see places first.
Use the sample patterns below only for day pacing and structure, not as factual POI truth.

${exampleGuide}`
              },
              {
                role: "user",
                content: `Plan a ${request.days}-day itinerary for ${request.city} with budget ${request.currency} ${request.budget}. Travel style: ${request.travelStyle}. Must include: ${request.mustSee.join(", ") || "suggested attractions"}`
              }
            ]
          })
        });

        if (!res.ok) {
          const error = new Error(`GLM API error: ${res.status}`);
          (error as any).status = res.status;
          throw error;
        }

        return await res.json();
      },
      { maxRetries: 2, baseDelay: 3000 }
    );

    return response.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("GLM itinerary generation failed:", error);
    return null;
  }
}
