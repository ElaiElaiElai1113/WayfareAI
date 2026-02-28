import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Itinerary, Stop } from "@/types/itinerary";
import { postChat } from "@/lib/api";

function StopRow({ stop, index, onSwap }: { stop: Stop; index: number; onSwap: (stop: Stop) => void }) {
  return (
    <div className="group relative pl-8 border-l-2 border-dashed border-primary/30">
      <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-4 border-white ${index === 0 ? "bg-primary" : "bg-primary/40"}`}></div>
      <div className="glass-card rounded-2xl p-5 flex items-start justify-between group-hover:shadow-xl transition-all backdrop-blur-md bg-white/70 border border-white/30">
        <div className="flex gap-4">
          <div className="size-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
            <div className="w-full h-full flex items-center justify-center bg-slate-200">
              <span className="material-symbols-outlined text-3xl text-slate-400">{stop.category === "Nature" ? "landscape" : stop.category === "Foodie" ? "restaurant" : "museum"}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                {stop.startTime} - {(() => {
                  const [hours, minutes] = stop.startTime.split(":").map(Number);
                  const endMinutes = hours * 60 + minutes + stop.durationMinutes;
                  const endHours = Math.floor(endMinutes / 60);
                  const endMins = endMinutes % 60;
                  return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
                })()}
              </span>
              <span className="material-symbols-outlined text-sm text-slate-400">{stop.category === "Nature" ? "landscape" : stop.category === "Foodie" ? "restaurant" : "museum"}</span>
            </div>
            <h3 className="text-lg font-bold">{stop.name}</h3>
            <p className="text-sm text-slate-500 line-clamp-2">{stop.notes || "Explore this amazing location."}</p>
          </div>
        </div>
        <button
          onClick={() => onSwap(stop)}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 p-2 rounded-lg text-xs font-bold flex items-center gap-1 text-slate-600 hover:bg-slate-200"
        >
          <span className="material-symbols-outlined text-sm">swap_horiz</span>
          Swap
        </button>
      </div>
    </div>
  );
}

export function TimelinePanel({ itinerary, onUpdate }: { itinerary: Itinerary | null; onUpdate: (itinerary: Itinerary) => void }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [swapping, setSwapping] = useState(false);

  const runningTotal = useMemo(() => itinerary?.days.reduce((acc, day) => acc + day.dayCost, 0) ?? 0, [itinerary]);

  if (!itinerary) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center">
        <div className="relative mb-8 group">
          <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all"></div>
          <div className="relative size-64 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
              <span className="material-symbols-outlined text-6xl text-primary/50">flight_takeoff</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent"></div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Your adventure starts here.</h1>
        <p className="text-slate-500 text-sm max-w-[280px] leading-relaxed mb-8">
          Enter your destination and preferences to begin crafting your perfect journey.
        </p>
      </div>
    );
  }

  const replanDay = async (dayNumber: number) => {
    const request = {
      city: itinerary.city,
      days: itinerary.days.length,
      dailyStartTime: itinerary.days[0]?.stops[0]?.startTime ?? "09:00",
      dailyEndTime: "20:00",
      budget: itinerary.totalEstimatedCost,
      currency: itinerary.currency,
      travelStyle: "Balanced" as const,
      transportMode: "walking" as const,
      mustSee: [],
      preferences: itinerary.preferences,
      rainPlan: false,
      budgetSaver: false
    };

    const refreshed = await postChat({ message: `replan_day(${dayNumber})`, itinerary, preferences: itinerary.preferences });
    if (refreshed.updatedItinerary) {
      onUpdate(refreshed.updatedItinerary);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Swap Modal */}
      <Modal open={swapOpen} onOpenChange={setSwapOpen} title="Nearby Alternatives">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Swap your current stop at <strong>{selectedStop?.name}</strong> with these options</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary text-white px-4 text-sm font-medium">
              <span className="material-symbols-outlined text-lg">filter_list</span>
              All
            </button>
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/80 border border-slate-200 px-4 text-sm font-medium hover:bg-white">
              Cafes
            </button>
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/80 border border-slate-200 px-4 text-sm font-medium hover:bg-white">
              Museums
            </button>
            <button className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/80 border border-slate-200 px-4 text-sm font-medium hover:bg-white">
              Parks
            </button>
          </div>
          <div className="space-y-4 max-h-64 overflow-y-auto">
            <div className="flex items-center gap-4 bg-white/60 p-4 rounded-lg border border-white hover:border-primary/30 transition-all shadow-sm">
              <div className="w-24 h-24 rounded-lg bg-slate-200 flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-slate-400">local_cafe</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">Cafe</span>
                  <span className="text-xs text-slate-500">• 0.5 km away</span>
                </div>
                <h3 className="font-bold text-slate-900 truncate">Artisanal Brew House</h3>
                <p className="text-primary font-semibold text-sm mt-1">₱200 est.</p>
              </div>
              <button
                onClick={async () => {
                  if (!itinerary || !selectedStop) return;
                  setSwapping(true);
                  try {
                    const result = await postChat({ message: `swap_stop(${selectedStop.id})`, itinerary, preferences: itinerary.preferences });
                    if (result.updatedItinerary) onUpdate(result.updatedItinerary);
                    setSwapOpen(false);
                  } finally {
                    setSwapping(false);
                  }
                }}
                disabled={swapping}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">sync</span>
                {swapping ? "Swapping..." : "Replace"}
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-200/50">
            <button
              onClick={() => setSwapOpen(false)}
              className="px-6 py-2 rounded-lg text-slate-600 font-medium hover:bg-white/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {itinerary.days.map((day) => (
        <div key={day.dayNumber}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              Day {day.dayNumber}: {day.explanation.split(" ").slice(0, 3).join(" ")}
              <span className="text-slate-400 font-medium text-lg">{day.date}</span>
            </h2>
            <button
              onClick={() => replanDay(day.dayNumber)}
              className="p-2 hover:bg-white/40 rounded-full text-slate-400 transition-colors"
            >
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          </div>

          {day.stops.map((stop, index) => (
            <div key={stop.id} className="mb-4">
              <StopRow stop={stop} index={index} onSwap={(selected) => { setSelectedStop(selected); setSwapOpen(true); }} />
              {index < day.stops.length - 1 && (
                <div className="flex items-center gap-3 py-2 px-8">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white/40 border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span className="material-symbols-outlined text-xs">directions_car</span>
                    {stop.travelMinutesFromPrev}m Travel Time
                  </div>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between mt-6 p-4 glass-card rounded-xl backdrop-blur-md bg-white/60 border border-white/20">
            <Badge variant="success" className="text-sm">Day cost: {itinerary.currency} {day.dayCost.toFixed(0)}</Badge>
            <Button size="sm" variant="secondary" onClick={() => replanDay(day.dayNumber)}>Replan Day</Button>
          </div>

          {day.dayNumber < itinerary.days.length && <div className="h-8"></div>}
        </div>
      ))}
    </div>
  );
}
