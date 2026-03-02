export type ItineraryExample = {
  id: string;
  city: string;
  region: string;
  styles: string[];
  vibes: string[];
  budgetTier: "low" | "mid" | "high";
  dayPatterns: string[];
};

const ITINERARY_EXAMPLES: ItineraryExample[] = [
  {
    id: "tokyo-tech-tradition",
    city: "Tokyo",
    region: "Japan",
    styles: ["high efficiency", "balanced", "urban"],
    vibes: ["neon", "temples", "modern"],
    budgetTier: "mid",
    dayPatterns: [
      "Start with transit hub orientation and a light cafe stop.",
      "Mix modern city landmarks with traditional culture in the same day.",
      "Place high-energy street activity in the evening."
    ]
  },
  {
    id: "cebu-action-waterfalls",
    city: "Cebu",
    region: "Philippines",
    styles: ["adventure", "packed"],
    vibes: ["tropical", "rugged", "waterfalls"],
    budgetTier: "mid",
    dayPatterns: [
      "Use early departures for long transfer days.",
      "Cluster high-intensity nature activities before afternoon travel.",
      "Pair city/history day first, then full outdoor activity days."
    ]
  },
  {
    id: "davao-eco-relaxed",
    city: "Davao",
    region: "Philippines",
    styles: ["eco-tourism", "relaxed", "balanced"],
    vibes: ["green", "wildlife", "highland"],
    budgetTier: "mid",
    dayPatterns: [
      "Alternate city icons, highland nature, and island/coastal day.",
      "Keep long activity windows around one anchor stop per half-day.",
      "Use market or food street for evening cap."
    ]
  },
  {
    id: "manila-heritage-urban",
    city: "Manila",
    region: "Philippines",
    styles: ["cultural", "urban", "balanced"],
    vibes: ["historical", "modern contrast"],
    budgetTier: "mid",
    dayPatterns: [
      "Anchor one day around heritage district walkability.",
      "Contrast historic core with modern district in another day.",
      "Place sunset or nightlife along waterfront/commercial zones."
    ]
  },
  {
    id: "santorini-slow-luxury",
    city: "Santorini",
    region: "Greece",
    styles: ["slow paced", "relaxed", "luxury"],
    vibes: ["romantic", "coastal", "sunset"],
    budgetTier: "high",
    dayPatterns: [
      "Keep fewer stops with longer dwell time per location.",
      "Use scenic walks and sunset dining as daily anchors.",
      "Balance one cultural site with one beach/leisure block."
    ]
  },
  {
    id: "orlando-family-themeparks",
    city: "Orlando",
    region: "USA",
    styles: ["high energy", "family", "packed"],
    vibes: ["theme parks", "thrills"],
    budgetTier: "high",
    dayPatterns: [
      "Use rope-drop or early start to reduce queue pressure.",
      "Schedule one parade/show window and one evening spectacle.",
      "Avoid overloading with too many transfers in one day."
    ]
  }
];

function normalize(value?: string) {
  return (value || "").toLowerCase().trim();
}

function inferBudgetTier(budget?: number): "low" | "mid" | "high" | null {
  if (!Number.isFinite(budget ?? NaN)) return null;
  if ((budget ?? 0) < 500) return "low";
  if ((budget ?? 0) < 3000) return "mid";
  return "high";
}

export function selectRelevantItineraryExamples(input: {
  city?: string;
  style?: string;
  budget?: number;
  message?: string;
}, limit = 2): ItineraryExample[] {
  const city = normalize(input.city);
  const style = normalize(input.style);
  const text = normalize(input.message);
  const budgetTier = inferBudgetTier(input.budget);

  const scored = ITINERARY_EXAMPLES.map((example) => {
    let score = 0;
    const cityName = normalize(example.city);
    const region = normalize(example.region);

    if (city && (city.includes(cityName) || cityName.includes(city))) score += 10;
    if (city && city.includes(region)) score += 5;
    if (style && example.styles.some((s) => style.includes(normalize(s)))) score += 4;
    if (text && example.vibes.some((v) => text.includes(normalize(v)))) score += 2;
    if (text && example.styles.some((s) => text.includes(normalize(s)))) score += 2;
    if (budgetTier && example.budgetTier === budgetTier) score += 1;

    return { example, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.example);

  return scored.length ? scored : ITINERARY_EXAMPLES.slice(0, 1);
}

export function formatItineraryExamplesForPrompt(examples: ItineraryExample[]) {
  return examples
    .map((example, idx) => {
      const patterns = example.dayPatterns.map((p) => `- ${p}`).join("\n");
      return `${idx + 1}. ${example.city}, ${example.region} | style: ${example.styles.join(", ")} | budget: ${example.budgetTier}\n${patterns}`;
    })
    .join("\n\n");
}
