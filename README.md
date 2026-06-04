# Chan Family Dinner Agent 🍽️

Checks your Google Calendar for 5–8pm events, finds nearby restaurants and carparks, and sends results to Telegram.

## Deploy to Vercel (10 minutes)

### Step 1 — Create a GitHub repository
1. Go to https://github.com/new
2. Name it `dinner-agent`, set to Private
3. Upload all these files (drag & drop)

### Step 2 — Deploy to Vercel
1. Go to https://vercel.com and sign up (free)
2. Click **"Add New Project"**
3. Import your `dinner-agent` GitHub repo
4. Click **Deploy** (leave all settings default)

### Step 3 — Add your API keys as Environment Variables
In Vercel dashboard → your project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `GMAIL_TOKEN` | Your Gmail OAuth access token (ya29...) |
| `PLACES_KEY` | Your Google Places API key (AIza...) |
| `TG_TOKEN` | Your Telegram bot token (8982...) |
| `TG_CHAT_ID` | Your Telegram chat ID (8863...) |

Click **Save** then go to **Deployments → Redeploy**.

### Step 4 — Share the URL
Vercel gives you a URL like `https://dinner-agent-xxx.vercel.app`
Share it with your wife — works on any browser, any device!

## ⚠️ Gmail Token Refresh
The Gmail OAuth token expires every ~1 hour. To fix this permanently:
- Go to OAuth Playground → check "Auto-refresh token"
- Or ask about setting up a refresh token flow

## Files
- `api/agent.js` — Backend: calls Gmail, Google Places, Telegram
- `public/index.html` — Frontend UI
- `vercel.json` — Vercel routing config
- `package.json` — Node.js config
