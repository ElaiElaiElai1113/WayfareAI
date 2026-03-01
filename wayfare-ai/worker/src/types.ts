export type TravelStyle = "Relaxed" | "Balanced" | "Packed";
export type TransportMode = "walking" | "driving";

export type BBox = [number, number, number, number];

export type GeocodeResult = {
  name: string;
  bbox: BBox;
  center: [number, number];
};

export type Poi = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  sourceTags: Record<string, string>;
};

export type Stop = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  startTime: string;
  durationMinutes: number;
  travelMinutesFromPrev: number;
  estimatedCost: number;
  tags?: Record<string, string>;
  address?: string;
  website?: string;
  opening_hours?: string;
  cuisine?: string;
  wikipedia?: string;
  wikidata?: string;
  notes?: string;
};

export type DayPlan = {
  dayNumber: number;
  date: string;
  title?: string;
  routeGeometry?: [number, number][];
  stops: Stop[];
  dayCost: number;
  totalCost?: number;
  energyScore?: number;
  energyLevel?: "Light" | "Moderate" | "High";
  explanation: string;
};

export type Itinerary = {
  city: string;
  bbox: BBox;
  center: [number, number];
  currency: string;
  totalEstimatedCost: number;
  days: DayPlan[];
  tripSummary?: {
    totalEstimatedCost: number;
    totalWalkingDistance: number;
    travelTimeTotal: number;
    diversityScore: number;
  };
  preferences: Record<string, boolean>;
  generatedAt: string;
};

export type PlanRequest = {
  city: string;
  dateFrom?: string;
  dateTo?: string;
  days?: number;
  dailyStartTime: string;
  dailyEndTime: string;
  budget: number;
  currency: string;
  travelStyle: TravelStyle;
  transportMode: TransportMode;
  mustSee: string[];
  preferences: Record<string, boolean>;
  rainPlan: boolean;
  budgetSaver: boolean;
  useAI?: boolean; // Enable AI-powered itinerary enrichment
};

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
  REQUEST_METRICS?: KVNamespace;
  OSRM_BASE_URL: string;
  NOMINATIM_BASE_URL: string;
  OVERPASS_BASE_URL: string;
  CACHE_TTL_SECONDS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  GLM_BASE_URL?: string;
  GLM_API_KEY?: string;
  GLM_MODEL?: string;
  APP_BASE_URL?: string;
  ALLOWED_ORIGINS?: string;
};

/**
 * Validate that all required environment variables are present
 * @throws Error if required variables are missing
 */
export function validateEnv(env: Env): void {
  const required: (keyof Env)[] = [
    "DB",
    "CACHE",
    "RATE_LIMIT",
    "OSRM_BASE_URL",
    "NOMINATIM_BASE_URL",
    "OVERPASS_BASE_URL",
    "CACHE_TTL_SECONDS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "RATE_LIMIT_MAX_REQUESTS"
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (env[key] === undefined || env[key] === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `Please configure these in wrangler.toml or Cloudflare dashboard.`
    );
  }

  // Validate URL formats
  const urlKeys: (keyof Env)[] = [
    "OSRM_BASE_URL",
    "NOMINATIM_BASE_URL",
    "OVERPASS_BASE_URL",
    "OPENAI_BASE_URL",
    "APP_BASE_URL"
  ];

  for (const key of urlKeys) {
    const value = env[key];
    if (value && !isValidUrl(value)) {
      throw new Error(`Invalid URL format for ${key}: ${value}`);
    }
  }

  // Validate numeric values
  const numericKeys: (keyof Env)[] = [
    "CACHE_TTL_SECONDS",
    "RATE_LIMIT_WINDOW_SECONDS",
    "RATE_LIMIT_MAX_REQUESTS"
  ];

  for (const key of numericKeys) {
    const value = Number(env[key]);
    if (isNaN(value) || value < 0) {
      throw new Error(`Invalid value for ${key}: ${env[key]}. Must be a positive number.`);
    }
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
