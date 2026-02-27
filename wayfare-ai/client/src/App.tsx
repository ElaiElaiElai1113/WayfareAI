import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlannerForm } from "@/components/PlannerForm";
import { TimelinePanel } from "@/components/TimelinePanel";
import { MapPanel } from "@/components/MapPanel";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Itinerary, PlanRequest } from "@/types/itinerary";
import { postPlan, postShare } from "@/lib/api";

export default function App() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("plan");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (!itinerary) return "Smarter routes. Better journeys.";
    return `${itinerary.city} · ${itinerary.days.length} days · ${itinerary.currency} ${itinerary.totalEstimatedCost.toFixed(0)}`;
  }, [itinerary]);

  const onPlan = async (payload: PlanRequest) => {
    try {
      setLoading(true);
      setError(null);
      setShareUrl(null);
      const planned = await postPlan(payload);
      setItinerary(planned);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate itinerary");
    } finally {
      setLoading(false);
    }
  };

  const onShare = async () => {
    if (!itinerary) return;
    const result = await postShare(itinerary);
    setShareUrl(result.url);
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <motion.header
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-2xl border border-white/60 glass-card p-6 shadow-glass"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-600">WAYFARE AI</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-800 md:text-5xl">Smarter routes. Better journeys.</h1>
            <p className="mt-2 text-slate-700">{summary}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onShare} disabled={!itinerary}>Share Link</Button>
            <Button variant="secondary" disabled={!itinerary} onClick={() => itinerary && navigator.clipboard.writeText(JSON.stringify(itinerary, null, 2))}>Export JSON</Button>
          </div>
        </div>
        {shareUrl && <p className="mt-4 text-sm text-slate-700">Share URL: <a className="underline" href={shareUrl}>{shareUrl}</a></p>}
      </motion.header>

      <PlannerForm onSubmit={onPlan} loading={loading} />

      {error && <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 md:hidden">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className={`${tab === "map" ? "hidden md:block" : "block"}`}>
          <TimelinePanel itinerary={itinerary} onUpdate={setItinerary} />
        </section>
        <section className={`${tab === "plan" ? "hidden md:block" : "block"}`}>
          <MapPanel itinerary={itinerary} />
        </section>
      </div>

      <AssistantDrawer
        itinerary={itinerary}
        onUpdateItinerary={setItinerary}
        openDefault={tab === "chat"}
      />
    </div>
  );
}

