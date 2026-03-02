export type TravelStyle = "Relaxed" | "Balanced" | "Packed";
export type TransportMode = "walking" | "driving";

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

export type StopDescription = {
  about: string;
  why_this_stop: string;
  quick_tip: string;
  confidence: "high" | "medium" | "low";
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
  bbox: [number, number, number, number];
  center: [number, number];
  currency: string;
  totalEstimatedCost: number;
  days: DayPlan[];
  generationDiagnostics?: {
    requestedDays: number;
    generatedDays: number;
    skippedDays: number;
    skipCounts: Record<string, number>;
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
  useAI?: boolean;
};

export type ShareResponse = {
  slug: string;
  url: string;
};
