# GLM z.AI Integration Setup

## Overview

Wayfare AI now supports GLM z.AI for intelligent travel planning assistance. The AI is used for:

1. **Chat Assistant** - Interactive help with itinerary modifications
2. **Itinerary Generation** (optional) - AI-powered stop suggestions

## Quick Setup

### 1. Set API Key as Cloudflare Secret

Run the following command in your terminal:

```bash
npx wrangler secret put GLM_API_KEY
```

When prompted, paste your GLM z.AI API key:
```
e1e40b39cf814fdd99d140fb3c7bf862.XL1PNaa753gqkGIC
```

### 2. Verify Configuration

Check that your `wrangler.toml` has the correct GLM settings:

```toml
GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
GLM_MODEL = "glm-4-flash"
```

## Available GLM Models

| Model | Context | Speed | Best For |
|-------|----------|-------|----------|
| `glm-4-flash` | 128K tokens | Fastest | Real-time chat, quick responses |
| `glm-4.7` | 128K tokens | Fast | General tasks, good balance (default) |
| `glm-4` | 128K tokens | Fast | General tasks, good balance |
| `glm-4-plus` | 128K tokens | Medium | Complex queries |
| `glm-4-long` | 1M tokens | Slower | Long-form content generation |

To change the model, set the `GLM_MODEL` secret:

```bash
npx wrangler secret put GLM_MODEL
```

Then enter your preferred model name.

## Testing

### Test Chat Assistant

1. Start your dev server: `cd wayfare-ai && npm run dev`
2. Open http://localhost:5173
3. Generate an itinerary
4. Open the Chat drawer and try commands like:
   - "What's good for lunch near my hotel?"
   - "Suggest some hidden gems nearby"
   - "Change pace to Relaxed"

### Test Locally

To test without deploying to Cloudflare:

1. Set environment variables in your terminal:
   ```bash
   export GLM_API_KEY="e1e40b39cf814fdd99d140fb3c7bf862.XL1PNaa753gqkGIC"
   export GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
   export GLM_MODEL="glm-4-flash"
   ```

2. Or use a `.dev.vars` file:
   ```bash
   GLM_API_KEY="e1e40b39cf814fdd99d140fb3c7bf862.XL1PNaa753gqkGIC"
   GLM_BASE_URL="https://open.bigmodel.cn/api/paas/v4"
   GLM_MODEL="glm-4-flash"
   ```

3. Then run:
   ```bash
   npx wrangler dev --local --env .dev.vars
   ```

## API Usage

The chat endpoint at `/api/chat` now uses GLM z.AI with the following behavior:

1. **Rule-based commands** are processed first (fast, deterministic):
   - `replan_day(1)` - Reverses stops for day 1
   - `swap_stop(stop_id)` - Swaps a stop with nearby alternative
   - `suggest_nearby(restaurant, 2000)` - Finds nearby restaurants
   - `adjust_budget(300)` - Adjusts budget
   - `change_pace(Relaxed)` - Changes travel pace

2. **AI responses** - For general queries, GLM provides intelligent suggestions

## Cost Considerations

GLM z.AI pricing (as of 2024):
- **glm-4-flash**: ~$0.0001 / 1K tokens (input)
- **glm-4**: ~$0.00025 / 1K tokens (input)
- **glm-4-plus**: ~$0.0005 / 1K tokens (input)

Typical usage per itinerary plan: ~500-2000 tokens

## Troubleshooting

### "GLM API credentials not configured"

- Make sure you ran `npx wrangler secret put GLM_API_KEY`
- Check the secret exists: `npx wrangler secret list`

### Chat responses are slow

- Try switching to `glm-4-flash` for faster responses
- Check your GLM API quota at https://open.bigmodel.cn/console

### AI responses aren't helpful

- Increase `temperature` in `worker/src/utils.ts` `callGLM` function
- Adjust the system prompt for better instructions

## Security Notes

⚠️ **Important**: Your API key is now stored securely in Cloudflare Secrets, not in the codebase.

- Never commit API keys to git
- Use different keys for development and production
- Rotate keys periodically
- Monitor usage at https://open.bigmodel.cn/console
