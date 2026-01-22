import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config, { DEFAULT_SETTINGS } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

/**
 * Initialize the database connection and schema
 */
export async function initDatabase() {
    // Ensure data directory exists
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create database connection
    db = new Database(config.dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    // Initialize default settings
    initializeDefaultSettings();

    return db;
}

/**
 * Get the database instance
 */
export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

/**
 * Initialize default settings if they don't exist
 */
function initializeDefaultSettings() {
    const insertSetting = db.prepare(`
        INSERT OR IGNORE INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    const insertMany = db.transaction((settings) => {
        for (const [key, value] of Object.entries(settings)) {
            const stringValue = typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
            insertSetting.run(key, stringValue);
        }
    });

    insertMany(DEFAULT_SETTINGS);
}

// ============================================
// Settings Operations
// ============================================

export function getSetting(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return DEFAULT_SETTINGS[key];

    // Try to parse as JSON, fall back to string
    try {
        return JSON.parse(row.value);
    } catch {
        return row.value;
    }
}

export function getSettings() {
    const rows = getDb().prepare('SELECT key, value FROM settings').all();
    const settings = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
        try {
            settings[row.key] = JSON.parse(row.value);
        } catch {
            settings[row.key] = row.value;
        }
    }

    return settings;
}

export function setSetting(key, value) {
    const stringValue = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    getDb().prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, stringValue);
}

// ============================================
// Keywords Operations
// ============================================

export function getKeywords(activeOnly = true) {
    const sql = activeOnly
        ? 'SELECT * FROM keywords WHERE is_active = 1 ORDER BY created_at DESC'
        : 'SELECT * FROM keywords ORDER BY created_at DESC';
    return getDb().prepare(sql).all();
}

export function getActiveKeywords() {
    return getKeywords(true);
}

export function addKeyword(keyword, category = 'custom', sourceProfileId = null) {
    return getDb().prepare(`
        INSERT INTO keywords (keyword, category, source_profile_id, is_active, performance_score, threads_matched, threads_engaged, created_at)
        VALUES (?, ?, ?, 1, 50, 0, 0, CURRENT_TIMESTAMP)
    `).run(keyword, category, sourceProfileId);
}

export function getKeywordByText(keywordText) {
    return getDb().prepare('SELECT * FROM keywords WHERE keyword = ?').get(keywordText);
}

export function keywordExists(keywordText) {
    const row = getDb().prepare('SELECT 1 FROM keywords WHERE LOWER(keyword) = LOWER(?)').get(keywordText);
    return !!row;
}

export function deleteKeyword(id) {
    return getDb().prepare('DELETE FROM keywords WHERE id = ?').run(id);
}

export function toggleKeyword(id, isActive) {
    return getDb().prepare('UPDATE keywords SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
}

export function updateKeywordPerformance(id, scoreDelta) {
    return getDb().prepare(`
        UPDATE keywords SET
            performance_score = MIN(100, MAX(0, performance_score + ?))
        WHERE id = ?
    `).run(scoreDelta, id);
}

export function incrementKeywordMatched(id) {
    return getDb().prepare(`
        UPDATE keywords SET threads_matched = threads_matched + 1 WHERE id = ?
    `).run(id);
}

export function incrementKeywordEngaged(id) {
    return getDb().prepare(`
        UPDATE keywords SET threads_engaged = threads_engaged + 1 WHERE id = ?
    `).run(id);
}

export function getUnderperformingKeywords(minMatched = 10, maxScore = 20) {
    return getDb().prepare(`
        SELECT * FROM keywords
        WHERE is_active = 1
        AND category IN ('auto-generated', 'auto-discovered', 'auto-experiment')
        AND threads_matched >= ?
        AND performance_score <= ?
    `).all(minMatched, maxScore);
}

export function getKeywordStats() {
    const db = getDb();
    return {
        active: db.prepare('SELECT COUNT(*) as count FROM keywords WHERE is_active = 1').get().count,
        disabled: db.prepare('SELECT COUNT(*) as count FROM keywords WHERE is_active = 0').get().count,
        avgScore: db.prepare('SELECT AVG(performance_score) as avg FROM keywords WHERE is_active = 1').get().avg || 50,
        topPerformers: db.prepare(`
            SELECT * FROM keywords WHERE is_active = 1 ORDER BY performance_score DESC LIMIT 5
        `).all(),
        underperforming: db.prepare(`
            SELECT * FROM keywords WHERE is_active = 1 AND threads_matched > 5 ORDER BY performance_score ASC LIMIT 5
        `).all()
    };
}

// ============================================
// Keyword Changes Log
// ============================================

export function logKeywordChange(keywordId, keywordText, action, reason) {
    return getDb().prepare(`
        INSERT INTO keyword_changes (keyword_id, keyword_text, action, reason, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(keywordId, keywordText, action, reason);
}

export function getRecentKeywordChanges(days = 7) {
    return getDb().prepare(`
        SELECT * FROM keyword_changes
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        ORDER BY created_at DESC
    `).all(days);
}

export function dismissKeywordChanges(beforeDate) {
    // We don't delete, just mark as acknowledged via a setting
    setSetting('keywords.last_dismissed', beforeDate || new Date().toISOString());
}

// ============================================
// Product Profiles Operations
// ============================================

export function getProductProfiles(activeOnly = true) {
    const sql = activeOnly
        ? 'SELECT * FROM product_profiles WHERE is_active = 1 ORDER BY created_at DESC'
        : 'SELECT * FROM product_profiles ORDER BY created_at DESC';
    const rows = getDb().prepare(sql).all();

    // Parse JSON fields
    return rows.map(parseProductProfile);
}

export function getActiveProductProfiles() {
    return getProductProfiles(true);
}

export function getProductProfile(id) {
    const row = getDb().prepare('SELECT * FROM product_profiles WHERE id = ?').get(id);
    return row ? parseProductProfile(row) : null;
}

function parseProductProfile(row) {
    return {
        ...row,
        problems_solved: safeJsonParse(row.problems_solved, []),
        target_audience: safeJsonParse(row.target_audience, []),
        relevant_keywords: safeJsonParse(row.relevant_keywords, []),
        tone_keywords: safeJsonParse(row.tone_keywords, [])
    };
}

export function createProductProfile(profile) {
    const {
        name, one_liner, problems_solved, target_audience,
        relevant_keywords, tone_keywords, when_to_mention,
        when_not_to_mention, url
    } = profile;

    return getDb().prepare(`
        INSERT INTO product_profiles (
            name, one_liner, problems_solved, target_audience,
            relevant_keywords, tone_keywords, when_to_mention,
            when_not_to_mention, url, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        name,
        one_liner || null,
        JSON.stringify(problems_solved || []),
        JSON.stringify(target_audience || []),
        JSON.stringify(relevant_keywords || []),
        JSON.stringify(tone_keywords || []),
        when_to_mention || null,
        when_not_to_mention || null,
        url || null
    );
}

export function updateProductProfile(id, profile) {
    const {
        name, one_liner, problems_solved, target_audience,
        relevant_keywords, tone_keywords, when_to_mention,
        when_not_to_mention, url, is_active
    } = profile;

    return getDb().prepare(`
        UPDATE product_profiles SET
            name = ?, one_liner = ?, problems_solved = ?, target_audience = ?,
            relevant_keywords = ?, tone_keywords = ?, when_to_mention = ?,
            when_not_to_mention = ?, url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name,
        one_liner || null,
        JSON.stringify(problems_solved || []),
        JSON.stringify(target_audience || []),
        JSON.stringify(relevant_keywords || []),
        JSON.stringify(tone_keywords || []),
        when_to_mention || null,
        when_not_to_mention || null,
        url || null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        id
    );
}

export function deleteProductProfile(id) {
    return getDb().prepare('DELETE FROM product_profiles WHERE id = ?').run(id);
}

// ============================================
// Threads Operations
// ============================================

export function getThreads({ status, limit = 20, offset = 0 } = {}) {
    let sql = 'SELECT * FROM threads';
    const params = [];

    if (status) {
        sql += ' WHERE status = ?';
        params.push(status);
    }

    sql += ' ORDER BY first_seen_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = getDb().prepare(sql).all(...params);
    return rows.map(parseThread);
}

export function getThread(id) {
    const row = getDb().prepare('SELECT * FROM threads WHERE id = ?').get(id);
    return row ? parseThread(row) : null;
}

export function getThreadByTweetId(xTweetId) {
    const row = getDb().prepare('SELECT * FROM threads WHERE x_tweet_id = ?').get(xTweetId);
    return row ? parseThread(row) : null;
}

export function threadExists(xTweetId) {
    const row = getDb().prepare('SELECT 1 FROM threads WHERE x_tweet_id = ?').get(xTweetId);
    return !!row;
}

function parseThread(row) {
    return {
        ...row,
        keyword_matches: safeJsonParse(row.keyword_matches, [])
    };
}

export function insertThread(thread) {
    const {
        x_tweet_id, x_author_id, x_author_username, x_author_name,
        x_author_followers, content, reply_count, like_count,
        retweet_count, view_count, thread_url, keyword_matches,
        semantic_score, relevance_reasoning, detected_tone,
        detected_topic, x_created_at, conversation_id
    } = thread;

    return getDb().prepare(`
        INSERT INTO threads (
            x_tweet_id, x_author_id, x_author_username, x_author_name,
            x_author_followers, content, reply_count, like_count,
            retweet_count, view_count, thread_url, keyword_matches,
            semantic_score, relevance_reasoning, detected_tone,
            detected_topic, x_created_at, conversation_id,
            status, first_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        x_tweet_id, x_author_id, x_author_username || null, x_author_name || null,
        x_author_followers || 0, content, reply_count || 0, like_count || 0,
        retweet_count || 0, view_count || 0, thread_url || null,
        JSON.stringify(keyword_matches || []), semantic_score || 0,
        relevance_reasoning || null, detected_tone || null,
        detected_topic || null, x_created_at || null, conversation_id || null
    );
}

export function updateThreadStatus(id, status) {
    const statusField = status === 'viewed' ? 'viewed_at'
        : status === 'replied' ? 'replied_at'
        : status === 'skipped' ? 'skipped_at'
        : null;

    if (statusField) {
        return getDb().prepare(`
            UPDATE threads SET status = ?, ${statusField} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, id);
    } else {
        return getDb().prepare(`
            UPDATE threads SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, id);
    }
}

export function deleteThread(id) {
    return getDb().prepare('DELETE FROM threads WHERE id = ?').run(id);
}

export function getThreadCount(status) {
    if (status) {
        return getDb().prepare('SELECT COUNT(*) as count FROM threads WHERE status = ?').get(status).count;
    }
    return getDb().prepare('SELECT COUNT(*) as count FROM threads').get().count;
}

export function getStaleThreads(hoursOld = 24) {
    return getDb().prepare(`
        SELECT id FROM threads
        WHERE status = 'new'
        AND first_seen_at < datetime('now', '-' || ? || ' hours')
    `).all(hoursOld);
}

// ============================================
// Replies Operations
// ============================================

export function getReplies({ threadId, posted = null, limit = 20, offset = 0 } = {}) {
    let sql = 'SELECT * FROM replies WHERE 1=1';
    const params = [];

    if (threadId) {
        sql += ' AND thread_id = ?';
        params.push(threadId);
    }

    if (posted !== null) {
        sql += posted ? ' AND x_reply_id IS NOT NULL' : ' AND x_reply_id IS NULL';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = getDb().prepare(sql).all(...params);
    return rows.map(parseReply);
}

export function getReply(id) {
    const row = getDb().prepare('SELECT * FROM replies WHERE id = ?').get(id);
    return row ? parseReply(row) : null;
}

function parseReply(row) {
    return {
        ...row,
        edit_diff: safeJsonParse(row.edit_diff, null)
    };
}

export function insertReply(reply) {
    const {
        thread_id, product_profile_id, suggested_text, final_text,
        reply_type, generation_reasoning
    } = reply;

    return getDb().prepare(`
        INSERT INTO replies (
            thread_id, product_profile_id, suggested_text, final_text,
            reply_type, generation_reasoning, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
        thread_id, product_profile_id || null, suggested_text,
        final_text, reply_type || null, generation_reasoning || null
    );
}

export function updateReplyAsPosted(id, xReplyId) {
    return getDb().prepare(`
        UPDATE replies SET x_reply_id = ?, posted_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(xReplyId, id);
}

export function updateReplyEdit(id, editedText, editDiff) {
    return getDb().prepare(`
        UPDATE replies SET
            edited_text = ?,
            final_text = ?,
            was_edited = 1,
            edit_diff = ?
        WHERE id = ?
    `).run(editedText, editedText, JSON.stringify(editDiff), id);
}

export function updateReplyMetrics(id, metrics, interval) {
    const suffix = `_${interval}h`;
    return getDb().prepare(`
        UPDATE replies SET
            views${suffix} = ?,
            likes${suffix} = ?,
            replies${suffix} = ?,
            last_metrics_fetch = CURRENT_TIMESTAMP,
            metrics_fetch_count = metrics_fetch_count + 1
        WHERE id = ?
    `).run(metrics.views, metrics.likes, metrics.replies, id);
}

export function getRepliesNeedingMetrics() {
    return getDb().prepare(`
        SELECT r.*, t.x_tweet_id as thread_tweet_id
        FROM replies r
        JOIN threads t ON r.thread_id = t.id
        WHERE r.x_reply_id IS NOT NULL
        AND r.metrics_fetch_count < 3
        AND (
            (r.metrics_fetch_count = 0 AND r.posted_at < datetime('now', '-1 hour'))
            OR (r.metrics_fetch_count = 1 AND r.posted_at < datetime('now', '-6 hours'))
            OR (r.metrics_fetch_count = 2 AND r.posted_at < datetime('now', '-24 hours'))
        )
    `).all();
}

// ============================================
// Feedback Operations
// ============================================

export function addFeedback(feedback) {
    const { thread_id, reply_id, feedback_type, notes } = feedback;

    return getDb().prepare(`
        INSERT INTO feedback (thread_id, reply_id, feedback_type, notes, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(thread_id || null, reply_id || null, feedback_type, notes || null);
}

// ============================================
// Learned Patterns Operations
// ============================================

export function getLearnedPatterns(patternType) {
    const rows = getDb().prepare(
        'SELECT * FROM learned_patterns WHERE pattern_type = ?'
    ).all(patternType);

    return rows.map(row => ({
        ...row,
        pattern_value: safeJsonParse(row.pattern_value, {})
    }));
}

export function updateLearnedPattern(patternType, patternKey, patternValue, confidence, sampleCount) {
    return getDb().prepare(`
        INSERT INTO learned_patterns (pattern_type, pattern_key, pattern_value, confidence, sample_count, last_computed)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(pattern_type, pattern_key) DO UPDATE SET
            pattern_value = excluded.pattern_value,
            confidence = excluded.confidence,
            sample_count = excluded.sample_count,
            last_computed = CURRENT_TIMESTAMP
    `).run(patternType, patternKey, JSON.stringify(patternValue), confidence, sampleCount);
}

// ============================================
// Credentials Operations
// ============================================

export function getCredential(key) {
    const row = getDb().prepare('SELECT encrypted_value FROM credentials WHERE key = ?').get(key);
    return row ? row.encrypted_value : null;
}

export function setCredential(key, encryptedValue) {
    return getDb().prepare(`
        INSERT INTO credentials (key, encrypted_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = CURRENT_TIMESTAMP
    `).run(key, encryptedValue);
}

// ============================================
// API Usage Tracking
// ============================================

export function recordApiUsage(apiName, operation, count = 1) {
    return getDb().prepare(`
        INSERT INTO api_usage (api_name, operation, count, recorded_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(apiName, operation, count);
}

export function getApiUsageThisMonth(apiName) {
    const result = getDb().prepare(`
        SELECT COALESCE(SUM(count), 0) as total
        FROM api_usage
        WHERE api_name = ?
        AND recorded_at >= date('now', 'start of month')
    `).get(apiName);

    return result.total;
}

// ============================================
// Analytics Helpers
// ============================================

export function getAnalyticsSummary() {
    const db = getDb();

    return {
        threads: {
            total: db.prepare('SELECT COUNT(*) as count FROM threads').get().count,
            new: db.prepare("SELECT COUNT(*) as count FROM threads WHERE status = 'new'").get().count,
            viewed: db.prepare("SELECT COUNT(*) as count FROM threads WHERE status = 'viewed'").get().count,
            replied: db.prepare("SELECT COUNT(*) as count FROM threads WHERE status = 'replied'").get().count,
            skipped: db.prepare("SELECT COUNT(*) as count FROM threads WHERE status = 'skipped'").get().count
        },
        replies: {
            total: db.prepare('SELECT COUNT(*) as count FROM replies').get().count,
            posted: db.prepare('SELECT COUNT(*) as count FROM replies WHERE x_reply_id IS NOT NULL').get().count,
            edited: db.prepare('SELECT COUNT(*) as count FROM replies WHERE was_edited = 1').get().count
        },
        apiUsage: {
            xRead: getApiUsageThisMonth('x_read'),
            xWrite: getApiUsageThisMonth('x_write'),
            grok: getApiUsageThisMonth('grok')
        }
    };
}

// ============================================
// Keyword Experiment Log Operations
// ============================================

export function logKeywordExperiment(keyword, strategy) {
    return getDb().prepare(`
        INSERT INTO keyword_experiment_log (keyword, strategy, generated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(keyword, strategy);
}

export function updateExperimentOutcome(keyword, outcome, finalScore, threadsMatched) {
    return getDb().prepare(`
        UPDATE keyword_experiment_log
        SET outcome = ?, final_score = ?, threads_matched = ?
        WHERE keyword = ? AND outcome = 'active'
    `).run(outcome, finalScore, threadsMatched, keyword);
}

export function getActiveExperiments() {
    return getDb().prepare(`
        SELECT * FROM keyword_experiment_log WHERE outcome = 'active'
    `).all();
}

export function cleanupFailedExperiments() {
    return getDb().prepare(`
        DELETE FROM keyword_experiment_log
        WHERE outcome = 'failed'
        AND generated_at < datetime('now', '-7 days')
    `).run();
}

// ============================================
// Utility Functions
// ============================================

function safeJsonParse(value, defaultValue) {
    if (!value) return defaultValue;
    try {
        return JSON.parse(value);
    } catch {
        return defaultValue;
    }
}

/**
 * Close the database connection
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
