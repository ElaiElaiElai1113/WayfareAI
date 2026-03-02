import { z } from "zod";
import type { Itinerary, PlanRequest, ShareResponse, Stop, StopDescription } from "@/types/itinerary";

const stopDescriptionSchema = z.object({
  about: z.string().min(1).max(400),
  why_this_stop: z.string().min(1).max(300),
  quick_tip: z.string().min(1).max(220),
  confidence: z.enum(["high", "medium", "low"])
}).strict();

function sanitizeText(input: string) {
  return input.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
}

async function safeJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    if (text) {
      let parsed: { error?: string; details?: string } | null = null;
      try {
        parsed = JSON.parse(text) as { error?: string; details?: string };
      } catch {
        parsed = null;
      }
      if (parsed?.details) throw new Error(parsed.details);
      if (parsed?.error) throw new Error(parsed.error);
      throw new Error(text);
    }
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export async function geocode(query: string) {
  const url = `${getApiBase()}/api/geocode?q=${encodeURIComponent(query)}`;
  return safeJson<Array<{ name: string; bbox: [number, number, number, number]; center: [number, number] }>>(await fetch(url));
}

export async function postPlan(payload: PlanRequest) {
  return safeJson<Itinerary>(await fetch(`${getApiBase()}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }));
}

export async function postShare(itinerary: Itinerary) {
  return safeJson<ShareResponse>(await fetch(`${getApiBase()}/api/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itinerary })
  }));
}

export async function postChat(payload: { message: string; itinerary: Itinerary; preferences?: Record<string, boolean> }) {
  return safeJson<{ assistantMessage: string; updatedItinerary?: Itinerary }>(
    await fetch(`${getApiBase()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
}

export async function streamChat(payload: { message: string; itinerary: Itinerary; preferences?: Record<string, boolean> }, onChunk: (chunk: string) => void) {
  const response = await fetch(`${getApiBase()}/api/chat?stream=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok || !response.body) {
    const fallback = await response.text();
    throw new Error(fallback || "Chat request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let updatedItinerary: Itinerary | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const parts = buffered.split("\n");
    buffered = parts.pop() ?? "";

    for (const line of parts) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as { type: "token" | "final"; value?: string; updatedItinerary?: Itinerary };
      if (parsed.type === "token" && parsed.value) onChunk(parsed.value);
      if (parsed.type === "final") updatedItinerary = parsed.updatedItinerary;
    }
  }

  return { updatedItinerary };
}

export async function postDescribeStop(payload: {
  stop: Stop;
  tripContext?: {
    city?: string;
    dayNumber?: number;
    travelStyle?: string;
    preferences?: Record<string, boolean>;
  };
  tone?: "premium" | "friendly" | "concise";
}) {
  const stopPayload = {
    id: payload.stop.id,
    name: payload.stop.name,
    category: payload.stop.category,
    lat: payload.stop.lat,
    lon: payload.stop.lon,
    tags: payload.stop.tags,
    address: payload.stop.address,
    website: payload.stop.website,
    opening_hours: payload.stop.opening_hours,
    cuisine: payload.stop.cuisine,
    wikipedia: payload.stop.wikipedia,
    wikidata: payload.stop.wikidata
  };

  const raw = await safeJson<StopDescription>(
    await fetch(`${getApiBase()}/api/describe-stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stop: stopPayload,
        tripContext: payload.tripContext,
        tone: payload.tone
      })
    })
  );

  const parsed = stopDescriptionSchema.parse(raw);
  return {
    about: sanitizeText(parsed.about),
    why_this_stop: sanitizeText(parsed.why_this_stop),
    quick_tip: sanitizeText(parsed.quick_tip),
    confidence: parsed.confidence
  };
}
