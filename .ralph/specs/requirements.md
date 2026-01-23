# Technical Specifications

## X Thread Monitor - Detailed Requirements

---

## 1. System Architecture

### 1.1 Overview
A self-hosted Node.js application with:
- Express.js REST API server
- SQLite database for persistence
- Plain HTML/JS/Tailwind dashboard (no build step)
- External integrations: X API v2, xAI/Grok API

### 1.2 Component Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                        Local Machine                             │
│                                                                  │
│  ┌──────────────────┐         ┌─────────────────────────────┐   │
│  │  Node.js Server  │◄────────►│    Web Dashboard           │   │
│  │    (Express)     │  REST    │    (localhost:3001)        │   │
│  │                  │  API     │                            │   │
│  │ ┌──────────────┐ │         │  • Thread Feed             │   │
│  │ │  Scheduler   │ │         │  • Reply Composer          │   │
│  │ │ (node-cron)  │ │         │  • Analytics View          │   │
│  │ └──────────────┘ │         │  • Settings                │   │
│  │                  │         └─────────────────────────────┘   │
│  │ ┌──────────────┐ │                                          │
│  │ │ SQLite DB    │ │                                          │
│  │ │(better-sql3) │ │                                          │
│  │ └──────────────┘ │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
    ┌─────────────┐                ┌─────────────┐
    │   X API v2  │                │  xAI API    │
    │             │                │   (Grok)    │
    │ • Search    │                │ • Relevance │
    │ • Post      │                │ • Replies   │
    │ • Metrics   │                │ • Learning  │
    └─────────────┘                └─────────────┘
```

---

## 2. Data Model

### 2.1 Database Tables

#### product_profiles
Stores product configurations for relevance matching and reply generation.
```sql
CREATE TABLE product_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    one_liner TEXT,                    -- Max 15 words
    problems_solved TEXT,              -- JSON array
    target_audience TEXT,              -- JSON array
    relevant_keywords TEXT,            -- JSON array
    tone_keywords TEXT,                -- JSON array
    when_to_mention TEXT,              -- Guidance for AI
    when_not_to_mention TEXT,          -- Guidance for AI
    url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### keywords
Keywords/phrases to monitor on X.
```sql
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,                     -- 'pain-point', 'tool-discovery', 'building-in-public', 'custom'
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### threads
Discovered tweets that meet engagement threshold.
```sql
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

    -- Relevance scoring (from Grok)
    keyword_matches TEXT,              -- JSON array
    semantic_score INTEGER,            -- 0-100
    relevance_reasoning TEXT,
    detected_tone TEXT,                -- 'casual', 'serious', 'technical', 'rant', 'question'
    detected_topic TEXT,

    -- Status tracking
    status TEXT DEFAULT 'new',         -- 'new', 'viewed', 'replied', 'skipped'
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

CREATE INDEX idx_threads_status ON threads(status);
CREATE INDEX idx_threads_first_seen ON threads(first_seen_at);
CREATE INDEX idx_threads_semantic_score ON threads(semantic_score);
```

#### replies
Generated and posted replies.
```sql
CREATE TABLE replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id),
    product_profile_id INTEGER REFERENCES product_profiles(id),

    -- Generation
    suggested_text TEXT NOT NULL,
    edited_text TEXT,                  -- NULL if posted without edits
    final_text TEXT NOT NULL,
    reply_type TEXT,                   -- 'value-add', 'light-promo', 'direct'
    generation_reasoning TEXT,

    -- Edits tracking (for learning)
    was_edited INTEGER DEFAULT 0,
    edit_diff TEXT,                    -- JSON

    -- Posting
    x_reply_id TEXT,                   -- NULL if not posted
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

    last_metrics_fetch DATETIME,
    metrics_fetch_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_replies_thread ON replies(thread_id);
CREATE INDEX idx_replies_posted ON replies(posted_at);
```

#### feedback
Explicit user feedback on threads and replies.
```sql
CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER REFERENCES threads(id),
    reply_id INTEGER REFERENCES replies(id),
    feedback_type TEXT NOT NULL,       -- 'good-thread', 'bad-thread', 'good-reply', 'bad-reply'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_thread ON feedback(thread_id);
```

#### learned_patterns
Computed patterns from the learning engine.
```sql
CREATE TABLE learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,        -- 'thread-preference', 'reply-style', 'timing', 'outcome'
    pattern_key TEXT NOT NULL,
    pattern_value TEXT NOT NULL,       -- JSON
    confidence REAL,                   -- 0.0 - 1.0
    sample_count INTEGER,
    last_computed DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(pattern_type, pattern_key)
);
```

#### settings
Application configuration.
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### credentials
Encrypted API credentials.
```sql
CREATE TABLE credentials (
    key TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Default Settings
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
    'tracking.check_intervals': [1, 6, 24],     // hours
    'tracking.max_checks': 3,

    // UI
    'ui.threads_per_page': 20,
    'ui.auto_refresh': true,
    'ui.refresh_interval_seconds': 60
};
```

---

## 3. API Specifications

### 3.1 REST Endpoints

#### Threads
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/threads | List threads (supports ?status=, ?limit=, ?offset=) |
| GET | /api/threads/:id | Get single thread with full details |
| POST | /api/threads/:id/view | Mark as viewed, record learning signal |
| POST | /api/threads/:id/skip | Mark as skipped, record learning signal |
| DELETE | /api/threads/:id | Remove thread |

#### Replies
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/replies/generate | Generate reply for thread (body: {thread_id}) |
| POST | /api/replies/regenerate | Regenerate with instruction (body: {thread_id, instruction}) |
| POST | /api/replies/post | Post reply to X (body: {thread_id, text}) |
| GET | /api/replies | List posted replies |
| GET | /api/replies/:id | Get reply with metrics |

#### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/analytics/summary | Dashboard summary stats |
| GET | /api/analytics/insights | Learning insights |
| GET | /api/analytics/outcomes | Reply performance data |

#### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/settings | Get all settings |
| PUT | /api/settings | Update settings (body: {key: value, ...}) |
| GET | /api/settings/keywords | List keywords |
| POST | /api/settings/keywords | Add keyword (body: {keyword, category}) |
| DELETE | /api/settings/keywords/:id | Remove keyword |
| GET | /api/settings/profiles | List product profiles |
| POST | /api/settings/profiles | Create profile |
| PUT | /api/settings/profiles/:id | Update profile |
| DELETE | /api/settings/profiles/:id | Delete profile |

### 3.2 Response Formats

**Thread List Response:**
```json
{
    "threads": [
        {
            "id": 1,
            "x_tweet_id": "1234567890",
            "x_author_username": "example",
            "x_author_name": "Example User",
            "x_author_followers": 5000,
            "content": "Tweet content...",
            "reply_count": 25,
            "like_count": 100,
            "semantic_score": 85,
            "detected_tone": "question",
            "detected_topic": "tool-search",
            "status": "new",
            "first_seen_at": "2024-01-01T12:00:00Z"
        }
    ],
    "total": 50,
    "limit": 20,
    "offset": 0
}
```

**Generated Reply Response:**
```json
{
    "reply_text": "Suggested reply text...",
    "reply_type": "value-add",
    "confidence": 85,
    "reasoning": "This thread is discussing pain points that align with..."
}
```

---

## 4. External API Integration

### 4.1 X API v2 (twitter-api-v2)

**Authentication:**
- OAuth 1.0a User Context (for posting)
- Required credentials: API Key, API Secret, Access Token, Access Secret

**Key Operations:**

```javascript
// Search tweets
api.v2.search(query, {
    max_results: 100,
    'tweet.fields': ['public_metrics', 'created_at', 'conversation_id', 'author_id'],
    'user.fields': ['public_metrics', 'username', 'name'],
    expansions: ['author_id']
});

// Post reply
api.v2.reply(text, tweetId);

// Get tweet metrics
api.v2.singleTweet(tweetId, {
    'tweet.fields': ['public_metrics']
});

// Get thread replies
api.v2.search(`conversation_id:${conversationId}`, {
    max_results: 5,
    sort_order: 'relevancy'
});
```

**Rate Limits (Basic Tier - $100/month):**
- Read: 10,000 tweets/month (~333/day)
- Write: 500 posts/month (~16/day)

### 4.2 xAI API (Grok)

**Authentication:**
- API Key via OpenAI-compatible client
- Base URL: https://api.x.ai/v1

**Configuration:**
```javascript
const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1'
});
```

**Model:** grok-3-latest

**Key Operations:**

```javascript
// Relevance scoring
const response = await client.chat.completions.create({
    model: 'grok-3-latest',
    messages: [{ role: 'user', content: relevancePrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7
});

// Reply generation
const response = await client.chat.completions.create({
    model: 'grok-3-latest',
    messages: [{ role: 'user', content: replyPrompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7
});
```

---

## 5. Thread Discovery System

### 5.1 Discovery Loop
```
Every N minutes (default 5):
1. Get active keywords from database
2. For each keyword:
   a. Search X API for recent tweets (exclude retweets/replies)
   b. Filter by engagement threshold (default 15+ replies)
   c. Skip if already in database
   d. Score semantic relevance with Grok
   e. If score >= threshold (default 70), store thread
3. Auto-skip stale threads (>24 hours, not viewed)
```

### 5.2 Semantic Scoring Prompt
```
Score relevance 0-100 based on:
- Does it discuss problems the products solve?
- Is the author in target audience?
- Would a reply add value?
- Based on learned preferences, would user engage?

Also detect:
- Tone: casual, serious, technical, rant, question
- Topic: tool-search, venting, feature-requests, etc.

Return JSON: { score, tone, topic, reasoning }
```

---

## 6. Reply Generation System

### 6.1 Reply Types

| Type | When to Use | Characteristics |
|------|-------------|-----------------|
| **value-add** | Thread is discussion/venting, early stage, no tool request | Share experience, give advice, no product mention |
| **light-promo** | Thread asks for tools, or value-add naturally leads to it | Helpful context + natural product mention |
| **direct** | Explicit tool search matching product | Clear, direct recommendation |

### 6.2 Generation Prompt
```
Context: Thread content, tone, topic, top 5 existing replies
Product: Name, one-liner, problems solved, when to mention
Learned: Style preferences, what has worked

Guidelines:
1. Match thread's tone
2. Prioritize value over promotion
3. Natural product mentions only
4. Under 280 characters
5. No sycophancy
6. Empathize first if venting

Return JSON: { reply_text, reply_type, confidence, reasoning }
```

### 6.3 Regeneration Options
- Funnier: Add wit or humor
- Shorter: Under 140 characters
- Technical: Assume expertise
- Casual: More conversational
- No-promo: Pure value-add
- With-promo: Natural product mention

---

## 7. Learning System

### 7.1 Three Layers

**Layer 1: Thread Selection**
- Tracks: Views vs skips
- Learns: Topic preferences, follower ranges, timing, tone preferences
- Features extracted: follower_bucket, tone, topic, has_question, content_length, reply_count, engagement_rate, hour_of_day, day_of_week

**Layer 2: Reply Style**
- Tracks: Edits to suggested replies
- Learns: Preferred length, tone adjustments, common edits, words added/removed, emoji usage, product mention preferences
- Diff computed: length_change, words_added, words_removed, added_emoji, removed_emoji, added_link, removed_link, added/removed_product_mention, tone_shift

**Layer 3: Outcome Tracking**
- Tracks: Views, likes, replies at 1h/6h/24h
- Learns: Best performing reply types, optimal timing, thread characteristics that yield engagement
- Outcome data: reply_type, thread_tone, thread_topic, thread_size, author_followers, reply_length, had_product_mention, engagement_rate

---

## 8. Security Requirements

### 8.1 XSS Prevention
- Use textContent instead of innerHTML for all user content
- Build DOM with createElement, not template strings
- escapeHtml helper for any edge cases

```javascript
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

### 8.2 Content Security Policy
```javascript
res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' https://cdn.tailwindcss.com 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'"
);
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
```

### 8.3 Input Validation
- Validate all API inputs server-side
- Use parameterized queries for SQLite
- Type check and range validate numeric inputs

### 8.4 Credential Encryption
- AES-256-GCM for at-rest encryption
- Master key derived from user password via scrypt
- Store IV and auth tag with encrypted value

---

## 9. Dashboard UI Specifications

### 9.1 Pages

**Feed (default)**
- List of threads sorted by first_seen_at desc
- Each card shows: author, content, engagement stats, relevance score, tone badge
- Actions: Compose Reply, Skip, Open on X

**Reply Composer (inline)**
- AI-generated suggestion with confidence
- Editable textarea with character count
- Regenerate dropdown with options
- Post button

**Analytics**
- Summary stats: threads discovered, replied, skipped
- Learning insights: best reply types, best thread tones
- Outcome charts: engagement over time

**Settings**
- Keywords management
- Product profiles CRUD
- API credentials (encrypted)
- Monitoring configuration

### 9.2 UI Components (DOM-based)

All components construct DOM via createElement for XSS safety:
- thread-card.js: Individual thread display
- thread-feed.js: List container with pagination
- reply-composer.js: Reply generation and editing
- analytics-view.js: Stats and charts
- settings-view.js: Configuration forms

---

## 10. Performance Considerations

### 10.1 X API Budget Management
- Track monthly usage in database
- Calculate daily budget: remaining / days_until_reset
- Warn when approaching limits
- Prioritize high-value operations

### 10.2 Database Optimization
- Indexes on frequently queried columns
- Pagination for large result sets
- Batch updates where possible

### 10.3 Scheduler Efficiency
- Run discovery at configurable intervals
- Process keywords sequentially to manage API load
- Batch metric fetches
