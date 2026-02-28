import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlannerForm } from "@/components/PlannerForm";
import { TimelinePanel } from "@/components/TimelinePanel";
import { MapPanel } from "@/components/MapPanel";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItinerarySkeleton, MapSkeleton } from "@/components/ItinerarySkeleton";
import type { Itinerary, PlanRequest } from "@/types/itinerary";
import { postPlan, postShare } from "@/lib/api";

export default function App() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("plan");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const summary = useMemo(() => {
    if (!itinerary) return "Smarter routes. Better journeys.";
    return `${itinerary.city} · ${itinerary.days.length} days · ${itinerary.currency} ${itinerary.totalEstimatedCost.toFixed(0)}`;
  }, [itinerary]);

  const onPlan = async (payload: PlanRequest) => {
    try {
      setLoading(true);
      setShareUrl(null);
      const planned = await postPlan(payload);
      setItinerary(planned);
      toast({
        title: "Itinerary Generated!",
        description: `${planned.city} · ${planned.days.length} days planned`,
        variant: "success"
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to generate itinerary";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const onShare = async () => {
    if (!itinerary) return;
    try {
      const result = await postShare(itinerary);
      setShareUrl(result.url);
      toast({
        title: "Link Created!",
        description: "Share URL copied to clipboard",
        variant: "success"
      });
      await navigator.clipboard.writeText(result.url);
    } catch (e) {
      toast({
        title: "Share Failed",
        description: e instanceof Error ? e.message : "Failed to create share link",
        variant: "destructive"
      });
    }
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
          {loading ? <ItinerarySkeleton /> : <TimelinePanel itinerary={itinerary} onUpdate={setItinerary} />}
        </section>
        <section className={`${tab === "plan" ? "hidden md:block" : "block"}`}>
          {loading ? <MapSkeleton /> : <MapPanel itinerary={itinerary} />}
        </section>
      </div>

      <AssistantDrawer
        itinerary={itinerary}
        onUpdateItinerary={setItinerary}
        openDefault={tab === "chat"}
      />
      <Toaster />
    </div>
  );
}

