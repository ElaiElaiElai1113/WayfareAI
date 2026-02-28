import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { geocode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanRequest } from "@/types/itinerary";

const schema = z.object({
  city: z.string().min(2),
  days: z.coerce.number().min(1).max(14),
  dailyStartTime: z.string().min(4),
  dailyEndTime: z.string().min(4),
  budget: z.coerce.number().min(1),
  currency: z.string().min(3).max(4),
  travelStyle: z.enum(["Relaxed", "Balanced", "Packed"]),
  transportMode: z.enum(["walking", "driving"]),
  mustSee: z.string().optional(),
  nature: z.boolean(),
  museums: z.boolean(),
  cafes: z.boolean(),
  localFood: z.boolean(),
  nightlife: z.boolean(),
  shopping: z.boolean(),
  hiddenGems: z.boolean(),
  rainPlan: z.boolean(),
  budgetSaver: z.boolean(),
  useAI: z.boolean()
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  city: "El Nido, Palawan",
  days: 4,
  dailyStartTime: "09:00",
  dailyEndTime: "20:00",
  budget: 15000,
  currency: "PHP",
  travelStyle: "Balanced",
  transportMode: "walking",
  mustSee: "",
  nature: true,
  museums: true,
  cafes: true,
  localFood: true,
  nightlife: false,
  shopping: false,
  hiddenGems: true,
  rainPlan: true,
  budgetSaver: false,
  useAI: true
};

export function PlannerForm({ onSubmit, loading }: { onSubmit: (payload: PlanRequest) => Promise<void>; loading: boolean }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults
  });

  const city = form.watch("city");
  const [suggestions, setSuggestions] = useState<Array<{ name: string }>>([]);

  useEffect(() => {
    const q = city.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const values = await geocode(q);
        setSuggestions(values);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [city]);

  const preferenceKeys = useMemo(
    () => [
      { key: "nature", label: "Nature", icon: "water_drop" },
      { key: "museums", label: "Culture", icon: "museum" },
      { key: "cafes", label: "Foodie", icon: "restaurant" },
      { key: "nightlife", label: "Nightlife", icon: "nightlife" }
    ] as const,
    []
  );

  return (
    <div className="flex flex-col h-full">
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Plan Controls</h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold ml-1">Location</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">location_on</span>
              <Input
                list="city-options"
                placeholder="Search city..."
                className="w-full pl-10 pr-4 py-2 bg-white/80 rounded-xl border-slate-200 focus:ring-primary focus:border-primary text-sm"
                {...form.register("city")}
              />
              <datalist id="city-options">
                {suggestions.map((option, index) => (
                  <option key={`${option.name}-${index}`} value={option.name} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold ml-1">Budget Range</label>
            <input
              type="range"
              min={0}
              max={50000}
              step={1000}
              className="w-full accent-primary h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              {...form.register("budget")}
            />
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>₱0</span>
              <span>₱15,000</span>
              <span>₱50k+</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Intensity</h3>
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-200/50 rounded-xl">
          <button
            type="button"
            onClick={() => form.setValue("travelStyle", "Relaxed")}
            className={`text-xs font-bold py-2 rounded-lg transition-all ${
              form.watch("travelStyle") === "Relaxed"
                ? "bg-white shadow-sm text-primary"
                : "text-slate-600"
            }`}
          >
            Relaxed
          </button>
          <button
            type="button"
            onClick={() => form.setValue("travelStyle", "Balanced")}
            className={`text-xs font-bold py-2 rounded-lg transition-all ${
              form.watch("travelStyle") === "Balanced"
                ? "bg-white shadow-sm text-primary"
                : "text-slate-600"
            }`}
          >
            Balanced
          </button>
          <button
            type="button"
            onClick={() => form.setValue("travelStyle", "Packed")}
            className={`text-xs font-bold py-2 rounded-lg transition-all ${
              form.watch("travelStyle") === "Packed"
                ? "bg-white shadow-sm text-primary"
                : "text-slate-600"
            }`}
          >
            Packed
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Interests</h3>
        <div className="flex flex-wrap gap-2">
          {preferenceKeys.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => form.setValue(item.key as any, !form.watch(item.key as any))}
              className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1 ${
                form.watch(item.key as any)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-white/50 text-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-xs">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <button
          onClick={form.handleSubmit(async (values) => {
            const geo = await geocode(values.city);
            if (!geo.length) {
              form.setError("city", { message: "City not found" });
              return;
            }

            await onSubmit({
              city: values.city,
              days: values.days,
              dailyStartTime: values.dailyStartTime,
              dailyEndTime: values.dailyEndTime,
              budget: values.budget,
              currency: values.currency,
              travelStyle: values.travelStyle,
              transportMode: values.transportMode,
              mustSee:
                values
                  .mustSee?.split(",")
                  .map((s) => s.trim())
                  .filter(Boolean) ?? [],
              preferences: {
                nature: values.nature,
                museums: values.museums,
                cafes: values.cafes,
                localFood: values.localFood,
                nightlife: values.nightlife,
                shopping: values.shopping,
                hiddenGems: values.hiddenGems
              },
              rainPlan: values.rainPlan,
              budgetSaver: values.budgetSaver,
              useAI: values.useAI
            });
          })}
          disabled={loading}
          className="w-full py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">auto_fix_high</span>
          <span>{loading ? "Planning..." : "Generate Plan"}</span>
        </button>
      </div>
    </div>
  );
}
