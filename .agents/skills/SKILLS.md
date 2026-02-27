You are a senior full-stack engineer and product designer.

Build a production-ready MVP called:

WAYFARE AI
Tagline: “Smarter routes. Better journeys.”

Stack:
Frontend:
- React 18 + Vite + TypeScript
- TailwindCSS
- shadcn/ui
- Framer Motion
- TanStack Query
- React Hook Form + Zod
- MapLibre GL

Backend:
- Cloudflare Workers (separate worker folder)
- Cloudflare D1 (SQLite) for saved itineraries
- Cloudflare KV for caching

Data sources (FREE ONLY):
- Nominatim (geocoding)
- Overpass API (POIs)
- OSRM (routing + travel time matrix)

NO Supabase.
NO Google APIs.
NO Mapbox.

---------------------------------------
PROJECT STRUCTURE
---------------------------------------

/wayfare-ai
  /client (Vite React app)
  /worker (Cloudflare Worker API)
  wrangler.toml
  README.md

---------------------------------------
CORE FEATURES
---------------------------------------

Planner Inputs:
- City search (Nominatim autocomplete)
- Trip date range OR number of days
- Daily start/end time
- Budget + currency
- Travel style (Relaxed/Balanced/Packed)
- Transport mode (walking/driving)
- Must-see places
- Preferences toggles (Nature, Museums, Cafes, Local Food, Nightlife, Shopping, Hidden Gems)
- Rain Plan toggle
- Budget Saver toggle

Output:
- Day-by-day itinerary timeline
- Travel time chips between stops
- Cost per stop + running total
- Interactive map (MapLibre)
- Numbered markers + route polyline per day
- Swap stop feature (nearby within 2km)
- Replan single day
- Export JSON
- Share link (saved in D1)

---------------------------------------
ITINERARY ENGINE
---------------------------------------

Implement as a pure TypeScript module in /worker/lib/engine.ts

Steps:
1) Geocode city -> bbox (cache in KV)
2) Query Overpass for POIs
3) Normalize POIs
4) Force include must-sees
5) Cluster geographically by day
6) Order stops using OSRM table matrix (nearest neighbor heuristic)
7) Insert meals
8) Add durations
9) Estimate budget
10) Generate explanation text

OSRM:
Use public HTTP endpoints but cache responses.
Use /table for matrix and /route for geometry.

---------------------------------------
AI TRAVEL ASSISTANT CHAT
---------------------------------------

Add a collapsible right drawer called:
“Wayfare Assistant”

Requirements:
- Receives itinerary JSON context
- Streaming responses
- Local chat memory (localStorage)

Tool routing system:
If user message matches intent, call:

replan_day(dayNumber)
swap_stop(stopId)
suggest_nearby(category, radius)
adjust_budget(newBudget)
change_pace(mode)

Assistant must NOT hallucinate POIs.
It can only:
- reference itinerary stops
- fetch new POIs from Overpass via backend

POST /api/chat
Input:
{
  message,
  itinerary,
  preferences
}

Output:
{
  assistantMessage,
  updatedItinerary?
}

Provide:
- Default rule-based assistant (no API key required)
- Optional AI provider via env variable (OpenAI-compatible)

---------------------------------------
DESIGN REQUIREMENTS
---------------------------------------

Modern 2026 aesthetic:
- Sand → ocean soft gradient background
- Glassmorphism cards
- Large typography
- Rounded components
- Subtle motion
- Split view:
    Left: Timeline
    Right: Map
- Mobile responsive (tab switcher: Plan / Map / Chat)

Components:
- Hero header with city + dates + budget pill
- DayCard accordion
- StopRow with time, travel chip, cost chip
- Nearby swap modal
- Explanation panel
- Chat UI with tool action buttons

Accessibility:
- keyboard navigation
- focus states
- proper contrast

---------------------------------------
API ROUTES (Worker)
---------------------------------------

GET /api/geocode?q=
GET /api/pois?bbox=
GET /api/osrm/table
GET /api/osrm/route
POST /api/plan
POST /api/chat
POST /api/share
GET /api/share/:slug

Rate limit using KV.

---------------------------------------
DELIVERABLES
---------------------------------------

1) Full folder structure
2) All core files in full (not pseudo code)
3) D1 schema
4) wrangler.toml config
5) README with:
   - local dev
   - wrangler deploy
   - D1 + KV setup
   - environment variables

Build it so it runs immediately after:
npm install
npm run dev

Then:
wrangler deploy

Now generate the complete codebase.

SKILLS.md use this skill