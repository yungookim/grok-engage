# Ralph Fix Plan

## Project: X Thread Monitor
A local tool that monitors X (Twitter) for relevant conversations, suggests context-aware replies, learns from engagement patterns, and posts directly from a dashboard.

---

## High Priority

### Phase 1: Project Foundation
- [x] Initialize Node.js project with package.json (express, better-sqlite3, twitter-api-v2, openai, node-cron, dotenv)
- [x] Create Express server entry point (server/index.js) with security headers (CSP, X-Content-Type-Options, X-Frame-Options)
- [x] Create SQLite database schema (server/db/schema.sql) with all 8 tables
- [x] Implement database initialization and query helpers (server/db/db.js)
- [x] Create config module for environment variables and defaults (server/config.js)
- [x] Create .env.example with all required environment variables

### Phase 2: External API Integration
- [x] Implement X API client (server/services/x-api.js) - search, post reply, get metrics, get thread replies
- [x] Implement Grok/xAI client (server/services/llm.js) - chat, chatJson helper
- [x] Implement rate limiter for X API (track monthly usage, budget per day)
- [x] Implement credential encryption/decryption (server/services/crypto.js)

### Phase 3: Thread Discovery
- [x] Implement thread discovery service (server/services/discovery.js)
- [x] Implement semantic relevance scoring (server/services/relevance.js) with Grok prompts
- [x] Implement scheduler with node-cron (server/services/scheduler.js) - discovery every N minutes, metrics every hour
- [x] Create threads API routes (GET list, GET single, POST view, POST skip, DELETE)

---

## Medium Priority

### Phase 4: Reply Generation
- [x] Implement reply generator service (server/services/reply-generator.js) with three reply types
- [x] Create replies API routes (POST generate, POST regenerate, POST post, GET list, GET single)
- [x] Implement regeneration options (funnier, shorter, technical, casual, no-promo, with-promo)

### Phase 5: Learning Engine
- [x] Implement learning engine (server/services/learning.js)
- [x] Layer 1: Thread selection learning (track views, skips, extract features)
- [x] Layer 2: Reply style learning (track edits, compute diff, update patterns)
- [x] Layer 3: Outcome tracking (schedule metric checks, update patterns)
- [x] Implement metrics fetching service (server/services/metrics.js)

### Phase 6: Web Dashboard - Core
- [x] Create dashboard shell (dashboard/index.html) with Tailwind CDN config
- [x] Create app.js with hash-based router and state management
- [x] Create api.js client module for all server endpoints
- [x] Create utils.js with escapeHtml, formatFollowers, formatTimeAgo, getToneColor helpers
- [x] Implement thread-feed.js component (list view with pagination)
- [x] Implement thread-card.js component (DOM-based, safe construction)
- [x] Implement reply-composer.js component (generate, edit, regenerate, post)

---

## Low Priority

### Phase 7: Dashboard - Settings & Analytics
- [x] Implement settings-view.js (keywords CRUD, product profiles CRUD, credentials)
- [x] Create settings API routes (GET/PUT settings, keywords CRUD, profiles CRUD)
- [x] Implement analytics-view.js (summary stats, learning insights, outcome data)
- [x] Create analytics API routes (GET summary, GET insights, GET outcomes)
- [ ] Implement setup-wizard.js for first-run experience

### Phase 8: Polish & Optimization
- [x] Add auto-skip for stale threads (>24 hours old, not viewed)
- [x] Implement outcome insights generation (best performing reply types, thread tones)
- [x] Add dashboard auto-refresh (configurable interval)
- [x] Add monitoring status indicator
- [ ] Create README.md with installation and usage instructions

---

## Remaining Tasks
- [ ] Install npm dependencies (npm install)
- [ ] Test server startup and verify all endpoints work
- [ ] Create README.md with installation and usage instructions
- [ ] Implement setup-wizard.js for first-run experience (optional)

---

## Completed
- [x] Project initialization (design.md created)
- [x] Ralph conversion setup
- [x] All Phase 1-6 implementation
- [x] Phase 7 Settings & Analytics views
- [x] Phase 8 auto-skip, insights, auto-refresh, status indicator
- [x] Wire routes in server/index.js

---

## Notes

### API Rate Limits (X API Basic Tier)
- 10,000 tweets/month read → ~333/day → ~1 per 5-minute check
- 500 posts/month write
- Reserve capacity for metrics fetching on posted replies

### Key Data Structures

**Product Profile Fields:**
- name, one_liner, problems_solved[], target_audience[]
- relevant_keywords[], tone_keywords[]
- when_to_mention, when_not_to_mention, url

**Thread Status Flow:**
new → viewed → replied OR skipped

**Reply Types:**
1. value-add: Pure value, no product mention
2. light-promo: Helpful + natural product mention
3. direct: Explicit recommendation for tool searches

### Security Reminders
- Always use textContent, never innerHTML for user content
- Validate all API inputs server-side
- Use parameterized queries for SQLite
- Encrypt credentials with AES-256-GCM
- Set CSP headers on all responses
