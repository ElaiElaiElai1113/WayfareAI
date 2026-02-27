import type { Itinerary, PlanRequest, ShareResponse } from "@/types/itinerary";

async function safeJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
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
      if (parsed.type === "token" && parsed.value) {
        onChunk(parsed.value);
      }
      if (parsed.type === "final") {
        updatedItinerary = parsed.updatedItinerary;
      }
    }
  }

  return { updatedItinerary };
}

