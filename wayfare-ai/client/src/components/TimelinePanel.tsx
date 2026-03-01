import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import type { Itinerary, Stop, StopDescription } from "@/types/itinerary";
import { postChat, postDescribeStop } from "@/lib/api";

type DescriptionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: StopDescription }
  | { status: "error"; message: string };

const DESCRIPTION_CACHE_KEY = "wayfare.stopDescriptions.v1";

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c.includes("park") || c.includes("nature") || c.includes("viewpoint")) return "landscape";
  if (c.includes("cafe") || c.includes("restaurant") || c.includes("food")) return "restaurant";
  if (c.includes("nightlife") || c.includes("bar") || c.includes("pub")) return "nightlife";
  return "museum";
}

function formatTimeRange(start: string, durationMinutes: number) {
  const [hours, minutes] = start.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${start} - ${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
}

function readCache(): Record<string, StopDescription> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DESCRIPTION_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StopDescription>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, StopDescription>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESCRIPTION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage write failures.
  }
}

function descriptionKey(city: string, dayNumber: number, stop: Stop) {
  return `${city.toLowerCase()}|${dayNumber}|${stop.id}|${stop.name.toLowerCase()}`;
}

function confidenceClass(confidence: StopDescription["confidence"]) {
  if (confidence === "high") return "bg-green-100 text-green-700";
  if (confidence === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function StopRow({
  stop,
  index,
  expanded,
  descriptionState,
  onToggleExpand,
  onSwap
}: {
  stop: Stop;
  index: number;
  expanded: boolean;
  descriptionState: DescriptionState;
  onToggleExpand: () => void;
  onSwap: (stop: Stop) => void;
}) {
  const description = descriptionState.status === "loaded" ? descriptionState.data : null;

  return (
    <div className="group relative pl-8 border-l-2 border-dashed border-primary/30">
      <div className={`absolute -left-[9px] top-0 size-4 rounded-full border-4 border-white ${index === 0 ? "bg-primary" : "bg-primary/40"}`}></div>
      <div className="glass-card rounded-2xl p-5 backdrop-blur-md bg-white/70 border border-white/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 min-w-0">
            <div className="size-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
              <div className="w-full h-full flex items-center justify-center bg-slate-200">
                <span className="material-symbols-outlined text-3xl text-slate-400">{categoryIcon(stop.category)}</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-black text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                  {formatTimeRange(stop.startTime, stop.durationMinutes)}
                </span>
                <span className="material-symbols-outlined text-sm text-slate-400">{categoryIcon(stop.category)}</span>
              </div>
              <h3 className="text-lg font-bold">{stop.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{stop.notes || "Explore this stop in your route flow."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleExpand}
              className="bg-white/70 border border-slate-200 p-2 rounded-lg text-xs font-bold flex items-center gap-1 text-slate-600 hover:bg-white"
            >
              <span className="material-symbols-outlined text-sm">{expanded ? "expand_less" : "expand_more"}</span>
              {expanded ? "Hide" : "Details"}
            </button>
            <button
              onClick={() => onSwap(stop)}
              className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 p-2 rounded-lg text-xs font-bold flex items-center gap-1 text-slate-600 hover:bg-slate-200"
            >
              <span className="material-symbols-outlined text-sm">swap_horiz</span>
              Swap
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3">
            {descriptionState.status === "loading" && (
              <div className="space-y-3">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-3.5 w-24 mt-2" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-3.5 w-20 mt-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            {descriptionState.status === "error" && (
              <p className="text-sm text-slate-500">Description unavailable right now. {descriptionState.message}</p>
            )}

            {description && (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">AI Place Description</p>
                  <Badge className={confidenceClass(description.confidence)}>Confidence: {description.confidence}</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">About</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{description.about}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Why It Fits</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{description.why_this_stop}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Quick Tip</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{description.quick_tip}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TimelinePanel({ itinerary, onUpdate }: { itinerary: Itinerary | null; onUpdate: (itinerary: Itinerary) => void }) {
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());
  const [descriptionStates, setDescriptionStates] = useState<Record<string, DescriptionState>>(() => {
    const cache = readCache();
    return Object.fromEntries(
      Object.entries(cache).map(([key, value]) => [key, { status: "loaded", data: value } as DescriptionState])
    );
  });

  const runningTotal = useMemo(() => itinerary?.days.reduce((acc, day) => acc + day.dayCost, 0) ?? 0, [itinerary]);

  const loadDescription = async (city: string, dayNumber: number, stop: Stop) => {
    const key = descriptionKey(city, dayNumber, stop);
    const current = descriptionStates[key];
    if (current?.status === "loading" || current?.status === "loaded") return;

    setDescriptionStates((prev) => ({ ...prev, [key]: { status: "loading" } }));

    try {
      const description = await postDescribeStop({
        stop,
        tripContext: {
          city,
          dayNumber
        },
        tone: "premium"
      });

      setDescriptionStates((prev) => {
        const next = { ...prev, [key]: { status: "loaded", data: description } as DescriptionState };
        const cache: Record<string, StopDescription> = {};
        Object.entries(next).forEach(([k, value]) => {
          if (value.status === "loaded") cache[k] = value.data;
        });
        writeCache(cache);
        return next;
      });
    } catch (error) {
      setDescriptionStates((prev) => ({
        ...prev,
        [key]: {
          status: "error",
          message: error instanceof Error ? error.message : "Request failed"
        }
      }));
    }
  };

  const loadDayDescriptions = async (city: string, dayNumber: number, stops: Stop[]) => {
    await Promise.all(stops.map((stop) => loadDescription(city, dayNumber, stop)));
  };

  useEffect(() => {
    if (!itinerary?.days.length) return;
    const firstDay = itinerary.days[0];
    void loadDayDescriptions(itinerary.city, firstDay.dayNumber, firstDay.stops);
  }, [itinerary?.generatedAt]);

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
    const refreshed = await postChat({ message: `replan_day(${dayNumber})`, itinerary, preferences: itinerary.preferences });
    if (refreshed.updatedItinerary) {
      onUpdate(refreshed.updatedItinerary);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
                  <span className="text-xs text-slate-500">0.5 km away</span>
                </div>
                <h3 className="font-bold text-slate-900 truncate">Artisanal Brew House</h3>
                <p className="text-primary font-semibold text-sm mt-1">PHP 200 est.</p>
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

      {itinerary.days.map((day) => {
        const dayExpanded = expandedDays.has(day.dayNumber);
        return (
          <div key={day.dayNumber} className="glass-card rounded-2xl p-4 md:p-5 border border-white/40 bg-white/60">
            <div className="flex items-center justify-between mb-2">
              <button
                className="text-left"
                onClick={async () => {
                  const opening = !expandedDays.has(day.dayNumber);
                  setExpandedDays((prev) => {
                    const next = new Set(prev);
                    if (next.has(day.dayNumber)) next.delete(day.dayNumber);
                    else next.add(day.dayNumber);
                    return next;
                  });
                  if (opening) {
                    await loadDayDescriptions(itinerary.city, day.dayNumber, day.stops);
                  }
                }}
              >
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  Day {day.dayNumber}: {day.explanation.split(" ").slice(0, 3).join(" ")}
                  <span className="text-slate-400 font-medium text-lg">{day.date}</span>
                </h2>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => replanDay(day.dayNumber)}
                  className="p-2 hover:bg-white/40 rounded-full text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
                <button
                  onClick={async () => {
                    const opening = !expandedDays.has(day.dayNumber);
                    setExpandedDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(day.dayNumber)) next.delete(day.dayNumber);
                      else next.add(day.dayNumber);
                      return next;
                    });
                    if (opening) {
                      await loadDayDescriptions(itinerary.city, day.dayNumber, day.stops);
                    }
                  }}
                  className="p-2 hover:bg-white/40 rounded-full text-slate-500 transition-colors"
                >
                  <span className="material-symbols-outlined">{dayExpanded ? "expand_less" : "expand_more"}</span>
                </button>
              </div>
            </div>

            {!dayExpanded && (
              <p className="text-sm text-slate-500 mt-1">{day.stops.length} stops • {itinerary.currency} {day.dayCost.toFixed(0)}</p>
            )}

            {dayExpanded && (
              <>
                {day.stops.map((stop, index) => {
                  const key = descriptionKey(itinerary.city, day.dayNumber, stop);
                  const stopExpanded = expandedStops.has(key);
                  const state = descriptionStates[key] ?? { status: "idle" };

                  return (
                    <div key={stop.id} className="mb-4">
                      <StopRow
                        stop={stop}
                        index={index}
                        expanded={stopExpanded}
                        descriptionState={state}
                        onToggleExpand={async () => {
                          const opening = !expandedStops.has(key);
                          setExpandedStops((prev) => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            return next;
                          });
                          if (opening) {
                            await loadDescription(itinerary.city, day.dayNumber, stop);
                          }
                        }}
                        onSwap={(selected) => { setSelectedStop(selected); setSwapOpen(true); }}
                      />
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
                  );
                })}

                <div className="flex items-center justify-between mt-6 p-4 glass-card rounded-xl backdrop-blur-md bg-white/60 border border-white/20">
                  <Badge variant="success" className="text-sm">Day cost: {itinerary.currency} {day.dayCost.toFixed(0)}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => replanDay(day.dayNumber)}>Replan Day</Button>
                </div>
              </>
            )}

            {day.dayNumber < itinerary.days.length && <div className="h-3"></div>}
          </div>
        );
      })}

      <div className="text-right text-xs text-slate-500 font-semibold">Trip running total: {itinerary.currency} {runningTotal.toFixed(0)}</div>
    </div>
  );
}
