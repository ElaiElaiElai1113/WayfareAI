import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { geocode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  budgetSaver: z.boolean()
});

type FormValues = z.infer<typeof schema>;

const defaults: FormValues = {
  city: "Lisbon",
  days: 3,
  dailyStartTime: "09:00",
  dailyEndTime: "20:00",
  budget: 450,
  currency: "USD",
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
  budgetSaver: false
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
      { key: "nature", label: "Nature" },
      { key: "museums", label: "Museums" },
      { key: "cafes", label: "Cafes" },
      { key: "localFood", label: "Local Food" },
      { key: "nightlife", label: "Nightlife" },
      { key: "shopping", label: "Shopping" },
      { key: "hiddenGems", label: "Hidden Gems" }
    ] as const,
    []
  );

  return (
    <Card>
      <form
        className="grid gap-4 md:grid-cols-3"
        onSubmit={form.handleSubmit(async (values) => {
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
            budgetSaver: values.budgetSaver
          });
        })}
      >
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-slate-700">City</label>
          <Input list="city-options" placeholder="Search city" {...form.register("city")} />
          <datalist id="city-options">
            {suggestions.map((option) => (
              <option key={option.name} value={option.name} />
            ))}
          </datalist>
          {form.formState.errors.city && <p className="text-xs text-red-600">{form.formState.errors.city.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Days</label>
          <Input type="number" min={1} max={14} {...form.register("days")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Start Time</label>
          <Input type="time" {...form.register("dailyStartTime")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">End Time</label>
          <Input type="time" {...form.register("dailyEndTime")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Budget</label>
          <Input type="number" min={1} {...form.register("budget")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Currency</label>
          <Input maxLength={4} {...form.register("currency")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Travel Style</label>
          <select className="h-10 w-full rounded-xl border border-white/70 bg-white/65 px-3 text-sm" {...form.register("travelStyle")}>
            <option value="Relaxed">Relaxed</option>
            <option value="Balanced">Balanced</option>
            <option value="Packed">Packed</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Transport</label>
          <select className="h-10 w-full rounded-xl border border-white/70 bg-white/65 px-3 text-sm" {...form.register("transportMode")}>
            <option value="walking">Walking</option>
            <option value="driving">Driving</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-3">
          <label className="text-sm font-medium text-slate-700">Must-see places (comma separated)</label>
          <Input placeholder="Belém Tower, Alfama" {...form.register("mustSee")} />
        </div>

        <div className="grid gap-2 md:col-span-3 md:grid-cols-4">
          {preferenceKeys.map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/55 px-3 py-2 text-sm text-slate-700">
              {item.label}
              <Switch checked={form.watch(item.key)} onCheckedChange={(value) => form.setValue(item.key, value)} />
            </label>
          ))}
          <label className="flex items-center justify-between rounded-xl border border-white/70 bg-white/55 px-3 py-2 text-sm text-slate-700">
            Rain Plan
            <Switch checked={form.watch("rainPlan")} onCheckedChange={(value) => form.setValue("rainPlan", value)} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/70 bg-white/55 px-3 py-2 text-sm text-slate-700">
            Budget Saver
            <Switch checked={form.watch("budgetSaver")} onCheckedChange={(value) => form.setValue("budgetSaver", value)} />
          </label>
        </div>

        <div className="md:col-span-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Planning..." : "Generate Itinerary"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
