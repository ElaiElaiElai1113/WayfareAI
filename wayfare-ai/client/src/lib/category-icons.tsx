import {
  Building,
  Coffee,
  Utensils,
  MapPin,
  GlassWater,
  Moon,
  ShoppingBag,
  Sparkles,
  Clock,
  Map,
  Landmark
} from "lucide-react";

export type CategoryIconMap = Record<string, React.ComponentType<{ className?: string }>>;

export const CATEGORY_ICONS: CategoryIconMap = {
  museum: Building,
  cafe: Coffee,
  restaurant: Utensils,
  park: MapPin,
  viewpoint: Landmark,
  nightlife: Moon,
  shopping: ShoppingBag,
  attraction: Sparkles,
  hidden_gem: GlassWater,
};

export function getCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, "_");
  return CATEGORY_ICONS[normalizedCategory] || MapPin;
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    museum: "bg-purple-100 text-purple-700",
    cafe: "bg-amber-100 text-amber-700",
    restaurant: "bg-orange-100 text-orange-700",
    park: "bg-green-100 text-green-700",
    viewpoint: "bg-blue-100 text-blue-700",
    nightlife: "bg-indigo-100 text-indigo-700",
    shopping: "bg-pink-100 text-pink-700",
    attraction: "bg-rose-100 text-rose-700",
    hidden_gem: "bg-teal-100 text-teal-700",
  };
  const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, "");
  return colors[normalizedCategory] || "bg-slate-100 text-slate-700";
}
