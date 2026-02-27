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
  notes?: string;
};

export type DayPlan = {
  dayNumber: number;
  date: string;
  routeGeometry?: [number, number][];
  stops: Stop[];
  dayCost: number;
  explanation: string;
};

export type Itinerary = {
  city: string;
  bbox: BBox;
  center: [number, number];
  currency: string;
  totalEstimatedCost: number;
  days: DayPlan[];
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
};

export type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
  OSRM_BASE_URL: string;
  NOMINATIM_BASE_URL: string;
  OVERPASS_BASE_URL: string;
  CACHE_TTL_SECONDS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  APP_BASE_URL?: string;
};

