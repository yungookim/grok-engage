# Browser-Based Discovery Design

## Problem

X API rate limits are being exhausted too quickly, preventing continuous thread discovery.

## Solution

Replace API-based keyword search with browser scraping via Claude-in-Chrome. This allows unlimited reads (no formal rate limits) while keeping API for posting replies.

## Scope

- **In scope:** Keyword search via browser scraping
- **Out of scope:** Posting replies, getting metrics (still use X API)

## Architecture

### New Components

1. **`server/services/browser-discovery.js`** - Processes scraped tweets through existing pipeline
2. **`POST /api/browser-discovery`** - Endpoint to receive scraped data
3. **Dashboard button** - "Browser Discovery" button in thread feed

### Data Flow

```
User clicks "Browser Discovery"
    ↓
Claude scrapes X search (x.com/search?q={keyword}&f=top)
    ↓
POST /api/browser-discovery with scraped tweets
    ↓
browser-discovery.js processes:
    - Filter by engagement threshold
    - Skip existing threads
    - Score relevance (existing relevance.js)
    - Insert qualifying threads
    ↓
Dashboard refreshes thread list
```

### Scraped Tweet Format

```javascript
{
  id: "1234567890",           // Tweet ID from URL
  text: "Tweet content...",
  author_username: "handle",
  author_name: "Display Name",
  metrics: {
    replies: 45,
    retweets: 12,
    likes: 89,
    views: 5000
  },
  url: "https://x.com/handle/status/1234567890",
  timestamp: "2026-01-23T10:30:00Z"
}
```

### Limitations

- Unauthenticated access may show fewer results than API
- No `conversation_id` available (derived from tweet URL)
- X may show login prompts (dismissed by automation)
- Informal rate limiting (may get blocked after heavy use)

## Files Changed

| File | Change |
|------|--------|
| `server/services/browser-discovery.js` | New - tweet processing service |
| `server/routes/api.js` | Add POST /api/browser-discovery endpoint |
| `dashboard/js/components/thread-feed.js` | Add "Browser Discovery" button |

## Fallback

Existing API-based discovery remains functional. Users can choose either method.
