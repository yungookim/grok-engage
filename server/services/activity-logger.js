/**
 * Activity Logger Service
 * Maintains detailed activity logs for the frontend to display
 */

// Maximum number of log entries to keep
const MAX_LOG_ENTRIES = 500;
// Maximum number of scanned tweets to keep
const MAX_SCANNED_TWEETS = 200;

// In-memory storage for activity logs
let activityLogs = [];
// In-memory storage for scanned tweets (includes those that didn't pass threshold)
let scannedTweets = [];
// Current discovery session ID (changes each discovery cycle)
let currentSessionId = null;

/**
 * Log entry types
 */
export const LogType = {
    DISCOVERY_START: 'discovery_start',
    DISCOVERY_END: 'discovery_end',
    KEYWORD_SEARCH: 'keyword_search',
    TWEET_FOUND: 'tweet_found',
    TWEET_FILTERED: 'tweet_filtered',
    TWEET_SCORED: 'tweet_scored',
    TWEET_ADDED: 'tweet_added',
    TWEET_SKIPPED: 'tweet_skipped',
    ERROR: 'error',
    RATE_LIMIT: 'rate_limit',
    INFO: 'info'
};

/**
 * Log an activity entry
 * @param {string} type - One of LogType values
 * @param {string} message - Human-readable message
 * @param {object} data - Additional data for the log entry
 */
export function log(type, message, data = {}) {
    const entry = {
        id: generateId(),
        type,
        message,
        data,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
    };

    activityLogs.unshift(entry);

    // Trim to max size
    if (activityLogs.length > MAX_LOG_ENTRIES) {
        activityLogs = activityLogs.slice(0, MAX_LOG_ENTRIES);
    }

    // Also log to console for debugging
    const prefix = `[Activity:${type}]`;
    if (type === LogType.ERROR) {
        console.error(prefix, message, data);
    } else {
        console.log(prefix, message);
    }

    return entry;
}

/**
 * Start a new discovery session
 * @param {string} trigger - 'scheduled' or 'manual'
 * @returns {string} Session ID
 */
export function startDiscoverySession(trigger = 'scheduled') {
    currentSessionId = generateId();
    log(LogType.DISCOVERY_START, `Discovery cycle started (${trigger})`, { trigger });
    return currentSessionId;
}

/**
 * End the current discovery session
 * @param {object} results - Discovery results summary
 */
export function endDiscoverySession(results) {
    log(LogType.DISCOVERY_END, `Discovery complete: ${results.threadsAdded} new threads from ${results.tweetsScored} scored tweets`, results);
    currentSessionId = null;
}

/**
 * Log a keyword search
 * @param {string} keyword - The keyword searched
 * @param {number} tweetsFound - Number of tweets found
 */
export function logKeywordSearch(keyword, tweetsFound) {
    log(LogType.KEYWORD_SEARCH, `Keyword "${keyword}": found ${tweetsFound} tweets`, {
        keyword,
        tweetsFound
    });
}

/**
 * Log a tweet that was found but filtered out (below reply threshold)
 * @param {object} tweet - The tweet object
 * @param {string} keyword - The keyword that found it
 * @param {string} reason - Why it was filtered
 */
export function logTweetFiltered(tweet, keyword, reason) {
    const entry = {
        id: generateId(),
        tweetId: tweet.id,
        authorUsername: tweet.author?.username || 'unknown',
        authorName: tweet.author?.name || 'Unknown',
        content: truncateContent(tweet.text),
        replyCount: tweet.public_metrics?.reply_count || 0,
        likeCount: tweet.public_metrics?.like_count || 0,
        keyword,
        status: 'filtered',
        reason,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
    };

    addScannedTweet(entry);
}

/**
 * Log a tweet that was scored
 * @param {object} tweet - The tweet object
 * @param {string} keyword - The keyword that found it
 * @param {object} scoreResult - Score result from relevance service
 * @param {number} threshold - The semantic threshold
 * @param {boolean} passed - Whether it passed the threshold
 */
export function logTweetScored(tweet, keyword, scoreResult, threshold, passed) {
    const status = passed ? 'passed' : 'below_threshold';
    const message = `Scored tweet ${tweet.id}: ${scoreResult.score}/100 (threshold: ${threshold}) - ${passed ? 'PASS' : 'SKIP'}`;

    log(LogType.TWEET_SCORED, message, {
        tweetId: tweet.id,
        score: scoreResult.score,
        threshold,
        passed,
        tone: scoreResult.tone,
        topic: scoreResult.topic
    });

    const entry = {
        id: generateId(),
        tweetId: tweet.id,
        authorUsername: tweet.author?.username || 'unknown',
        authorName: tweet.author?.name || 'Unknown',
        authorFollowers: tweet.author?.public_metrics?.followers_count || 0,
        content: truncateContent(tweet.text),
        fullContent: tweet.text,
        replyCount: tweet.public_metrics?.reply_count || 0,
        likeCount: tweet.public_metrics?.like_count || 0,
        retweetCount: tweet.public_metrics?.retweet_count || 0,
        viewCount: tweet.public_metrics?.impression_count || 0,
        keyword,
        status,
        score: scoreResult.score,
        threshold,
        reasoning: scoreResult.reasoning,
        tone: scoreResult.tone,
        topic: scoreResult.topic,
        tweetUrl: `https://x.com/${tweet.author?.username || 'i'}/status/${tweet.id}`,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString()
    };

    addScannedTweet(entry);
}

/**
 * Log a tweet that was added to the database
 * @param {object} tweet - The tweet object
 * @param {number} score - The semantic score
 */
export function logTweetAdded(tweet, score) {
    log(LogType.TWEET_ADDED, `Added thread ${tweet.id} (score: ${score})`, {
        tweetId: tweet.id,
        score
    });
}

/**
 * Log an error
 * @param {string} message - Error message
 * @param {object} data - Additional error data
 */
export function logError(message, data = {}) {
    log(LogType.ERROR, message, data);
}

/**
 * Log rate limiting
 * @param {string} message - Rate limit message
 */
export function logRateLimit(message) {
    log(LogType.RATE_LIMIT, message, {});
}

/**
 * Add a scanned tweet to the history
 * @param {object} entry - Scanned tweet entry
 */
function addScannedTweet(entry) {
    scannedTweets.unshift(entry);

    // Trim to max size
    if (scannedTweets.length > MAX_SCANNED_TWEETS) {
        scannedTweets = scannedTweets.slice(0, MAX_SCANNED_TWEETS);
    }
}

/**
 * Get activity logs
 * @param {object} options - Query options
 * @param {number} options.limit - Max number of entries (default 100)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @param {string} options.type - Filter by log type
 * @param {string} options.sessionId - Filter by session ID
 * @param {string} options.since - Get logs since this timestamp
 * @returns {object} { logs: [], total: number }
 */
export function getLogs({ limit = 100, offset = 0, type = null, sessionId = null, since = null } = {}) {
    let filtered = activityLogs;

    if (type) {
        filtered = filtered.filter(l => l.type === type);
    }

    if (sessionId) {
        filtered = filtered.filter(l => l.sessionId === sessionId);
    }

    if (since) {
        const sinceDate = new Date(since);
        filtered = filtered.filter(l => new Date(l.timestamp) > sinceDate);
    }

    return {
        logs: filtered.slice(offset, offset + limit),
        total: filtered.length
    };
}

/**
 * Get scanned tweets
 * @param {object} options - Query options
 * @param {number} options.limit - Max number of entries (default 50)
 * @param {number} options.offset - Offset for pagination (default 0)
 * @param {string} options.status - Filter by status (passed, below_threshold, filtered)
 * @param {string} options.sessionId - Filter by session ID
 * @returns {object} { tweets: [], total: number }
 */
export function getScannedTweets({ limit = 50, offset = 0, status = null, sessionId = null } = {}) {
    let filtered = scannedTweets;

    if (status) {
        filtered = filtered.filter(t => t.status === status);
    }

    if (sessionId) {
        filtered = filtered.filter(t => t.sessionId === sessionId);
    }

    return {
        tweets: filtered.slice(offset, offset + limit),
        total: filtered.length
    };
}

/**
 * Get summary statistics
 * @returns {object} Summary stats
 */
export function getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    const recentLogs = activityLogs.filter(l => new Date(l.timestamp) > oneHourAgo);
    const recentScanned = scannedTweets.filter(t => new Date(t.timestamp) > oneHourAgo);

    return {
        totalLogs: activityLogs.length,
        totalScanned: scannedTweets.length,
        lastHour: {
            logs: recentLogs.length,
            scanned: recentScanned.length,
            passed: recentScanned.filter(t => t.status === 'passed').length,
            filtered: recentScanned.filter(t => t.status === 'filtered').length,
            belowThreshold: recentScanned.filter(t => t.status === 'below_threshold').length
        },
        currentSession: currentSessionId
    };
}

/**
 * Clear all logs (for testing/debugging)
 */
export function clearLogs() {
    activityLogs = [];
    scannedTweets = [];
    currentSessionId = null;
}

/**
 * Generate a unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Truncate content for display
 */
function truncateContent(text, maxLength = 150) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
