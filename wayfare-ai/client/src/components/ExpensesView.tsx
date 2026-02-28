import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ExpensesView() {
  const [expenses, setExpenses] = useState([
    { id: 1, category: "Foodie", icon: "restaurant", amount: 84.5, place: "Trattoria Al Mare", date: "Oct 15, 2026", status: "confirmed" },
    { id: 2, category: "Activities", icon: "kayaking", amount: 120.00, place: "Lagoon Kayak Rental", date: "Oct 14, 2026", status: "confirmed" },
    { id: 3, category: "Stay", icon: "hotel", amount: 720.00, place: "Seda Lio Resort", date: "Oct 12, 2026", status: "pending" },
  ]);

  const totalSpent = 2450;
  const totalBudget = 3000;
  const budgetPercent = Math.round((totalSpent / totalBudget) * 100);

  const breakdown = [
    { label: "Flights", color: "bg-primary", amount: 980.00 },
    { label: "Stay", color: "bg-ocean", amount: 720.00 },
    { label: "Food", color: "bg-blue-400", amount: 340.00 },
    { label: "Activities", color: "bg-emerald-400", amount: 410.00 },
  ];

  return (
    <div className="font-display min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 flex flex-col overflow-x-hidden">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 glass-card border-b border-slate-200/50 px-6 md:px-20 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">travel_explore</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-ocean dark:text-white uppercase">Wayfare AI</h2>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Plan Trip</a>
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Saved Trips</a>
          <a href="#" className="text-sm font-semibold hover:text-primary transition-colors">Bookings</a>
        </nav>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
          </button>
          <div className="size-10 rounded-full border-2 border-primary overflow-hidden">
            <span className="material-symbols-outlined text-2xl text-primary">person</span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 md:px-20 py-10 max-w-[1440px] mx-auto w-full">
        {/* Trip Header */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold tracking-widest text-xs uppercase">
              <span className="material-symbols-outlined text-sm">location_on</span>
              Palawan, Philippines
            </div>
            <h1 className="text-5xl font-black text-ocean dark:text-white leading-tight">El Nido Escape</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Oct 12 — Oct 20, 2026 • 8 Days</p>
          </div>
          <div className="glass-card p-6 rounded-2xl flex flex-col items-end min-w-[280px] shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Spent</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-ocean dark:text-white">${totalSpent.toLocaleString()}.00</span>
              <span className="text-slate-400 text-sm">/ {totalBudget.toLocaleString()}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-4 overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${budgetPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Spend Summary Card */}
            <div className="glass-card rounded-3xl p-8 shadow-xl border border-white/40">
              <h3 className="text-xl font-bold mb-8">Spending Breakdown</h3>
              <div className="flex flex-col md:flex-row items-center gap-12">
                {/* Visual Donut Chart Placeholder */}
                <div className="relative size-48 flex items-center justify-center">
                  <svg className="size-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle className="stroke-slate-200 dark:stroke-slate-800" cx="18" cy="18" fill="none" r="16" strokeWidth="3.5"></circle>
                    <circle className="stroke-primary" cx="18" cy="18" fill="none" r="16" strokeDasharray="40 100" strokeWidth="3.5"></circle>
                    <circle className="stroke-ocean" cx="18" cy="18" fill="none" r="16" strokeDasharray="25 100" strokeDashoffset="-40" strokeWidth="3.5"></circle>
                    <circle className="stroke-blue-400" cx="18" cy="18" fill="none" r="16" strokeDasharray="15 100" strokeDashoffset="-65" strokeWidth="3.5"></circle>
                    <circle className="stroke-emerald-400" cx="18" cy="18" fill="none" r="16" strokeDasharray="20 100" strokeDashoffset="-80" strokeWidth="3.5"></circle>
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-black">$2.4k</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                  {breakdown.map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`size-3 rounded-full ${item.color}`}></div>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-400 font-bold uppercase">{item.label}</span>
                        <span className="font-bold">${item.amount.toLocaleString()}.00</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* List Section: Recent Expenses */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-bold">Recent Expenses</h3>
                <button className="text-primary text-sm font-bold hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="glass-card flex items-center justify-between p-5 rounded-2xl hover:translate-x-1 transition-transform cursor-pointer group shadow-sm border border-white/20">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined">{expense.icon}</span>
                      </div>
                      <div>
                        <p className="font-bold text-ocean dark:text-white">{expense.place}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{expense.category} • {expense.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-ocean dark:text-white">-${expense.amount.toFixed(2)}</p>
                      <p className={`text-[10px] font-bold uppercase ${expense.status === "confirmed" ? "text-emerald-500" : "text-amber-500"}`}>{expense.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Side Panel (4 cols) */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <div className="glass-card p-6 rounded-3xl border border-white/20 shadow-lg space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Management</h4>
              <button className="w-full flex items-center gap-3 p-4 bg-primary text-white rounded-2xl font-bold hover:opacity-90 transition-opacity">
                <span className="material-symbols-outlined">add_circle</span>
                Add Expense
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-ocean dark:text-white">ios_share</span>
                  <span className="text-xs font-bold">Export</span>
                </button>
                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <span className="material-symbols-outlined text-ocean dark:text-white">camera</span>
                  <span className="text-xs font-bold">Scan</span>
                </button>
              </div>
            </div>

            {/* Budget Health Card */}
            <div className="glass-card p-6 rounded-3xl border-l-4 border-emerald-400 shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-tighter mb-1">AI Insight</p>
                <h4 className="text-xl font-bold text-ocean dark:text-white mb-3">Budget Health: Excellent</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  You're 12% under budget for food. AI suggests you can upgrade your dinner experience tonight at <span className="text-primary font-semibold">Skyline Lounge</span>.
                </p>
                <button className="px-4 py-2 bg-emerald-400/20 text-emerald-600 dark:text-emerald-300 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-400/30 transition-colors">
                  View Suggestions
                </button>
              </div>
            </div>

            {/* AI Assistant Mini-view */}
            <div className="bg-ocean text-white p-6 rounded-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute -bottom-8 -right-8 size-32 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/40 transition-all"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  </div>
                  <h4 className="font-bold">Wayfare Smart Saver</h4>
                </div>
                <p className="text-xs text-blue-200 leading-relaxed mb-4 italic">
                  "Booking local trikes instead of private vans could save you an additional $45 over next 3 days."
                </p>
                <div className="flex gap-2">
                  <input className="flex-1 bg-white/10 border-none rounded-xl text-xs px-4 focus:ring-1 focus:ring-primary placeholder:text-blue-300/50" placeholder="Ask AI about saving..." type="text" />
                  <button className="size-10 bg-primary rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer / Bottom Spacer */}
      <footer className="py-10 text-center text-slate-400 text-xs font-medium">
        <p>© 2026 Wayfare AI Travel. All rights reserved.</p>
      </footer>
    </div>
  );
}
