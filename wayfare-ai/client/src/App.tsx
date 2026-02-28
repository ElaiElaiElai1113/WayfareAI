import { useMemo, useState } from "react";
import { PlannerForm } from "@/components/PlannerForm";
import { TimelinePanel } from "@/components/TimelinePanel";
import { MapPanel } from "@/components/MapPanel";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import type { Itinerary, PlanRequest } from "@/types/itinerary";
import { postPlan, postShare } from "@/lib/api";

export default function App() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("plan");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const summary = useMemo(() => {
    if (!itinerary) return "Your personal trip planner";
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
    <div className="font-display min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased h-screen overflow-hidden flex flex-col bg-sand-ocean">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3 glass-card sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg text-white">
              <span className="material-symbols-outlined text-2xl">explore</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Wayfare AI</h1>
          </div>
          {itinerary && (
            <>
              <div className="hidden md:block h-8 w-px bg-slate-300 mx-2"></div>
              <div className="hidden md:flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destination</span>
                  <span className="text-sm font-bold">{itinerary.city}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full border border-slate-200">
                  <span className="material-symbols-outlined text-sm text-primary">calendar_today</span>
                  <span className="text-xs font-medium">{itinerary.days.length} Days</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full border border-slate-200">
                  <span className="material-symbols-outlined text-sm text-emerald-600">payments</span>
                  <span className="text-xs font-medium">{itinerary.currency} {itinerary.totalEstimatedCost.toFixed(0)}</span>
                </div>
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1 rounded-full border border-slate-200">
                  <span className="material-symbols-outlined text-sm text-orange-500">eco</span>
                  <span className="text-xs font-medium">Balanced</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-6 mr-4">
            <button
              className={`text-sm font-semibold border-b-2 pb-1 transition-colors ${
                tab === "plan" ? "text-primary border-primary" : "text-slate-600 hover:text-primary border-transparent"
              }`}
              onClick={() => setTab("plan")}
            >
              Itinerary
            </button>
            <button
              className={`text-sm font-semibold border-b-2 pb-1 transition-colors ${
                tab === "map" ? "text-primary border-primary" : "text-slate-600 hover:text-primary border-transparent"
              }`}
              onClick={() => setTab("map")}
            >
              Map View
            </button>
            <button
              className={`text-sm font-semibold border-b-2 pb-1 transition-colors ${
                tab === "chat" ? "text-primary border-primary" : "text-slate-600 hover:text-primary border-transparent"
              }`}
              onClick={() => setTab("chat")}
            >
              Chat
            </button>
          </nav>
          <button
            onClick={onShare}
            disabled={!itinerary}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">ios_share</span>
            <span>Share Trip</span>
          </button>
          <div className="size-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden">
            <span className="material-symbols-outlined text-2xl text-slate-500">person</span>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-3 bg-white/40 border-b border-slate-200/50">
        <button
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${
            tab === "plan" ? "bg-primary text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
          onClick={() => setTab("plan")}
        >
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          <span>Plan</span>
        </button>
        <button
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${
            tab === "map" ? "bg-primary text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
          onClick={() => setTab("map")}
        >
          Map
        </button>
        <button
          className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${
            tab === "chat" ? "bg-primary text-white" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
          onClick={() => setTab("chat")}
        >
          <span className="material-symbols-outlined text-sm">tune</span>
          <span>Chat</span>
        </button>
      </div>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Planner Settings - Only show when no itinerary */}
        {!itinerary && (
          <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 glass-card border-r border-slate-200 overflow-y-auto p-5 gap-6 backdrop-blur-md bg-white/70">
            <PlannerForm onSubmit={onPlan} loading={loading} />
          </aside>
        )}

        {/* Center: Itinerary Timeline */}
        {itinerary && (
          <section className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-8 ${tab === "map" || tab === "chat" ? "hidden md:block" : "block"}`}>
            <TimelinePanel itinerary={itinerary} onUpdate={setItinerary} />
          </section>
        )}

        {/* Right: Interactive Map */}
        {itinerary && (
          <section className={`w-full md:w-[400px] lg:w-[500px] flex-shrink-0 relative border-l border-slate-200 ${tab === "plan" || tab === "chat" ? "hidden md:block" : "block"}`}>
            <MapPanel itinerary={itinerary} />
          </section>
        )}
      </main>

      {/* Chat Drawer */}
      <AssistantDrawer
        itinerary={itinerary}
        onUpdateItinerary={setItinerary}
        openDefault={tab === "chat"}
      />

      {/* Floating Map Toggle for Mobile */}
      {itinerary && (
        <div className="md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => setTab("map")}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined">map</span>
            <span className="text-sm font-bold tracking-wide">View Map</span>
          </button>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-6 pt-3 pb-8 z-50">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <button
            onClick={() => setTab("plan")}
            className={`flex flex-col items-center gap-1 ${tab === "plan" ? "text-primary" : "text-slate-400"}`}
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Plan</span>
          </button>
          <button
            onClick={() => setTab("map")}
            className={`flex flex-col items-center gap-1 ${tab === "map" ? "text-primary" : "text-slate-400"}`}
          >
            <span className="material-symbols-outlined text-2xl">explore</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Explore</span>
          </button>
          <button
            onClick={() => setTab("chat")}
            className="flex flex-col items-center gap-1 text-slate-400"
          >
            <div className="relative">
              <span className="material-symbols-outlined text-2xl">chat_bubble</span>
              <div className="absolute -top-1 -right-1 size-2 bg-primary rounded-full border-2 border-white"></div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <span className="material-symbols-outlined text-2xl">person</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
          </button>
        </div>
      </nav>

      <Toaster />
    </div>
  );
}
