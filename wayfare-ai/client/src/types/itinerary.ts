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
  bbox: [number, number, number, number];
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

export type ShareResponse = {
  slug: string;
  url: string;
};

