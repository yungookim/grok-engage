# grok-engage - Technical Design Document

> A local tool that monitors X (Twitter) for relevant conversations, suggests context-aware replies, learns from your engagement patterns, and posts directly from a dashboard.

## Overview

### Problem

Building an audience on X requires consistent, valuable engagement in relevant conversations. Finding the right threads at the right time is manual and time-consuming. When you do find them, crafting replies that add value (vs. feeling spammy) takes thought.

### Solution

A self-hosted Node.js application that:

1. **Monitors X** for threads matching your keywords and interests
2. **Filters by engagement** (configurable threshold, default 15+ replies)
3. **Scores relevance** using semantic matching against your product/interests
4. **Suggests replies** that match the thread's tone (humorous, technical, casual)
5. **Learns over time** what threads you engage with and what replies perform best
6. **Posts directly** from a local web dashboard

### Design Principles

- **Local-first**: All data stays on your machine
- **Simple stack**: Plain HTML/JS + Tailwind, no build step for frontend
- **Generic**: Works for any product/brand, not hardcoded to one use case
- **Learning**: Gets smarter with use, surfaces insights about what works
- **Secure**: All user content sanitized to prevent XSS

---

## Architecture

### System Diagram

```
+---------------------------------------------------------------------+
|                         Local Machine                               |
|                                                                     |
|  +---------------------+         +----------------------------+     |
|  |   Node.js Server    |         |    Web Dashboard           |     |
|  |   (Express)         |<------->|    (localhost:3001)        |     |
|  |                     |   REST  |                            |     |
|  |  +---------------+  |   API   |  +----------------------+  |     |
|  |  | Scheduler     |  |         |  | Thread Feed          |  |     |
|  |  | (node-cron)   |  |         |  | - New threads        |  |     |
|  |  +---------------+  |         |  | - Relevance scores   |  |     |
|  |                     |         |  | - Quick actions      |  |     |
|  |  +---------------+  |         |  +----------------------+  |     |
|  |  | X API Client  |  |         |                            |     |
|  |  | (twitter-api) |  |         |  +----------------------+  |     |
|  |  +---------------+  |         |  | Reply Composer       |  |     |
|  |                     |         |  | - AI suggestions     |  |     |
|  |  +---------------+  |         |  | - Edit before post   |  |     |
|  |  | Grok Client   |  |         |  | - Post directly      |  |     |
|  |  | (xAI API)     |  |         |  +----------------------+  |     |
|  |  +---------------+  |         |                            |     |
|  |                     |         |  +----------------------+  |     |
|  |  +---------------+  |         |  | Analytics            |  |     |
|  |  | SQLite DB     |  |         |  | - Performance stats  |  |     |
|  |  | (better-sql3) |  |         |  | - Learning insights  |  |     |
|  |  +---------------+  |         |  +----------------------+  |     |
|  |                     |         |                            |     |
|  |  +---------------+  |         |  +----------------------+  |     |
|  |  | Learning      |  |         |  | Settings             |  |     |
|  |  | Engine        |  |         |  | - Product profiles   |  |     |
|  |  +---------------+  |         |  | - Keywords           |  |     |
|  |                     |         |  | - Credentials        |  |     |
|  +---------------------+         |  +----------------------+  |     |
|                                  +----------------------------+     |
+---------------------------------------------------------------------+
              |                                |
              v                                v
       +-------------+                  +-------------+
       |   X API     |                  |   xAI API   |
       |   (v2)      |                  |   (Grok)    |
       |             |                  |             |
       | - Search    |                  | - Relevance |
       | - Post      |                  | - Replies   |
       | - Metrics   |                  | - Learning  |
       +-------------+                  +-------------+
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Express Server** | HTTP API, serves dashboard, coordinates all services |
| **Scheduler** | Runs monitoring loop every N minutes via node-cron |
| **X API Client** | Search tweets, post replies, fetch engagement metrics |
| **Grok Client** | Score relevance, generate replies, analyze patterns |
| **SQLite DB** | Persist threads, replies, feedback, settings, learned data |
| **Learning Engine** | Aggregate feedback, compute insights, adjust scoring |
| **Web Dashboard** | User interface for all interactions |

---

## Security Considerations

### XSS Prevention

All user-generated content and data from external sources (X API) must be sanitized before rendering:

```javascript
// dashboard/js/utils.js

// Always use this for any content from X API or user input
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// For rendering dynamic content, prefer textContent over innerHTML
export function setTextContent(element, text) {
    element.textContent = text;
}

// When HTML structure is needed, build with DOM methods
export function createThreadCard(thread) {
    const card = document.createElement('div');
    card.className = 'thread-card bg-gray-900 border border-gray-800 rounded-lg p-4';
    card.dataset.threadId = thread.id;

    const authorName = document.createElement('span');
    authorName.className = 'font-semibold';
    authorName.textContent = thread.x_author_name || 'Unknown';

    const content = document.createElement('p');
    content.className = 'text-gray-200 mb-4 whitespace-pre-wrap';
    content.textContent = thread.content;  // Safe: uses textContent

    // ... build rest of DOM structure
    return card;
}
```

### Content Security Policy

The dashboard sets appropriate CSP headers:

```javascript
// server/index.js

app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://cdn.tailwindcss.com; " +
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'"
    );
    next();
});
```

### Input Validation

All API inputs are validated server-side:

```javascript
// server/middleware/validate.js

export function validateThreadId(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid thread ID' });
    }
    req.threadId = id;
    next();
}

export function validateReplyText(req, res, next) {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Reply text required' });
    }
    if (text.length > 280) {
        return res.status(400).json({ error: 'Reply exceeds 280 characters' });
    }
    next();
}
```

---

## Data Model

### SQLite Schema

```sql
-- Product profiles (generic, supports multiple products)
CREATE TABLE product_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    one_liner TEXT,
    problems_solved TEXT,  -- JSON array
    target_audience TEXT,  -- JSON array
    relevant_keywords TEXT,  -- JSON array
    tone_keywords TEXT,  -- JSON array
    when_to_mention TEXT,
    when_not_to_mention TEXT,
    url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keywords for monitoring
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,  -- 'pain-point', 'tool-discovery', 'building-in-public', 'custom'
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Discovered threads
CREATE TABLE threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    x_tweet_id TEXT NOT NULL UNIQUE,
    x_author_id TEXT NOT NULL,
    x_author_username TEXT,
    x_author_name TEXT,
    x_author_followers INTEGER,
    content TEXT NOT NULL,
    reply_count INTEGER,
    like_count INTEGER,
    retweet_count INTEGER,
    view_count INTEGER,
    thread_url TEXT,

    -- Relevance scoring
    keyword_matches TEXT,  -- JSON array of matched keywords
    semantic_score INTEGER,  -- 0-100 from Grok
    relevance_reasoning TEXT,  -- Grok's explanation
    detected_tone TEXT,  -- 'casual', 'serious', 'technical', 'rant', 'question'
    detected_topic TEXT,  -- 'feature-requests', 'tool-search', 'venting', etc.

    -- Status tracking
    status TEXT DEFAULT 'new',  -- 'new', 'viewed', 'replied', 'skipped'
    first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    viewed_at DATETIME,
    replied_at DATETIME,
    skipped_at DATETIME,

    -- Thread metadata
    x_created_at DATETIME,
    conversation_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generated and posted replies
CREATE TABLE replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id),
    product_profile_id INTEGER REFERENCES product_profiles(id),

    -- Generation
    suggested_text TEXT NOT NULL,
    edited_text TEXT,  -- NULL if posted without edits
    final_text TEXT NOT NULL,  -- What was actually posted
    reply_type TEXT,  -- 'value-add', 'light-promo', 'direct'
    generation_reasoning TEXT,  -- Grok's explanation for the suggestion

    -- Edits tracking (for learning)
    was_edited INTEGER DEFAULT 0,
    edit_diff TEXT,  -- JSON describing what changed

    -- Posting
    x_reply_id TEXT,  -- ID of posted tweet, NULL if not posted
    posted_at DATETIME,

    -- Outcome tracking
    views_1h INTEGER,
    views_6h INTEGER,
    views_24h INTEGER,
    likes_1h INTEGER,
    likes_6h INTEGER,
    likes_24h INTEGER,
    replies_1h INTEGER,
    replies_6h INTEGER,
    replies_24h INTEGER,

    -- Outcome fetching status
    last_metrics_fetch DATETIME,
    metrics_fetch_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Explicit user feedback
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER REFERENCES threads(id),
    reply_id INTEGER REFERENCES replies(id),
    feedback_type TEXT NOT NULL,  -- 'good-thread', 'bad-thread', 'good-reply', 'bad-reply'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learned patterns (computed by learning engine)
CREATE TABLE learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,  -- 'thread-preference', 'reply-style', 'timing', 'outcome'
    pattern_key TEXT NOT NULL,
    pattern_value TEXT NOT NULL,  -- JSON
    confidence REAL,  -- 0.0 - 1.0
    sample_count INTEGER,
    last_computed DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(pattern_type, pattern_key)
);

-- Application settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Credentials (encrypted)
CREATE TABLE credentials (
    key TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_threads_status ON threads(status);
CREATE INDEX idx_threads_first_seen ON threads(first_seen_at);
CREATE INDEX idx_threads_semantic_score ON threads(semantic_score);
CREATE INDEX idx_replies_thread ON replies(thread_id);
CREATE INDEX idx_replies_posted ON replies(posted_at);
CREATE INDEX idx_feedback_thread ON feedback(thread_id);
```

### Default Settings

```javascript
const DEFAULT_SETTINGS = {
    // Monitoring
    'monitoring.enabled': true,
    'monitoring.interval_minutes': 5,
    'monitoring.min_replies': 15,
    'monitoring.semantic_threshold': 70,  // 0-100

    // Reply generation
    'replies.default_type': 'value-add',
    'replies.max_length': 280,
    'replies.include_product_mention': 'auto',  // 'auto', 'always', 'never'

    // Outcome tracking
    'tracking.check_intervals': [1, 6, 24],  // hours after posting
    'tracking.max_checks': 3,

    // UI
    'ui.threads_per_page': 20,
    'ui.auto_refresh': true,
    'ui.refresh_interval_seconds': 60
};
```

---

## Thread Discovery

### Search Strategy

```javascript
// Pseudocode for the discovery loop

async function discoverThreads() {
    const keywords = await db.getActiveKeywords();
    const settings = await db.getSettings();
    const minReplies = settings['monitoring.min_replies'];

    for (const keyword of keywords) {
        // 1. Search X for recent tweets matching keyword
        const tweets = await xApi.searchRecent({
            query: `${keyword.keyword} -is:retweet -is:reply`,
            max_results: 100,
            'tweet.fields': ['public_metrics', 'created_at', 'conversation_id'],
            'user.fields': ['public_metrics', 'username', 'name'],
            expansions: ['author_id']
        });

        for (const tweet of tweets) {
            // 2. Filter by engagement threshold
            if (tweet.public_metrics.reply_count < minReplies) {
                continue;
            }

            // 3. Skip if already in database
            if (await db.threadExists(tweet.id)) {
                continue;
            }

            // 4. Score semantic relevance with Grok
            const relevance = await scoreRelevance(tweet);

            if (relevance.score >= settings['monitoring.semantic_threshold']) {
                // 5. Store thread
                await db.insertThread({
                    x_tweet_id: tweet.id,
                    x_author_id: tweet.author_id,
                    content: tweet.text,
                    reply_count: tweet.public_metrics.reply_count,
                    // ... other fields
                    semantic_score: relevance.score,
                    relevance_reasoning: relevance.reasoning,
                    detected_tone: relevance.tone,
                    keyword_matches: [keyword.keyword]
                });
            }
        }
    }
}
```

### Semantic Relevance Scoring

```javascript
async function scoreRelevance(tweet) {
    const productProfiles = await db.getActiveProductProfiles();
    const learnedPreferences = await db.getLearnedPatterns('thread-preference');

    const prompt = `
You are evaluating whether a Twitter/X thread is relevant for engagement.

## Product Profiles
${productProfiles.map(p => `
### ${p.name}
- One-liner: ${p.one_liner}
- Problems solved: ${p.problems_solved.join(', ')}
- Target audience: ${p.target_audience.join(', ')}
- When to mention: ${p.when_to_mention}
- When NOT to mention: ${p.when_not_to_mention}
`).join('\n')}

## Learned Preferences (from past engagement)
${JSON.stringify(learnedPreferences, null, 2)}

## Tweet to Evaluate
Author: @${tweet.author_username} (${tweet.author_followers} followers)
Content: "${tweet.text}"
Engagement: ${tweet.reply_count} replies, ${tweet.like_count} likes

## Task
Score this thread's relevance (0-100) and analyze:

1. **Relevance Score**: How relevant is this for engaging? Consider:
   - Does it discuss problems the products solve?
   - Is the author in the target audience?
   - Would a reply add value to the conversation?
   - Based on learned preferences, would the user likely engage?

2. **Tone**: Classify as one of: casual, serious, technical, rant, question

3. **Topic**: Classify the main topic

4. **Reasoning**: Brief explanation of the score

Respond in JSON:
{
    "score": <0-100>,
    "tone": "<tone>",
    "topic": "<topic>",
    "reasoning": "<1-2 sentences>"
}
`;

    const response = await grok.chat({
        model: 'grok-3-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
}
```

### X API Rate Limits

| Tier | Read Limit | Post Limit | Cost |
|------|------------|------------|------|
| Basic | 10,000 tweets/month | 500 posts/month | $100/month |
| Pro | 1,000,000 tweets/month | 10,000 posts/month | $5,000/month |

**Strategy for Basic tier:**
- 10,000 / 30 days = ~333 tweets/day
- With 5-minute intervals = 288 checks/day
- Budget ~1 tweet per check for search
- Reserve capacity for fetching metrics on posted replies

```javascript
// Rate limit handling
class RateLimiter {
    constructor(monthlyLimit) {
        this.monthlyLimit = monthlyLimit;
        this.used = 0;
        this.resetDate = this.getNextResetDate();
    }

    canMakeRequest() {
        this.checkReset();
        return this.used < this.monthlyLimit;
    }

    recordRequest(count = 1) {
        this.used += count;
    }

    getRemainingBudget() {
        const daysRemaining = this.getDaysUntilReset();
        const remaining = this.monthlyLimit - this.used;
        return Math.floor(remaining / daysRemaining);
    }
}
```

---

## Reply Generation

### Generation Flow

```
+---------------------------------------------------------------------+
|                    Reply Generation Flow                             |
|                                                                     |
|  +-------------------------------------------------------------+   |
|  | Inputs                                                       |   |
|  |                                                             |   |
|  |  - Thread content + top 5 existing replies                  |   |
|  |  - Thread metadata (tone, topic, author info)               |   |
|  |  - Active product profile                                   |   |
|  |  - Learned reply patterns (style, length, etc.)             |   |
|  |  - Outcome data (what reply types perform best)             |   |
|  +-------------------------------------------------------------+   |
|                              |                                      |
|                              v                                      |
|  +-------------------------------------------------------------+   |
|  | Decision: Reply Type                                         |   |
|  |                                                             |   |
|  |  value-add    -> Thread is serious, early, or promo         |   |
|  |                  would feel forced                           |   |
|  |                                                             |   |
|  |  light-promo  -> Thread asks for tools/recs, or             |   |
|  |                  value-add naturally leads to mention        |   |
|  |                                                             |   |
|  |  direct       -> Someone explicitly needs what              |   |
|  |                  product does                                |   |
|  +-------------------------------------------------------------+   |
|                              |                                      |
|                              v                                      |
|  +-------------------------------------------------------------+   |
|  | Generate Reply via Grok                                      |   |
|  |                                                             |   |
|  |  Output:                                                    |   |
|  |  - reply_text: "The actual reply"                           |   |
|  |  - reply_type: "value-add" | "light-promo" | "direct"       |   |
|  |  - confidence: 0-100                                        |   |
|  |  - reasoning: "Why this approach"                           |   |
|  +-------------------------------------------------------------+   |
|                              |                                      |
|                              v                                      |
|  +-------------------------------------------------------------+   |
|  | User Review                                                  |   |
|  |                                                             |   |
|  |  [Edit]  [Regenerate]  [Skip]  [Post]                       |   |
|  +-------------------------------------------------------------+   |
+---------------------------------------------------------------------+
```

### Reply Type Guidelines

| Type | When to Use | Characteristics | Example |
|------|-------------|-----------------|---------|
| **value-add** | Thread is discussion/venting, early stage, no tool request | Share experience, give advice, no product mention | "Had this exact problem. What helped us was categorizing requests by 'config vs code' - surprising how many were just rearranging existing blocks." |
| **light-promo** | Thread asks for tools, or value-add naturally leads to it | Helpful context + natural product mention | "We automated this with [product] - it reads your API and lets users build their own views. Happy to share how we set it up." |
| **direct** | Explicit tool search matching product | Clear, direct recommendation | "This is literally what [product] does - lets users generate custom UI from prompts. [link]" |

### Generation Prompt

```javascript
async function generateReply(thread, options = {}) {
    const productProfile = await db.getActiveProductProfile();
    const learnedPatterns = await db.getLearnedPatterns('reply-style');
    const outcomeData = await db.getOutcomeInsights();
    const topReplies = await xApi.getThreadReplies(thread.conversation_id, 5);

    const prompt = `
You are helping craft a reply to a Twitter/X thread. The goal is to add genuine value to the conversation. Sometimes that means mentioning a product, but often it means just being helpful.

## Thread Context
Author: @${thread.x_author_username} (${thread.x_author_followers} followers)
Tone: ${thread.detected_tone}
Topic: ${thread.detected_topic}

Original tweet:
"${thread.content}"

Top existing replies:
${topReplies.map((r, i) => `${i + 1}. @${r.author}: "${r.text}"`).join('\n')}

## Product (mention only if genuinely relevant)
Name: ${productProfile.name}
What it does: ${productProfile.one_liner}
Problems it solves: ${productProfile.problems_solved.join(', ')}
When to mention: ${productProfile.when_to_mention}
When NOT to mention: ${productProfile.when_not_to_mention}

## Learned Style Preferences
${JSON.stringify(learnedPatterns, null, 2)}

## What Has Worked (outcome data)
${JSON.stringify(outcomeData, null, 2)}

## User's Request
${options.instruction || 'Generate a natural, valuable reply'}

## Guidelines
1. Match the thread's tone (${thread.detected_tone})
2. Prioritize adding value over promotion
3. If mentioning product, make it feel natural, not forced
4. Keep under 280 characters unless depth is needed
5. Don't be sycophantic or use excessive enthusiasm
6. If the thread is a rant/vent, empathize first

## Task
Generate a reply and classify it.

Respond in JSON:
{
    "reply_text": "<your reply>",
    "reply_type": "value-add" | "light-promo" | "direct",
    "confidence": <0-100>,
    "reasoning": "<why this approach for this thread>"
}
`;

    const response = await grok.chat({
        model: 'grok-3-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
}
```

### Regeneration Options

When user clicks "Regenerate", they can specify:

```javascript
const regenerateOptions = [
    { label: 'Make it funnier', instruction: 'Add wit or humor while staying relevant' },
    { label: 'More technical', instruction: 'Use more technical language, assume expertise' },
    { label: 'Shorter', instruction: 'Condense to under 140 characters' },
    { label: 'No product mention', instruction: 'Pure value-add, do not mention any product' },
    { label: 'Mention product', instruction: 'Find a natural way to mention the product' },
    { label: 'More casual', instruction: 'Make it more conversational and relaxed' },
    { label: 'Custom...', instruction: null }  // Opens text input
];
```

---

## Learning System

### Three Learning Layers

```
+---------------------------------------------------------------------+
|                    Learning System                                   |
|                                                                     |
|  Layer 1: Thread Selection                                          |
|  -------------------------------------------------------------------+
|  Tracks: Which threads you click vs skip                            |
|  Learns: Topic preferences, author follower ranges,                 |
|          timing preferences, tone preferences                       |
|                                                                     |
|  Layer 2: Reply Style                                               |
|  -------------------------------------------------------------------+
|  Tracks: Edits you make to suggested replies                        |
|  Learns: Preferred length, tone adjustments, common edits,          |
|          words you add/remove, CTA style                            |
|                                                                     |
|  Layer 3: Outcome Tracking                                          |
|  -------------------------------------------------------------------+
|  Tracks: Views, likes, replies on your posts                        |
|  Learns: What reply types perform best, optimal timing,             |
|          which thread characteristics yield engagement              |
+---------------------------------------------------------------------+
```

### Layer 1: Thread Selection Learning

```javascript
// When user views a thread
async function recordThreadView(threadId) {
    await db.run(`
        UPDATE threads
        SET status = 'viewed', viewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [threadId]);

    await recordSignal(threadId, 'positive', 'view');
}

// When user skips a thread
async function recordThreadSkip(threadId) {
    await db.run(`
        UPDATE threads
        SET status = 'skipped', skipped_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [threadId]);

    await recordSignal(threadId, 'negative', 'skip');
}

// Auto-skip threads not viewed within 24 hours
async function autoSkipStaleThreads() {
    const stale = await db.all(`
        SELECT id FROM threads
        WHERE status = 'new'
        AND first_seen_at < datetime('now', '-24 hours')
    `);

    for (const thread of stale) {
        await recordSignal(thread.id, 'negative', 'auto-skip');
        await db.run(`UPDATE threads SET status = 'skipped' WHERE id = ?`, [thread.id]);
    }
}

// Extract features for learning
async function extractThreadFeatures(threadId) {
    const thread = await db.getThread(threadId);

    return {
        // Author features
        follower_bucket: bucketFollowers(thread.x_author_followers),

        // Content features
        tone: thread.detected_tone,
        topic: thread.detected_topic,
        has_question: thread.content.includes('?'),
        content_length_bucket: bucketLength(thread.content.length),

        // Engagement features
        reply_count_bucket: bucketReplies(thread.reply_count),
        engagement_rate: thread.like_count / Math.max(thread.x_author_followers, 1),

        // Timing features
        hour_of_day: new Date(thread.x_created_at).getHours(),
        day_of_week: new Date(thread.x_created_at).getDay(),
        age_hours: (Date.now() - new Date(thread.x_created_at)) / 3600000,

        // Keywords
        keyword_matches: thread.keyword_matches
    };
}

function bucketFollowers(count) {
    if (count < 1000) return 'micro';
    if (count < 10000) return 'small';
    if (count < 50000) return 'medium';
    if (count < 200000) return 'large';
    return 'mega';
}
```

### Layer 2: Reply Style Learning

```javascript
// Track edits to suggested replies
async function recordReplyEdit(replyId, originalText, editedText) {
    const diff = computeEditDiff(originalText, editedText);

    await db.run(`
        UPDATE replies
        SET edited_text = ?, was_edited = 1, edit_diff = ?
        WHERE id = ?
    `, [editedText, JSON.stringify(diff), replyId]);

    // Update learned patterns
    await updateStylePatterns(diff);
}

function computeEditDiff(original, edited) {
    return {
        length_change: edited.length - original.length,
        length_change_pct: (edited.length - original.length) / original.length,

        // Word-level changes
        words_added: getAddedWords(original, edited),
        words_removed: getRemovedWords(original, edited),

        // Pattern detection
        added_emoji: hasNewEmoji(original, edited),
        removed_emoji: hasRemovedEmoji(original, edited),
        added_link: hasNewLink(original, edited),
        removed_link: hasRemovedLink(original, edited),
        added_product_mention: hasNewProductMention(original, edited),
        removed_product_mention: hasRemovedProductMention(original, edited),

        // Tone shift
        tone_shift: detectToneShift(original, edited)
    };
}

async function updateStylePatterns(diff) {
    // Track length preferences
    await updatePattern('reply-style', 'length_preference', {
        prefers_shorter: diff.length_change < -20,
        prefers_longer: diff.length_change > 20,
        change: diff.length_change
    });

    // Track emoji usage
    if (diff.removed_emoji) {
        await updatePattern('reply-style', 'emoji_preference', { removes_emoji: true });
    }

    // Track product mention preferences
    if (diff.removed_product_mention) {
        await updatePattern('reply-style', 'promotion_preference', { removes_mentions: true });
    } else if (diff.added_product_mention) {
        await updatePattern('reply-style', 'promotion_preference', { adds_mentions: true });
    }

    // Track common word additions
    for (const word of diff.words_added) {
        await updatePattern('reply-style', `added_word:${word}`, { count: 1 });
    }
}
```

### Layer 3: Outcome Tracking

```javascript
// Schedule outcome checks after posting
async function scheduleOutcomeChecks(replyId, postedAt) {
    const intervals = [1, 6, 24]; // hours

    for (const hours of intervals) {
        const checkTime = new Date(postedAt.getTime() + hours * 3600000);
        await scheduler.schedule(checkTime, 'fetchReplyMetrics', { replyId, interval: hours });
    }
}

// Fetch metrics for a posted reply
async function fetchReplyMetrics(replyId, interval) {
    const reply = await db.getReply(replyId);

    if (!reply.x_reply_id) return;

    const metrics = await xApi.getTweetMetrics(reply.x_reply_id);

    const field = `${interval}h`;
    await db.run(`
        UPDATE replies SET
            views_${field} = ?,
            likes_${field} = ?,
            replies_${field} = ?,
            last_metrics_fetch = CURRENT_TIMESTAMP,
            metrics_fetch_count = metrics_fetch_count + 1
        WHERE id = ?
    `, [metrics.views, metrics.likes, metrics.replies, replyId]);

    // Update outcome patterns
    await updateOutcomePatterns(reply, metrics, interval);
}

async function updateOutcomePatterns(reply, metrics, interval) {
    const thread = await db.getThread(reply.thread_id);

    const outcome = {
        reply_type: reply.reply_type,
        thread_tone: thread.detected_tone,
        thread_topic: thread.detected_topic,
        thread_size: thread.reply_count,
        author_followers: thread.x_author_followers,
        reply_length: reply.final_text.length,
        had_product_mention: reply.final_text.toLowerCase().includes(productName),
        reply_age_hours: interval,

        // Outcomes
        views: metrics.views,
        likes: metrics.likes,
        replies: metrics.replies,
        engagement_rate: (metrics.likes + metrics.replies) / Math.max(metrics.views, 1)
    };

    await updatePattern('outcome', `reply:${reply.id}:${interval}h`, outcome);
}

// Generate insights from outcome data
async function generateOutcomeInsights() {
    const outcomes = await db.getLearnedPatterns('outcome');

    // Group by reply_type
    const byType = groupBy(outcomes, 'reply_type');
    const typePerformance = Object.entries(byType).map(([type, items]) => ({
        type,
        avg_engagement: average(items.map(i => i.engagement_rate)),
        count: items.length
    }));

    // Group by thread characteristics
    const byTone = groupBy(outcomes, 'thread_tone');
    const tonePerformance = Object.entries(byTone).map(([tone, items]) => ({
        tone,
        avg_engagement: average(items.map(i => i.engagement_rate)),
        best_reply_type: mode(items.map(i => i.reply_type))
    }));

    return {
        byReplyType: typePerformance,
        byThreadTone: tonePerformance,
        insights: generateTextInsights(typePerformance, tonePerformance)
    };
}

function generateTextInsights(typePerf, tonePerf) {
    const insights = [];

    // Find best performing reply type
    const bestType = maxBy(typePerf, 'avg_engagement');
    if (bestType && typePerf.length > 1) {
        const ratio = bestType.avg_engagement / average(typePerf.map(t => t.avg_engagement));
        if (ratio > 1.3) {
            insights.push(`"${bestType.type}" replies outperform others by ${Math.round((ratio - 1) * 100)}%`);
        }
    }

    // Find best thread tones to engage with
    const bestTone = maxBy(tonePerf, 'avg_engagement');
    if (bestTone) {
        insights.push(`Best engagement on "${bestTone.tone}" threads with "${bestTone.best_reply_type}" replies`);
    }

    return insights;
}
```

---

## Dashboard UI

### Page Structure

```
dashboard/
|-- index.html              # Main SPA shell
|
|-- css/
|   +-- styles.css          # Tailwind + custom styles
|
+-- js/
    |-- app.js              # Router and state
    |-- api.js              # Server API client
    |-- utils.js            # Helpers (including escapeHtml)
    |
    +-- components/
        |-- thread-feed.js      # Thread list view
        |-- thread-card.js      # Individual thread (DOM-based, safe)
        |-- reply-composer.js   # Reply editing
        |-- analytics-view.js   # Stats dashboard
        +-- settings-view.js    # Configuration
```

### Main Layout (index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>grok-engage</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        'x-blue': '#1d9bf0',
                        'x-dark': '#15202b'
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-x-dark text-gray-100 min-h-screen">
    <div class="flex h-screen">
        <!-- Sidebar -->
        <nav class="w-64 bg-black border-r border-gray-800 p-4">
            <h1 class="text-xl font-bold mb-8">grok-engage</h1>

            <ul class="space-y-2">
                <li>
                    <a href="#/" data-nav="feed" class="nav-link flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-900">
                        <span>Feed</span>
                        <span id="new-count" class="ml-auto bg-x-blue text-white text-xs px-2 py-0.5 rounded-full">0</span>
                    </a>
                </li>
                <li>
                    <a href="#/analytics" data-nav="analytics" class="nav-link flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-900">
                        <span>Analytics</span>
                    </a>
                </li>
                <li>
                    <a href="#/settings" data-nav="settings" class="nav-link flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-900">
                        <span>Settings</span>
                    </a>
                </li>
            </ul>

            <!-- Status indicator -->
            <div class="absolute bottom-4 left-4 right-4">
                <div id="monitor-status" class="flex items-center gap-2 text-sm text-gray-500">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>Monitoring active</span>
                </div>
            </div>
        </nav>

        <!-- Main content -->
        <main id="app" class="flex-1 overflow-auto">
            <!-- Views rendered here via DOM methods -->
        </main>
    </div>

    <script type="module" src="/js/app.js"></script>
</body>
</html>
```

### Thread Card Component (Safe DOM Construction)

```javascript
// js/components/thread-card.js
import { escapeHtml, formatFollowers, formatTimeAgo, getToneColor } from '../utils.js';

export function createThreadCard(thread) {
    const card = document.createElement('div');
    card.className = 'thread-card bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors';
    card.dataset.threadId = thread.id;

    // Header section
    const header = document.createElement('div');
    header.className = 'flex items-start justify-between mb-3';

    // Author info
    const authorSection = document.createElement('div');
    authorSection.className = 'flex items-center gap-3';

    const avatar = document.createElement('div');
    avatar.className = 'w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg';
    avatar.textContent = (thread.x_author_name || '@').charAt(0);

    const authorDetails = document.createElement('div');

    const authorName = document.createElement('span');
    authorName.className = 'font-semibold';
    authorName.textContent = thread.x_author_name || 'Unknown';

    const authorUsername = document.createElement('span');
    authorUsername.className = 'text-gray-500 ml-2';
    authorUsername.textContent = '@' + (thread.x_author_username || 'unknown');

    const authorMeta = document.createElement('div');
    authorMeta.className = 'flex items-center gap-2 text-sm text-gray-500';
    authorMeta.textContent = `${formatFollowers(thread.x_author_followers)} followers · ${formatTimeAgo(thread.x_created_at)}`;

    const nameLine = document.createElement('div');
    nameLine.className = 'flex items-center gap-2';
    nameLine.appendChild(authorName);
    nameLine.appendChild(authorUsername);

    authorDetails.appendChild(nameLine);
    authorDetails.appendChild(authorMeta);

    authorSection.appendChild(avatar);
    authorSection.appendChild(authorDetails);

    // Tags
    const tags = document.createElement('div');
    tags.className = 'flex items-center gap-2';

    const toneBadge = document.createElement('span');
    toneBadge.className = `px-2 py-1 text-xs rounded bg-${getToneColor(thread.detected_tone)}-900 text-${getToneColor(thread.detected_tone)}-300`;
    toneBadge.textContent = thread.detected_tone;

    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'px-2 py-1 text-xs rounded bg-blue-900 text-blue-300';
    scoreBadge.textContent = `Score: ${thread.semantic_score}`;

    tags.appendChild(toneBadge);
    tags.appendChild(scoreBadge);

    header.appendChild(authorSection);
    header.appendChild(tags);

    // Content - using textContent for safety
    const content = document.createElement('p');
    content.className = 'text-gray-200 mb-4 whitespace-pre-wrap';
    content.textContent = thread.content;

    // Engagement stats
    const stats = document.createElement('div');
    stats.className = 'flex items-center gap-4 text-sm text-gray-500 mb-4';
    stats.textContent = `${thread.reply_count} replies · ${thread.like_count} likes · ${thread.retweet_count} retweets`;

    // Actions
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2';

    const composeBtn = document.createElement('button');
    composeBtn.className = 'btn-compose flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-x-blue hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors';
    composeBtn.textContent = 'Compose Reply';
    composeBtn.dataset.threadId = thread.id;

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-skip px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors';
    skipBtn.textContent = 'Skip';
    skipBtn.dataset.threadId = thread.id;

    const openLink = document.createElement('a');
    openLink.className = 'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition-colors';
    openLink.textContent = 'Open on X';
    openLink.href = thread.thread_url;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';

    actions.appendChild(composeBtn);
    actions.appendChild(skipBtn);
    actions.appendChild(openLink);

    // Composer placeholder
    const composer = document.createElement('div');
    composer.id = `composer-${thread.id}`;
    composer.className = 'reply-composer hidden border-t border-gray-800 pt-4 mt-4';

    // Assemble card
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(stats);
    card.appendChild(composer);
    card.appendChild(actions);

    return card;
}
```

### Reply Composer Component

```javascript
// js/components/reply-composer.js
import { api } from '../api.js';
import { showToast } from '../utils.js';

export async function loadReplyComposer(threadId) {
    const container = document.getElementById(`composer-${threadId}`);

    // Show loading state
    container.textContent = '';
    const loading = document.createElement('div');
    loading.className = 'text-center py-4 text-gray-500';
    loading.textContent = 'Generating reply...';
    container.appendChild(loading);
    container.classList.remove('hidden');

    try {
        const response = await api.generateReply(threadId);
        container.textContent = '';
        container.appendChild(createComposerUI(threadId, response));
        attachComposerListeners(threadId);
    } catch (error) {
        container.textContent = '';
        const errorMsg = document.createElement('div');
        errorMsg.className = 'text-red-400';
        errorMsg.textContent = `Error: ${error.message}`;
        container.appendChild(errorMsg);
    }
}

function createComposerUI(threadId, reply) {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-4';

    // Reply type indicator
    const typeRow = document.createElement('div');
    typeRow.className = 'flex items-center justify-between';

    const typeInfo = document.createElement('div');
    typeInfo.className = 'flex items-center gap-2';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'text-sm text-gray-400';
    typeLabel.textContent = 'Suggested:';

    const typeBadge = document.createElement('span');
    typeBadge.className = `px-2 py-0.5 text-xs rounded bg-green-900 text-green-300`;
    typeBadge.textContent = reply.reply_type;

    const confidence = document.createElement('span');
    confidence.className = 'text-xs text-gray-500';
    confidence.textContent = `(${reply.confidence}% confidence)`;

    typeInfo.appendChild(typeLabel);
    typeInfo.appendChild(typeBadge);
    typeInfo.appendChild(confidence);
    typeRow.appendChild(typeInfo);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.id = `reply-text-${threadId}`;
    textarea.className = 'w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-gray-200 resize-none focus:border-x-blue focus:outline-none';
    textarea.placeholder = 'Your reply...';
    textarea.value = reply.reply_text;

    // Character count row
    const countRow = document.createElement('div');
    countRow.className = 'flex items-center justify-between text-sm';

    const charCount = document.createElement('span');
    charCount.id = `char-count-${threadId}`;
    charCount.className = 'text-gray-500';
    charCount.textContent = `${reply.reply_text.length}/280`;

    // Regenerate controls
    const regenControls = document.createElement('div');
    regenControls.className = 'flex items-center gap-2';

    const regenSelect = document.createElement('select');
    regenSelect.id = `regen-option-${threadId}`;
    regenSelect.className = 'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm';

    const options = [
        { value: '', label: 'Regenerate as...' },
        { value: 'funnier', label: 'Funnier' },
        { value: 'shorter', label: 'Shorter' },
        { value: 'technical', label: 'More technical' },
        { value: 'casual', label: 'More casual' },
        { value: 'no-promo', label: 'No product mention' },
        { value: 'with-promo', label: 'With product mention' }
    ];

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        regenSelect.appendChild(option);
    });

    const regenBtn = document.createElement('button');
    regenBtn.className = 'btn-regen px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm';
    regenBtn.textContent = 'Regenerate';
    regenBtn.dataset.threadId = threadId;

    regenControls.appendChild(regenSelect);
    regenControls.appendChild(regenBtn);

    countRow.appendChild(charCount);
    countRow.appendChild(regenControls);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2 pt-2';

    const postBtn = document.createElement('button');
    postBtn.className = 'btn-post flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors';
    postBtn.textContent = 'Post Reply';
    postBtn.dataset.threadId = threadId;

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.dataset.threadId = threadId;

    actions.appendChild(postBtn);
    actions.appendChild(cancelBtn);

    // Assemble
    wrapper.appendChild(typeRow);
    wrapper.appendChild(textarea);
    wrapper.appendChild(countRow);
    wrapper.appendChild(actions);

    return wrapper;
}

function attachComposerListeners(threadId) {
    const textarea = document.getElementById(`reply-text-${threadId}`);
    const charCount = document.getElementById(`char-count-${threadId}`);

    // Character count
    textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        charCount.textContent = `${count}/280`;
        charCount.className = count > 280 ? 'text-red-400' : 'text-gray-500';
    });

    // Post button
    document.querySelector(`.btn-post[data-thread-id="${threadId}"]`).addEventListener('click', async () => {
        const text = textarea.value.trim();
        if (!text || text.length > 280) return;

        try {
            await api.postReply(threadId, text);
            showToast('Reply posted successfully!');
            await refreshThreadCard(threadId);
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });

    // Regenerate button
    document.querySelector(`.btn-regen[data-thread-id="${threadId}"]`).addEventListener('click', async () => {
        const option = document.getElementById(`regen-option-${threadId}`).value;
        if (!option) return;
        await loadReplyComposer(threadId, { instruction: getRegenInstruction(option) });
    });

    // Cancel button
    document.querySelector(`.btn-cancel[data-thread-id="${threadId}"]`).addEventListener('click', () => {
        document.getElementById(`composer-${threadId}`).classList.add('hidden');
    });
}

function getRegenInstruction(option) {
    const instructions = {
        'funnier': 'Add wit or humor while staying relevant',
        'shorter': 'Condense to under 140 characters',
        'technical': 'Use more technical language, assume expertise',
        'casual': 'Make it more conversational and relaxed',
        'no-promo': 'Pure value-add, do not mention any product',
        'with-promo': 'Find a natural way to mention the product'
    };
    return instructions[option] || '';
}
```

---

## Server Implementation

### Entry Point (index.js)

```javascript
// server/index.js

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDatabase } from './db/db.js';
import { startScheduler } from './services/scheduler.js';
import { getSettings } from './db/db.js';
import threadsRouter from './routes/threads.js';
import repliesRouter from './routes/replies.js';
import analyticsRouter from './routes/analytics.js';
import settingsRouter from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self'"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dashboard')));

// API routes
app.use('/api/threads', threadsRouter);
app.use('/api/replies', repliesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Initialize and start
async function start() {
    await initDatabase();

    const settings = await getSettings();
    if (settings['monitoring.enabled']) {
        startScheduler();
    }

    app.listen(PORT, () => {
        console.log(`grok-engage running at http://localhost:${PORT}`);

        // Open in browser on first run
        if (process.env.OPEN_BROWSER !== 'false') {
            import('open').then(open => open.default(`http://localhost:${PORT}`));
        }
    });
}

start().catch(console.error);
```

### X API Client

```javascript
// server/services/x-api.js

import { TwitterApi } from 'twitter-api-v2';
import { getCredentials } from '../db/db.js';

let client = null;

export async function getClient() {
    if (client) return client;

    const creds = await getCredentials();

    client = new TwitterApi({
        appKey: creds.x_api_key,
        appSecret: creds.x_api_secret,
        accessToken: creds.x_access_token,
        accessSecret: creds.x_access_secret,
    });

    return client;
}

export async function searchTweets(query, options = {}) {
    const api = await getClient();

    const result = await api.v2.search(query, {
        max_results: options.maxResults || 100,
        'tweet.fields': ['public_metrics', 'created_at', 'conversation_id', 'author_id'],
        'user.fields': ['public_metrics', 'username', 'name'],
        expansions: ['author_id'],
        ...options
    });

    // Map users to tweets
    const users = new Map(result.includes?.users?.map(u => [u.id, u]) || []);

    return result.data?.map(tweet => ({
        ...tweet,
        author: users.get(tweet.author_id)
    })) || [];
}

export async function postReply(tweetId, text) {
    const api = await getClient();

    const result = await api.v2.reply(text, tweetId);
    return result.data;
}

export async function getTweetMetrics(tweetId) {
    const api = await getClient();

    const tweet = await api.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics']
    });

    return {
        views: tweet.data.public_metrics.impression_count || 0,
        likes: tweet.data.public_metrics.like_count || 0,
        replies: tweet.data.public_metrics.reply_count || 0,
        retweets: tweet.data.public_metrics.retweet_count || 0
    };
}

export async function getThreadReplies(conversationId, limit = 5) {
    const api = await getClient();

    const result = await api.v2.search(`conversation_id:${conversationId}`, {
        max_results: Math.min(limit, 100),
        'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
        'user.fields': ['username'],
        expansions: ['author_id'],
        sort_order: 'relevancy'
    });

    const users = new Map(result.includes?.users?.map(u => [u.id, u]) || []);

    return result.data?.map(tweet => ({
        text: tweet.text,
        author: users.get(tweet.author_id)?.username || 'unknown',
        likes: tweet.public_metrics.like_count
    })) || [];
}
```

### Grok Client

```javascript
// server/services/llm.js

import OpenAI from 'openai';
import { getCredentials } from '../db/db.js';

let client = null;

export async function getGrokClient() {
    if (client) return client;

    const creds = await getCredentials();

    client = new OpenAI({
        apiKey: creds.xai_api_key,
        baseURL: 'https://api.x.ai/v1'
    });

    return client;
}

export async function chat(messages, options = {}) {
    const grok = await getGrokClient();

    const response = await grok.chat.completions.create({
        model: options.model || 'grok-3-latest',
        messages,
        response_format: options.json ? { type: 'json_object' } : undefined,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000
    });

    return response.choices[0].message.content;
}

export async function chatJson(messages, options = {}) {
    const content = await chat(messages, { ...options, json: true });
    return JSON.parse(content);
}
```

### Scheduler

```javascript
// server/services/scheduler.js

import cron from 'node-cron';
import { discoverThreads } from './discovery.js';
import { fetchPendingMetrics } from './metrics.js';
import { getSettings } from '../db/db.js';

let monitoringJob = null;
let metricsJob = null;

export async function startScheduler() {
    const settings = await getSettings();
    const interval = settings['monitoring.interval_minutes'] || 5;

    // Thread discovery - runs every N minutes
    monitoringJob = cron.schedule(`*/${interval} * * * *`, async () => {
        console.log(`[${new Date().toISOString()}] Running thread discovery...`);
        try {
            const found = await discoverThreads();
            console.log(`[${new Date().toISOString()}] Found ${found} new threads`);
        } catch (error) {
            console.error('Discovery error:', error);
        }
    });

    // Metrics fetching - runs every hour
    metricsJob = cron.schedule('0 * * * *', async () => {
        console.log(`[${new Date().toISOString()}] Fetching reply metrics...`);
        try {
            await fetchPendingMetrics();
        } catch (error) {
            console.error('Metrics error:', error);
        }
    });

    console.log(`Scheduler started: discovery every ${interval}m, metrics every 1h`);
}

export function stopScheduler() {
    if (monitoringJob) {
        monitoringJob.stop();
        monitoringJob = null;
    }
    if (metricsJob) {
        metricsJob.stop();
        metricsJob = null;
    }
    console.log('Scheduler stopped');
}

export async function restartScheduler() {
    stopScheduler();
    await startScheduler();
}
```

---

## Credentials Management

### Storage Strategy

```
Priority order:
1. Environment variables (.env file)
2. Database (encrypted, set via dashboard)
```

### Encryption

```javascript
// server/services/crypto.js

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Master key derived from user-set password on first run
let masterKey = null;

export function setMasterKey(password) {
    masterKey = crypto.scryptSync(password, 'grok-engage', 32);
}

export function encrypt(text) {
    if (!masterKey) throw new Error('Master key not set');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText) {
    if (!masterKey) throw new Error('Master key not set');

    const [ivHex, tagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
```

---

## Product Profile Generation

### Claude Code Prompt Template

Save this prompt and use it with any product URL:

```
Visit [URL] and analyze the product thoroughly. Read the landing page, any documentation, and understand what problem it solves and for whom.

Return a JSON object that can be used to configure a social media monitoring tool:

{
    "productName": "The product name",

    "oneLiner": "A single sentence (max 15 words) describing what it does in plain language",

    "problemsSolved": [
        "Specific problem 1 from the user's perspective (not marketing speak)",
        "Specific problem 2...",
        "Specific problem 3..."
    ],

    "targetAudience": [
        "Specific persona 1 (e.g., 'SaaS founders with 10-50 employees')",
        "Specific persona 2 (e.g., 'Product managers at B2B companies')"
    ],

    "relevantKeywords": [
        "Keywords/phrases that would appear in social media threads where this product would be relevant",
        "Include pain-point keywords",
        "Include tool-discovery keywords",
        "Include industry-specific terms"
    ],

    "toneKeywords": ["casual", "technical", "founder-friendly"],

    "whenToMention": "Describe specific scenarios where mentioning this product adds genuine value. Be concrete.",

    "whenNotToMention": "Describe scenarios where mentioning it would feel spammy, off-topic, or forced. Be concrete."
}

Guidelines:
- Be specific and concrete, not generic marketing language
- Focus on real pain points, not aspirational benefits
- The keywords should be things real people actually say, not SEO terms
- "whenToMention" and "whenNotToMention" should help an AI decide appropriately
```

---

## File Structure

```
grok-engage/
|-- server/
|   |-- index.js                    # Express server entry point
|   |-- config.js                   # Environment and defaults
|   |
|   |-- db/
|   |   |-- schema.sql              # SQLite schema
|   |   |-- db.js                   # Database connection and queries
|   |   +-- migrations/             # Schema migrations
|   |
|   |-- services/
|   |   |-- x-api.js                # X/Twitter API client
|   |   |-- llm.js                  # Grok API client
|   |   |-- scheduler.js            # Cron job management
|   |   |-- discovery.js            # Thread discovery logic
|   |   |-- relevance.js            # Semantic scoring
|   |   |-- reply-generator.js      # Reply generation
|   |   |-- learning.js             # Learning engine
|   |   |-- metrics.js              # Outcome tracking
|   |   +-- crypto.js               # Encryption utilities
|   |
|   +-- routes/
|       |-- threads.js              # Thread CRUD + actions
|       |-- replies.js              # Reply generation + posting
|       |-- analytics.js            # Stats and insights
|       |-- settings.js             # Configuration
|       +-- setup.js                # First-run wizard
|
|-- dashboard/
|   |-- index.html                  # Main SPA shell
|   |
|   |-- css/
|   |   +-- styles.css              # Tailwind + custom styles
|   |
|   +-- js/
|       |-- app.js                  # Router and state
|       |-- api.js                  # Server API client
|       |-- utils.js                # Helpers (escapeHtml, etc.)
|       |
|       +-- components/
|           |-- thread-feed.js      # Thread list view
|           |-- thread-card.js      # Individual thread (DOM-safe)
|           |-- reply-composer.js   # Reply editing
|           |-- analytics-view.js   # Stats dashboard
|           |-- settings-view.js    # Configuration
|           +-- setup-wizard.js     # First-run flow
|
|-- data/                           # Created at runtime
|   +-- monitor.db                  # SQLite database
|
|-- .env.example                    # Environment template
|-- .gitignore
|-- package.json
|-- README.md
+-- LICENSE
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- X API Basic tier access ($100/month) - [developer.x.com](https://developer.x.com)
- xAI API key - [x.ai](https://x.ai)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/grok-engage.git
cd grok-engage

# Install dependencies
npm install

# Copy environment template (optional - can configure via UI)
cp .env.example .env

# Start the application
npm start
```

### First Run

1. Open http://localhost:3001
2. Complete the setup wizard:
   - Set a master password (encrypts your API keys)
   - Enter X API credentials
   - Enter xAI API key
   - Create your first product profile
   - Add initial keywords
3. The monitor starts automatically

### Environment Variables (Optional)

```bash
# .env

# Server
PORT=3001
OPEN_BROWSER=true

# X API (alternative to UI setup)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# xAI (alternative to UI setup)
XAI_API_KEY=

# Override master password (not recommended)
MASTER_KEY=
```

---

## API Reference

### Threads

```
GET    /api/threads              List threads (with filters)
GET    /api/threads/:id          Get single thread
POST   /api/threads/:id/view     Mark as viewed
POST   /api/threads/:id/skip     Mark as skipped
DELETE /api/threads/:id          Remove thread
```

### Replies

```
POST   /api/replies/generate     Generate reply for thread
POST   /api/replies/regenerate   Regenerate with instruction
POST   /api/replies/post         Post reply to X
GET    /api/replies              List posted replies
GET    /api/replies/:id          Get reply with metrics
```

### Analytics

```
GET    /api/analytics/summary    Dashboard summary stats
GET    /api/analytics/insights   Learning insights
GET    /api/analytics/outcomes   Reply performance data
```

### Settings

```
GET    /api/settings             Get all settings
PUT    /api/settings             Update settings
GET    /api/settings/keywords    List keywords
POST   /api/settings/keywords    Add keyword
DELETE /api/settings/keywords/:id Remove keyword
GET    /api/settings/profiles    List product profiles
POST   /api/settings/profiles    Create profile
PUT    /api/settings/profiles/:id Update profile
DELETE /api/settings/profiles/:id Delete profile
```

---

## Future Enhancements

### Potential additions (not in initial scope):

1. **Multi-platform support** - Add Threads, Reddit, LinkedIn
2. **Team features** - Multiple users, shared profiles
3. **Scheduled posting** - Queue replies for optimal timing
4. **A/B testing** - Test different reply styles
5. **Competitor monitoring** - Track mentions of competitors
6. **Export/reporting** - Generate engagement reports
7. **Browser extension** - Quick-reply overlay on X

---

## License

MIT License - see LICENSE file
