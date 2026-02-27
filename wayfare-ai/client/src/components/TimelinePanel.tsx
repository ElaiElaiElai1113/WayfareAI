import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import type { Itinerary, Stop } from "@/types/itinerary";
import { postChat, postPlan } from "@/lib/api";

function StopRow({ stop, index, onSwap }: { stop: Stop; index: number; onSwap: (stop: Stop) => void }) {
  return (
    <div className="mb-2 rounded-xl border border-white/60 bg-white/55 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">#{index + 1} · {stop.startTime}</p>
          <p className="font-medium text-slate-800">{stop.name}</p>
          <p className="text-sm text-slate-600">{stop.category}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge>{stop.travelMinutesFromPrev} min travel</Badge>
          <Badge>${stop.estimatedCost.toFixed(0)}</Badge>
          <Button size="sm" variant="ghost" onClick={() => onSwap(stop)}>Swap</Button>
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
        <Badge>Running total: {itinerary.currency} {runningTotal.toFixed(0)}</Badge>
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
              <div className="mt-3 flex justify-between">
                <Badge>Day cost: {itinerary.currency} {day.dayCost.toFixed(0)}</Badge>
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

