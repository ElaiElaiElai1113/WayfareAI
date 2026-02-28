import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function BookingsView() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);

  const trips = [
    {
      id: "1",
      title: "El Nido Escape",
      location: "Palawan, Philippines",
      dates: "Dec 12 - Dec 18, 2025",
      price: "$1,420",
      image: "https://images.unsplash.com/photo-1518509562904-e80ef9df75d6?w=600&q=80",
      status: "confirmed" as const,
      stops: [
        { icon: "flight_takeoff", label: "1 Flight" },
        { icon: "hotel", label: "1 Resort" },
        { icon: "sailing", label: "2 Activities" }
      ]
    },
    {
      id: "2",
      title: "Paris Getaway",
      location: "Paris, France",
      dates: "Jan 05 - Jan 12, 2026",
      price: "$2,850",
      image: "https://images.unsplash.com/photo-1502602898657-6103911e0e4?w=600&q=80",
      status: "pending" as const,
      stops: [
        { icon: "flight_takeoff", label: "2 Flights" },
        { icon: "apartment", label: "1 Hotel" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-ocean-gradient flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 glass-card border-b border-slate-200/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-xl text-white">
            <span className="material-symbols-outlined text-2xl">travel_explore</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">Wayfare AI</h2>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Plan Trip</a>
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Saved Trips</a>
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Bookings</a>
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Profile</a>
        </nav>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
            <input className="pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all w-64 text-sm" placeholder="Search trips..." type="text"/>
          </div>
          <button className="p-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-500 hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <div className="size-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-2xl text-primary">person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-2">My Bookings</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Your global adventures, organized in one place.</p>
          </div>
        </header>

        <div className="flex items-center p-1.5 bg-white/30 dark:bg-slate-800/30 backdrop-blur-md rounded-xl w-fit mb-10 border border-white/20">
          <button onClick={() => setActiveTab("upcoming")} className={`px-8 py-2 rounded-lg text-sm font-bold ${activeTab === "upcoming" ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"}`}>Upcoming</button>
          <button onClick={() => setActiveTab("past")} className={`px-8 py-2 rounded-lg text-sm font-semibold ${activeTab === "past" ? "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"}`}>Past Trips</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trip Cards */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {trips.map((trip) => (
              <div key={trip.id} className="glass-card rounded-xl overflow-hidden group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500">
                <div className="flex flex-col md:flex-row h-full">
                  <div className="md:w-64 h-48 md:h-auto overflow-hidden relative">
                    <img alt={trip.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={trip.image} />
                    <div className={`absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 ${trip.status === "confirmed" ? "" : "opacity-0"}`}>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-white">Confirmed</span>
                    </div>
                  </div>
                  <div className="flex-1 p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{trip.title}</h3>
                        <span className="text-primary font-bold text-lg">{trip.price}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-6">
                        <span className="material-symbols-outlined text-base">calendar_today</span>
                        <span>{trip.dates}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span>{trip.location}</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {trip.stops.map((stop) => (
                          <div key={stop.label} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
                            <span className="material-symbols-outlined text-sm text-primary">{stop.icon}</span>
                            {stop.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">View Details</Button>
                      <button className="px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            <section className="glass-card rounded-xl p-8">
              <h4 className="text-lg font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">bolt</span>
                Quick Actions
              </h4>
              <div className="flex flex-col gap-3">
                <button className="w-full flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-primary/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">download</span>
                    <span className="text-sm font-semibold">Download Vouchers</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-primary/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">support_agent</span>
                    <span className="text-sm font-semibold">Get Help & Support</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                </button>
                <button className="w-full flex items-center justify-between p-4 bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-primary/50 transition-all group">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">share</span>
                    <span className="text-sm font-semibold">Share Itinerary</span>
                  </div>
                  <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                </button>
              </div>
            </section>

            <section className="glass-card rounded-xl p-8 relative overflow-hidden group">
              <div className="relative z-10">
                <h4 className="text-lg font-bold mb-2">Explore Similar</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Based on your El Nido trip, you might love these hidden gems in Bali.</p>
                <div className="rounded-xl overflow-hidden mb-4">
                  <img alt="Bali" className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-700" src="https://images.unsplash.com/photo-1537996194471-e657dfb76ad4?w=400&q=80" />
                </div>
                <Button className="w-full py-3 bg-primary/10 text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Explore Bali Deals</Button>
              </div>
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all"></div>
            </section>

            <section className="glass-card rounded-xl p-8">
              <h4 className="text-lg font-bold mb-4">Current Trip Map</h4>
              <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                <img className="w-full h-full object-cover grayscale opacity-60" src="https://images.unsplash.com/photo-1524810015796-d4c0d5cbf51?w=400&q=80" alt="Map" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-3 bg-primary rounded-full animate-ping"></div>
                  <div className="w-2 h-2 bg-primary rounded-full absolute"></div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-400">
                <span>GPS TRACKING ON</span>
                <span className="text-green-500">SYSTEM ACTIVE</span>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
