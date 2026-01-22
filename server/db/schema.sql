-- grok-engage Database Schema
-- SQLite database for storing threads, replies, and learning data

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Product profiles (generic, supports multiple products)
CREATE TABLE IF NOT EXISTS product_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    one_liner TEXT,
    problems_solved TEXT,          -- JSON array
    target_audience TEXT,          -- JSON array
    relevant_keywords TEXT,        -- JSON array
    tone_keywords TEXT,            -- JSON array
    when_to_mention TEXT,
    when_not_to_mention TEXT,
    url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keywords for monitoring
CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,                 -- 'pain-point', 'tool-discovery', 'building-in-public', 'custom', 'auto-generated', 'auto-discovered'
    is_active INTEGER DEFAULT 1,
    source_profile_id INTEGER REFERENCES product_profiles(id) ON DELETE SET NULL,
    performance_score INTEGER DEFAULT 50,  -- 0-100, starts neutral
    threads_matched INTEGER DEFAULT 0,
    threads_engaged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keyword changes log (for notifications)
CREATE TABLE IF NOT EXISTS keyword_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
    keyword_text TEXT NOT NULL,    -- Store text in case keyword is deleted
    action TEXT NOT NULL,          -- 'added', 'disabled', 're-enabled'
    reason TEXT,                   -- 'auto-generated', 'low-engagement', 'discovered-from-threads'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Discovered threads
CREATE TABLE IF NOT EXISTS threads (
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
    keyword_matches TEXT,          -- JSON array of matched keywords
    semantic_score INTEGER,        -- 0-100 from Grok
    relevance_reasoning TEXT,      -- Grok's explanation
    detected_tone TEXT,            -- 'casual', 'serious', 'technical', 'rant', 'question'
    detected_topic TEXT,           -- 'feature-requests', 'tool-search', 'venting', etc.

    -- Status tracking
    status TEXT DEFAULT 'new',     -- 'new', 'viewed', 'replied', 'skipped'
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
CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    product_profile_id INTEGER REFERENCES product_profiles(id) ON DELETE SET NULL,

    -- Generation
    suggested_text TEXT NOT NULL,
    edited_text TEXT,              -- NULL if posted without edits
    final_text TEXT NOT NULL,      -- What was actually posted
    reply_type TEXT,               -- 'value-add', 'light-promo', 'direct'
    generation_reasoning TEXT,     -- Grok's explanation for the suggestion

    -- Edits tracking (for learning)
    was_edited INTEGER DEFAULT 0,
    edit_diff TEXT,                -- JSON describing what changed

    -- Posting
    x_reply_id TEXT,               -- ID of posted tweet, NULL if not posted
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
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER REFERENCES threads(id) ON DELETE CASCADE,
    reply_id INTEGER REFERENCES replies(id) ON DELETE CASCADE,
    feedback_type TEXT NOT NULL,   -- 'good-thread', 'bad-thread', 'good-reply', 'bad-reply'
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learned patterns (computed by learning engine)
CREATE TABLE IF NOT EXISTS learned_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_type TEXT NOT NULL,    -- 'thread-preference', 'reply-style', 'timing', 'outcome'
    pattern_key TEXT NOT NULL,
    pattern_value TEXT NOT NULL,   -- JSON
    confidence REAL,               -- 0.0 - 1.0
    sample_count INTEGER,
    last_computed DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(pattern_type, pattern_key)
);

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Credentials (encrypted)
CREATE TABLE IF NOT EXISTS credentials (
    key TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking (for rate limiting)
CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_name TEXT NOT NULL,        -- 'x_read', 'x_write', 'grok'
    operation TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Keyword experiment log (tracks experimental keywords lifecycle)
CREATE TABLE IF NOT EXISTS keyword_experiment_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL,
    strategy TEXT NOT NULL,            -- 'semantic', 'pattern', 'trend'
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    outcome TEXT DEFAULT 'active',     -- 'active', 'succeeded', 'failed', 'removed'
    final_score INTEGER,
    threads_matched INTEGER DEFAULT 0
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_first_seen ON threads(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_threads_semantic_score ON threads(semantic_score);
CREATE INDEX IF NOT EXISTS idx_threads_x_tweet_id ON threads(x_tweet_id);
CREATE INDEX IF NOT EXISTS idx_replies_thread ON replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_replies_posted ON replies(posted_at);
CREATE INDEX IF NOT EXISTS idx_feedback_thread ON feedback(thread_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_date ON api_usage(api_name, recorded_at);
CREATE INDEX IF NOT EXISTS idx_keyword_changes_created ON keyword_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_keywords_performance ON keywords(performance_score);
CREATE INDEX IF NOT EXISTS idx_keyword_experiment_log_keyword ON keyword_experiment_log(keyword);
CREATE INDEX IF NOT EXISTS idx_keyword_experiment_log_outcome ON keyword_experiment_log(outcome);
