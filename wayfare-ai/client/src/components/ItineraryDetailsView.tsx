import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ItineraryDetailsView() {
  const [activeDay, setActiveDay] = useState(1);

  const trip = {
    city: "El Nido Escape",
    dates: "Oct 12 - Oct 18, 2026",
    travelers: "2 Travelers",
    totalCost: "$2,450.00",
    budget: "$3,000.00",
    status: "confirmed"
  };

  const days = [
    {
      number: 1,
      title: "Arrival & Coastal Bliss",
      date: "Monday, Oct 12, 2026",
      stops: [
        {
          time: "10:30 AM",
          title: "Arrival at Lio Beach",
          location: "Lio Tourism Estate, El Nido",
          icon: "landscape",
          notes: "Pre-booked skip the line entry. Early check-in requested.",
          image: "https://images.unsplash.com/photo-1506905928316-bd4ed1ddc29?w=400&q=80"
        },
        {
          time: "02:00 PM",
          title: "Check-in: Seda Lio Resort",
          location: "Villa 4, Beachfront Row",
          icon: "hotel",
          notes: "Room will be ready upon arrival.",
          image: "https://images.unsplash.com/photo-1566073791259-99b26fbbf32?w=400&q=80"
        }
      ]
    },
    {
      number: 2,
      title: "Secret Lagoon & Hidden Gems",
      date: "Tuesday, Oct 13, 2026",
      stops: [
        {
          time: "08:00 AM",
          title: "Island Hopping Tour",
          location: "Cadlao Island",
          icon: "sailing",
          notes: "A, B, C Island hopping with lunch.",
          image: "https://images.unsplash.com/photo-1507525428034-b423a601f3b6?w=400&q=80"
        },
        {
          time: "02:00 PM",
          title: "Secret Lagoon Beach",
          location: "Miniloc Island",
          icon: "beach_access",
          notes: "Hidden beach with crystal clear water.",
          image: "https://images.unsplash.com/photo-1544551763-89a0bac97ea76?w=400&q=80"
        }
      ]
    }
  ];

  return (
    <div className="font-display min-h-screen bg-gradient-to-br from-[#fdf5f2] via-[#f0f9ff] to-[#e0f2fe] dark:from-[#221610] dark:to-[#0c1a25] text-slate-900 dark:text-slate-100 flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-200/50 dark:border-slate-800/50 glass-card h-full">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl text-white">
            <span className="material-symbols-outlined">explore</span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">Wayfare AI</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Travel Intelligence</p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all">
            <span className="material-symbols-outlined">map</span>
            <span className="font-medium text-sm">Plan Trip</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all">
            <span className="material-symbols-outlined">favorite</span>
            <span className="font-medium text-sm">Saved Trips</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-primary text-white shadow-lg shadow-primary/25 rounded-xl transition-all">
            <span className="material-symbols-outlined">confirmation_number</span>
            <span className="font-medium text-sm">Bookings</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all">
            <span className="material-symbols-outlined">account_circle</span>
            <span className="font-medium text-sm">Profile</span>
          </a>
        </nav>
        <div className="p-4 mt-auto">
          <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
            <p className="text-xs font-bold text-primary mb-1">PRO PLAN</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">Unlock unlimited AI travel suggestions.</p>
            <button className="w-full py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity">Upgrade</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 glass-card border-b border-slate-200/50 dark:border-slate-800/50 shrink-0">
          <div className="flex items-center gap-6">
            <button className="size-10 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 text-slate-500">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">El Nido Escape</h2>
                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 dark:border-green-800 uppercase tracking-wider">Confirmed</span>
              </div>
              <p className="text-sm text-slate-500 font-medium">Oct 12 - Oct 18, 2026 • 2 Travelers</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <span className="material-symbols-outlined text-sm">ios_share</span>
              Share Trip
            </button>
            <button className="size-10 flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900">
              <span className="material-symbols-outlined">more_horiz</span>
            </button>
          </div>
        </header>

        {/* Quick Info Bar */}
        <div className="px-8 py-6 flex gap-4 overflow-x-auto">
          <div className="flex-1 min-w-[200px] glass-card rounded-2xl p-4 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Cost</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">{trip.totalCost}</p>
            </div>
          </div>
          <div className="flex-1 min-w-[200px] glass-card rounded-2xl p-4 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined">wb_sunny</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Weather</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">28°C Sunny</p>
            </div>
          </div>
          <div className="flex-1 min-w-[200px] glass-card rounded-2xl p-4 flex items-center gap-4">
            <div className="size-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined">flight_takeoff</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Next Event</p>
              <p className="text-xl font-black text-slate-900 dark:text-white">In 2 Days</p>
            </div>
          </div>
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto px-8 pb-12">
          <div className="max-w-4xl">
            {days.map((day) => (
              <div key={day.number} className="mb-12">
                <div className="flex items-center gap-4 mb-8 sticky top-0 py-2 bg-transparent backdrop-blur-sm z-10">
                  <div className={`size-10 rounded-full flex items-center justify-center font-black text-lg ${activeDay === day.number ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "border-2 border-slate-300 dark:border-slate-700 text-slate-400"}`}>
                    {day.number}
                  </div>
                  <div>
                    <h3 className={`text-xl font-black ${activeDay === day.number ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>Day {day.number}: {day.title}</h3>
                    <p className={`text-sm ${activeDay === day.number ? "text-slate-600 dark:text-slate-300" : "text-slate-400"}`}>{day.date}</p>
                  </div>
                  <button className={`ml-auto text-slate-400 ${activeDay === day.number ? "hidden" : "block"}`}>
                    <span className="material-symbols-outlined">expand_more</span>
                  </button>
                </div>

                <div className="ml-5 pl-9 border-l-2 border-slate-200 dark:border-slate-800 space-y-10 relative">
                  {day.stops.map((stop, index) => (
                    <div key={index} className="relative">
                      <div className={`absolute -left-[45px] top-4 size-4 rounded-full ${activeDay === day.number ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"} ring-4 ring-white dark:ring-background-dark`}></div>
                      <div className="glass-card rounded-2xl overflow-hidden flex shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-1/3 h-48 bg-slate-200 dark:bg-slate-800 relative">
                          <img alt={stop.title} className="w-full h-full object-cover" src={stop.image} />
                        </div>
                        <div className="w-2/3 p-6 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs font-black px-2 py-1 bg-slate-500 dark:bg-slate-800 rounded uppercase ${activeDay === day.number ? "text-white" : "text-slate-600"}`}>{stop.time}</span>
                              <span className="material-symbols-outlined text-slate-400">verified</span>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">{stop.title}</h4>
                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-sm mt-1">
                              <span className="material-symbols-outlined text-sm">location_on</span>
                              {stop.location}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">View Details</button>
                            <button className="flex-1 py-2 rounded-lg bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">View Voucher</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeDay === day.number && (
                    <div className="mt-8 flex items-center gap-4 text-slate-500 py-2">
                      <div className="w-8 flex justify-center">
                        <span className="material-symbols-outlined">directions_car</span>
                      </div>
                      <div className="flex-1 h-[1px] bg-slate-200 dark:border-slate-800"></div>
                      <p className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">15m Private Transfer</p>
                      <div className="flex-1 h-[1px] bg-slate-200 dark:border-slate-800"></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: AI Assistant */}
        <aside className="w-80 flex flex-col glass-card border-l border-slate-200/50 dark:border-slate-800/50 hidden xl:flex">
          <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                Trip Assistant
              </h3>
              <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
            </div>
            <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
              <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                "Hi! I'm your Wayfare guide for El Nido. How can I help with your itinerary today?"
              </p>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suggested Queries</p>
            <button className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary">What is baggage limit?</p>
            </button>
            <button className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary">Best dinner spot nearby?</p>
            </button>
            <button className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all group">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary">Is there a gym at resort?</p>
            </button>

            <div className="pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Live Map Context</p>
              <div className="aspect-square rounded-2xl bg-slate-200 dark:bg-slate-800 overflow-hidden relative border border-slate-200 dark:border-slate-800">
                <img className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1518548410770-1f3a433876e5?w=400&q=80" alt="Map" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 px-2 py-1 rounded-lg">
                  <span className="material-symbols-outlined text-primary text-xs">location_on</span>
                  <span className="text-[10px] font-black uppercase text-slate-900 dark:text-white">Active Route: Lio Estate</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200/50 dark:border-slate-800/50">
            <div className="relative">
              <input className="w-full bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-primary/50 placeholder:text-slate-500" placeholder="Ask anything..." type="text" />
              <button className="absolute right-2 top-1.5 size-8 rounded-lg bg-primary text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
