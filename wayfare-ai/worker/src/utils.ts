import type { Env } from "./types";

export function cacheKey(...parts: Array<string | number>) {
  return parts.join(":");
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

