# Wayfare AI - Deployment Guide

## Production-Ready Features Implemented

### Backend (Cloudflare Worker)
- ✅ **Retry Logic**: Exponential backoff with jitter for all external API calls (Nominatim, Overpass, OSRM)
- ✅ **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
- ✅ **CORS Configuration**: Configurable allowed origins via `ALLOWED_ORIGINS` env var
- ✅ **Request Logging**: Logs all API requests with timing metrics
- ✅ **Environment Validation**: Validates all required environment variables on startup
- ✅ **Health Check**: Comprehensive health endpoint with database and cache connection checks
- ✅ **Error Handling**: Consistent error responses with proper HTTP status codes
- ✅ **Input Validation**: SQL injection prevention, coordinate validation
- ✅ **Request Timeouts**: Configurable timeouts for all external API calls
- ✅ **Metrics Storage**: Optional KV namespace for request metrics

### Frontend (React/Vite)
- ✅ **Error Boundary**: Global error boundary with user-friendly error messages
- ✅ **Loading States**: Skeleton screens for itinerary, map, and form during loading
- ✅ **React Query Retry**: Automatic retry with exponential backoff for API calls
- ✅ **Proper Caching**: Configurable stale time and refetch behavior

## Environment Variables

### Required (set in wrangler.toml)
```toml
OSRM_BASE_URL = "https://router.project-osrm.org"
NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org"
OVERPASS_BASE_URL = "https://overpass-api.de/api/interpreter"
CACHE_TTL_SECONDS = "21600"
RATE_LIMIT_WINDOW_SECONDS = "60"
RATE_LIMIT_MAX_REQUESTS = "80"
```

### Optional
```toml
ALLOWED_ORIGINS = "*"  # Comma-separated origins, "*" for all
APP_BASE_URL = ""      # Base URL for share links (auto-detected if empty)
```

### Cloudflare Secrets (for OpenAI integration)
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put OPENAI_BASE_URL
npx wrangler secret put OPENAI_MODEL
```

## Deployment Steps

### 1. Configure D1 Database Migrations
Create the required tables:
```sql
CREATE TABLE IF NOT EXISTS shared_itineraries (
  slug TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  itinerary_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_created_at ON shared_itineraries(created_at);
```

### 2. Deploy Worker
```bash
cd wayfare-ai/worker
npx wrangler deploy
```

### 3. Deploy Client
```bash
cd wayfare-ai/client
npm run build
# Deploy the dist/ folder to your hosting (Cloudflare Pages, Vercel, Netlify, etc.)
```

### 4. Update Client API URL
If your worker is deployed to a custom domain, update the proxy target in `client/vite.config.ts`:
```typescript
proxy: {
  "/api": {
    target: "https://your-worker-domain.workers.dev",
    changeOrigin: true
  }
}
```

## Monitoring & Observability

### Health Check Endpoint
```bash
curl https://your-worker.workers.dev/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "wayfare-ai-worker",
  "database": true,
  "cache": true,
  "external_services": true
}
```

### Metrics (Optional)
Enable the `REQUEST_METRICS` KV namespace in `wrangler.toml` to collect request metrics for analysis.

## Rate Limiting
- **Default**: 80 requests per 60 seconds per IP
- **Configuration**: Set via `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`
- **Response**: HTTP 429 with `retryAfter` header when limit exceeded

## Caching Strategy
- **Geocoding**: 6 hours (configurable via `CACHE_TTL_SECONDS`)
- **POI Queries**: 6 hours
- **OSRM Routes**: 6 hours
- **Distance Tables**: 6 hours

## Security Considerations
1. **API Keys**: Store sensitive keys (OpenAI) as Cloudflare secrets, not in wrangler.toml
2. **CORS**: Restrict `ALLOWED_ORIGINS` to your frontend domains in production
3. **Rate Limiting**: Adjust based on your external API quotas
4. **Input Validation**: All inputs are validated with Zod schemas

## Troubleshooting

### Worker fails to start
Check that all required environment variables are set in `wrangler.toml`.

### Database connection errors
Verify D1 database ID is correct and tables are created.

### CORS errors
Set `ALLOWED_ORIGINS` to include your frontend domain.

### Rate limit errors
Increase `RATE_LIMIT_MAX_REQUESTS` or reduce the window size.
