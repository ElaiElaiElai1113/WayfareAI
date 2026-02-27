# WAYFARE AI

Tagline: **Smarter routes. Better journeys.**

Production-ready MVP with:
- React 18 + Vite + TypeScript frontend
- TailwindCSS + shadcn-style UI primitives + Framer Motion
- Cloudflare Worker API (Hono)
- Cloudflare D1 for saved/shareable itineraries
- Cloudflare KV for cache + rate limit
- Free data only: Nominatim, Overpass, OSRM

## Project Structure

```text
/wayfare-ai
  /client
  /worker
  wrangler.toml
  README.md
```

## Quick Start

1. Install dependencies:
```bash
cd wayfare-ai
npm install
```

2. Start both frontend + worker locally:
```bash
npm run dev
```
- Client: `http://localhost:5173`
- Worker: `http://127.0.0.1:8787`

## Cloudflare Setup

### 1) Create D1 database
```bash
npx wrangler d1 create wayfare_ai
```
Update `database_id` in `wrangler.toml`.

### 2) Apply schema migration
```bash
npx wrangler d1 migrations apply wayfare_ai --local --config wrangler.toml
npx wrangler d1 migrations apply wayfare_ai --remote --config wrangler.toml
```

### 3) Create KV namespaces
```bash
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create RATE_LIMIT
```
Update the two namespace IDs in `wrangler.toml`.

## Environment Variables

Set via `wrangler.toml` `[vars]` and secrets:

Required vars in `wrangler.toml`:
- `OSRM_BASE_URL` (default: `https://router.project-osrm.org`)
- `NOMINATIM_BASE_URL` (default: `https://nominatim.openstreetmap.org`)
- `OVERPASS_BASE_URL` (default: `https://overpass-api.de/api/interpreter`)
- `CACHE_TTL_SECONDS`
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_REQUESTS`
- `APP_BASE_URL` (optional, for share links)

Optional AI provider (OpenAI-compatible):
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put OPENAI_BASE_URL
npx wrangler secret put OPENAI_MODEL
```

## Deploy

```bash
npx wrangler deploy --config wrangler.toml
```

## API Routes

- `GET /api/geocode?q=`
- `GET /api/pois?bbox=`
- `GET /api/osrm/table?profile=&coordinates=`
- `GET /api/osrm/route?profile=&coordinates=`
- `POST /api/plan`
- `POST /api/chat`
- `POST /api/share`
- `GET /api/share/:slug`

## Chat Assistant

The `Wayfare Assistant` drawer supports tool-style commands:
- `replan_day(dayNumber)`
- `swap_stop(stopId)`
- `suggest_nearby(category,radius)`
- `adjust_budget(newBudget)`
- `change_pace(mode)`

It never fabricates POIs. New places come from Overpass only.

## Notes

- Frontend stores chat memory in browser `localStorage`.
- `/api/chat?stream=true` streams NDJSON token chunks.
- Route and geocode calls are cached in KV.
- API calls are rate-limited per client IP with KV.
