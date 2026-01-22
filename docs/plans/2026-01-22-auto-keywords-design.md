# Automated Keywords Generation & Refinement

## Overview

Automatically generate keywords from product profiles and continuously improve them based on engagement data. Keywords get their own dedicated page in the sidebar with configuration, notifications, and performance reports.

## Feature 1: Keyword Generation on Profile Creation

### Trigger
When a product profile is created (via URL generation or manual entry)

### Process
1. After profile is saved, call LLM with profile data
2. LLM generates 5-10 relevant keywords based on:
   - `problems_solved` → pain-point keywords
   - `target_audience` → audience-specific terms
   - `relevant_keywords` from profile (if URL-generated)
3. Auto-add keywords to the keywords table with category `auto-generated`
4. Link keywords to the source profile via `source_profile_id`

### Example
Profile for "TaskFlow" (project management tool) → generates:
- "project management frustration"
- "todo app recommendations"
- "team collaboration tools"
- "workflow automation"

### Deduplication
Skip keywords that already exist (exact or fuzzy match)

## Feature 2: Keyword Performance Tracking

### New Database Fields
Add to `keywords` table:
- `source_profile_id` - which profile generated this keyword (null for manual)
- `performance_score` - rolling score based on engagement (0-100, default 50)
- `threads_matched` - count of threads found with this keyword
- `threads_engaged` - count of threads where user engaged (replied/viewed)

### Scoring Logic
- Thread matches keyword + user **engages** → +5 points
- Thread matches keyword + user **skips** → -2 points
- Thread matches keyword + **no action** for 24h → -1 point
- Score clamped between 0-100

### Integration
Hook into existing learning service (`/server/services/learning.js`) which already tracks thread outcomes at 1h, 6h, 24h intervals.

## Feature 3: Automatic Keyword Refinement

### Refinement Job
Runs daily via existing scheduler

### Demoting Low Performers
- If `performance_score` < 20 AND `threads_matched` > 10 → auto-disable keyword
- Rationale: Enough data to judge, consistently leads to skipped threads

### Promoting New Keywords
- Analyze threads that got engagement but didn't match existing keywords
- Extract common terms/topics using LLM
- If a term appears in 3+ engaged threads → add as new keyword
- Auto-add with category `auto-discovered`

### Changes Log
New table `keyword_changes`:
- `id`, `keyword_id`, `action` (added/disabled/re-enabled), `reason`, `created_at`
- Powers the notification display in dashboard

### Safety Rails
- Never auto-delete, only disable (user can re-enable)
- Manual keywords exempt from auto-disable (only auto-generated ones)
- Max 5 new keywords added per day (prevent runaway growth)

## Feature 4: Keywords Page

### Navigation
New sidebar item: "Keywords" (dedicated page, removed from Settings)

### Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Keywords                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Notifications Banner - if recent changes]              │
│ • Added "saas pricing" (discovered from engaged threads)│
│ • Disabled "project tips" (low engagement)              │
│                                                         │
│ ── Performance Overview ──────────────────────────────  │
│ Active: 12  |  Disabled: 3  |  Avg Score: 67           │
│                                                         │
│ Top Performers          Underperforming                 │
│ • "saas tools" (89)     • "startup tips" (23)          │
│ • "indie maker" (82)    • "tech news" (18)             │
│                                                         │
│ ── Manage Keywords ───────────────────────────────────  │
│ [Add keyword input...] [Category ▾] [Add]              │
│                                                         │
│ [keyword list with scores, toggle, delete]             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Notifications Banner
- Shows changes from last 7 days
- Dismiss hides until new changes occur
- Each item links to the keyword (can re-enable disabled ones)
- Collapsed by default if no recent changes

## File Changes

### Database Changes
**schema.sql + db.js:**
- Add to `keywords`: `source_profile_id`, `performance_score`, `threads_matched`, `threads_engaged`
- New table: `keyword_changes` (id, keyword_id, action, reason, created_at)

### New Files
| File | Purpose |
|------|---------|
| `/server/services/keyword-generator.js` | LLM-based keyword generation + refinement logic |
| `/dashboard/js/components/keywords-view.js` | New Keywords page UI |

### Modified Files
| File | Changes |
|------|---------|
| `/server/services/llm.js` | Add `generateKeywords()` and `discoverKeywords()` functions |
| `/server/routes/settings.js` | Call keyword generation after profile creation |
| `/server/services/scheduler.js` | Add daily keyword refinement job |
| `/server/services/learning.js` | Update keyword scores when tracking outcomes |
| `/server/db/db.js` | New DB functions for keyword scoring + changes log |
| `/dashboard/js/app.js` | Add Keywords to sidebar navigation |
| `/dashboard/js/components/settings-view.js` | Remove Keywords tab |
| `/dashboard/index.html` | Import new keywords-view.js |
