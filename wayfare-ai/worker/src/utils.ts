import type { Env } from "./types";

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

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
        const jitter = delay * 0.1 * (Math.random() * 2 - 1); // ±10% jitter
        const actualDelay = Math.max(0, delay + jitter);

        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${actualDelay.toFixed(0)}ms`, error);
        await new Promise((resolve) => setTimeout(resolve, actualDelay));
      }
    }
  }

  throw lastError;
}

/**
 * Default retry logic - retry on network errors and 5xx, skip on 4xx (except 429)
 */
function defaultShouldRetry(error: unknown): boolean {
  // Network errors (no response)
  if (!(error instanceof Error)) return false;

  const err = error as any;

  // Fetch API error with status
  if (err.status !== undefined) {
    const status = err.status as number;
    // Retry on 5xx (server errors) and 429 (rate limit)
    // Don't retry on 4xx client errors (except 429)
    return status >= 500 || status === 429;
  }

  // Retry on generic errors that might be network-related
  return true;
}

export async function withCache<T>(env: Env, key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
  const cached = await env.CACHE.get(key, "json");
  if (cached) return cached as T;
  const value = await producer();
  await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
  return value;
}

export async function rateLimit(env: Env, ip: string) {
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS || "60");
  const maxRequests = Number(env.RATE_LIMIT_MAX_REQUESTS || "80");
  const key = cacheKey("rl", ip, Math.floor(Date.now() / 1000 / windowSeconds));
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

/**
 * Call GLM z.AI API for chat completion
 * @param env - Cloudflare environment bindings
 * @param message - User message
 * @param itinerary - Current itinerary context (optional)
 * @returns AI response text or null on failure
 */
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
    const response = await withRetry(
      async () => {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GLM_API_KEY}`
          },
          signal: AbortSignal.timeout(30000), // 30s timeout
          body: JSON.stringify({
            model: env.GLM_MODEL || "glm-4.7",
            temperature: 0.3,
            max_tokens: 2000,
            messages: [
              {
                role: "system",
                content: "You are Wayfare Assistant, a travel planning AI. Help users plan and modify their travel itineraries. Provide helpful suggestions about attractions, restaurants, and activities. Never invent locations - only use data from the provided itinerary. Be concise and practical."
              },
              {
                role: "user",
                content: itinerary
                  ? `Message: ${message}\n\nCurrent Itinerary:\n${JSON.stringify(itinerary, null, 2)}`
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

    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("GLM API call failed:", error);
    return null;
  }
}

/**
 * Call GLM z.AI API for itinerary generation
 * @param env - Cloudflare environment bindings
 * @param request - Plan request details
 * @returns Generated itinerary text or null on failure
 */
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
    const response = await withRetry(
      async () => {
        const res = await fetch(`${env.GLM_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GLM_API_KEY}`
          },
          signal: AbortSignal.timeout(60000), // 60s timeout for longer generation
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

                Include real attractions, restaurants, and activities in ${request.city}. Focus on must-see places first.`
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

    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("GLM itinerary generation failed:", error);
    return null;
  }
}

