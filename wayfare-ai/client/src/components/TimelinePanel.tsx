import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryIcon, getCategoryColor } from "@/lib/category-icons";
import type { Itinerary, Stop } from "@/types/itinerary";
import { postChat, postPlan } from "@/lib/api";

function StopRow({ stop, index, onSwap }: { stop: Stop; index: number; onSwap: (stop: Stop) => void }) {
  const CategoryIcon = getCategoryIcon(stop.category);
  const categoryColor = getCategoryColor(stop.category);

  return (
    <div className="mb-2 rounded-xl border border-white/60 bg-white/55 p-3 transition-all hover:border-white/80 hover:bg-white/65">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-medium text-slate-500">#{index + 1}</p>
            <p className="text-xs text-slate-500">·</p>
            <p className="text-xs font-medium text-slate-500">{stop.startTime}</p>
          </div>
          <p className="font-medium text-slate-800">{stop.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
              <CategoryIcon className="h-3 w-3" />
              {stop.category}
            </span>
            {stop.notes && (
              <span className="text-xs text-slate-500 italic">{stop.notes}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="border-white/50">
                {stop.travelMinutesFromPrev} min
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Travel time from previous stop</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="border-white/50">
                {stop.durationMinutes} min
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Duration at this location</TooltipContent>
          </Tooltip>
          <Badge variant="outline" className="border-white/50">
            ${stop.estimatedCost.toFixed(0)}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => onSwap(stop)}>
                Swap
              </Button>
            </TooltipTrigger>
            <TooltipContent>Find nearby alternative</TooltipContent>
          </Tooltip>
        </div>
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
    return <Card className="min-h-[420px] flex items-center justify-center text-slate-600">Build a plan to see your day-by-day timeline.</Card>;
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

    const refreshed = await postPlan(request);
    const next = { ...itinerary, days: itinerary.days.map((d) => d.dayNumber === dayNumber ? refreshed.days[dayNumber - 1] : d) };
    onUpdate(next);
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl text-slate-800">Timeline</h2>
        <Badge variant="success" className="text-sm">Running total: {itinerary.currency} {runningTotal.toFixed(0)}</Badge>
      </div>

      <Accordion type="single" collapsible defaultValue="day-1" className="space-y-2">
        {itinerary.days.map((day) => (
          <AccordionItem key={day.dayNumber} value={`day-${day.dayNumber}`}>
            <AccordionTrigger>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">Day {day.dayNumber}</span>
                <span className="text-sm text-slate-600">{day.date}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-sm text-slate-700">{day.explanation}</p>
              {day.stops.map((stop, index) => <StopRow key={stop.id} stop={stop} index={index} onSwap={(selected) => { setSelectedStop(selected); setSwapOpen(true); }} />)}
              <div className="mt-3 flex items-center justify-between gap-2">
                <Badge variant="success">Day cost: {itinerary.currency} {day.dayCost.toFixed(0)}</Badge>
                <Button size="sm" variant="secondary" onClick={() => replanDay(day.dayNumber)}>Replan day</Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <Modal open={swapOpen} onOpenChange={setSwapOpen} title="Nearby swap candidates">
        {selectedStop ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Current stop: <strong>{selectedStop.name}</strong></p>
            <p>Searches Overpass within 2km and replaces this stop with the closest valid match.</p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!itinerary) return;
                  setSwapping(true);
                  try {
                    const result = await postChat({ message: `swap_stop(${selectedStop.id})`, itinerary, preferences: itinerary.preferences });
                    if (result.updatedItinerary) onUpdate(result.updatedItinerary);
                  } finally {
                    setSwapping(false);
                    setSwapOpen(false);
                  }
                }}
                disabled={swapping}
              >
                {swapping ? "Swapping..." : "Swap Stop"}
              </Button>
              <Button variant="secondary" onClick={() => setSwapOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}

