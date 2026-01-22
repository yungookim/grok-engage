# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start server at http://localhost:3001
npm run dev        # Start with auto-reload (--watch)
npm install        # Install dependencies
```

No test runner configured. No linter configured.

## Architecture

**grok-engage** is a local-first tool for X (Twitter) engagement automation. It monitors X for relevant threads, generates AI replies via Grok/xAI, and learns from user engagement patterns.

### Data Flow

```
Dashboard (Vanilla JS) → Express API → SQLite DB
                              ↓
                    X API (twitter-api-v2)
                    xAI API (OpenAI SDK)
```

### Key Services (`server/services/`)

| Service | Purpose |
|---------|---------|
| `scheduler.js` | Background cron jobs for discovery and experimentation cycles |
| `discovery.js` | Searches X for threads matching keywords, scores them semantically |
| `x-api.js` | X API wrapper with rate limiting and usage tracking |
| `llm.js` | xAI/Grok API wrapper using OpenAI SDK |
| `reply-generator.js` | Generates reply suggestions (value-add, light-promo, direct) |
| `learning.js` | Computes learned patterns from user behavior |
| `keyword-generator.js` | Auto-generates keywords from product profiles |
| `crypto.js` | AES-256-GCM encryption for credential storage |

### Database Schema (`server/db/schema.sql`)

Core tables:
- `threads` - Discovered X conversations with relevance scores
- `replies` - Generated/posted replies with outcome metrics
- `keywords` - Monitoring keywords with performance scores
- `product_profiles` - Products to promote (name, audience, problems solved)
- `learned_patterns` - Computed preferences from user behavior
- `credentials` - Encrypted API keys
- `settings` - App configuration (stored as key-value)

### Frontend (`dashboard/`)

Single-page app using vanilla JS with Tailwind CSS (CDN). Components in `dashboard/js/components/`:
- `thread-feed.js` - Main thread list view
- `reply-composer.js` - Reply editing and posting
- `settings-view.js` - API keys, keywords, profiles
- `setup-wizard.js` - First-run configuration

### Credential Storage

Credentials can be provided via:
1. Environment variables (`.env` file)
2. Dashboard UI (stored encrypted in `credentials` table)

Both sources are checked at runtime. DB credentials override env vars when present.

### Self-Improving Keywords

Keywords track `performance_score` (0-100) based on engagement:
- Score increases when user engages with matched threads
- Score decreases when threads are skipped
- Low-scoring auto-generated keywords get disabled
- New keywords are generated from successful threads via `keyword-generator.js`
