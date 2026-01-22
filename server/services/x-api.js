import { TwitterApi } from 'twitter-api-v2';
import config from '../config.js';
import { recordApiUsage, getApiUsageThisMonth, getSetting, setSetting } from '../db/db.js';

let client = null;

// Rate limit state tracking
let rateLimitResetTime = null;

/**
 * Execute a function with exponential backoff retry on rate limits
 * @param {Function} fn - Async function to execute
 * @param {object} options - Retry options
 * @returns {Promise<any>} Result of the function
 */
async function withRateLimitRetry(fn, options = {}) {
    const { maxRetries = 3, context = 'API call' } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check if we're still in a known rate limit window
        if (rateLimitResetTime && Date.now() < rateLimitResetTime) {
            const waitMs = rateLimitResetTime - Date.now() + 1000;
            console.log(`[X API] In rate limit window. Waiting ${Math.ceil(waitMs / 1000)}s before ${context}`);
            await new Promise(r => setTimeout(r, waitMs));
        }

        try {
            const result = await fn();
            // Success - clear any rate limit state
            rateLimitResetTime = null;
            return result;
        } catch (error) {
            const isRateLimit = error.code === 429 || error.message?.includes('429');

            if (!isRateLimit || attempt >= maxRetries) {
                throw error;
            }

            // Extract reset time from error or default to 15 minutes
            let waitMs;
            if (error.rateLimit?.reset) {
                // Twitter provides reset time as Unix timestamp (seconds)
                waitMs = (error.rateLimit.reset * 1000) - Date.now() + 1000;
            } else {
                // Default: exponential backoff starting at 1 min, max 15 min
                const baseWait = 60 * 1000; // 1 minute
                waitMs = Math.min(baseWait * Math.pow(2, attempt), 15 * 60 * 1000);
            }

            // Ensure we wait at least 30 seconds
            waitMs = Math.max(waitMs, 30 * 1000);

            // Track the reset time globally
            rateLimitResetTime = Date.now() + waitMs;

            const waitSeconds = Math.ceil(waitMs / 1000);
            console.log(`[X API] Rate limited on ${context}. Waiting ${waitSeconds}s before retry ${attempt + 1}/${maxRetries}`);

            await new Promise(r => setTimeout(r, waitMs));
        }
    }
}

/**
 * Check if we're currently rate limited
 * @returns {object} { isLimited, resetIn }
 */
export function getRateLimitStatus() {
    if (rateLimitResetTime && Date.now() < rateLimitResetTime) {
        return {
            isLimited: true,
            resetIn: Math.ceil((rateLimitResetTime - Date.now()) / 1000)
        };
    }
    return { isLimited: false, resetIn: 0 };
}

/**
 * Get credentials from config (env vars) or database settings
 * Database settings take precedence if env vars are empty
 */
function getCredentials() {
    return {
        apiKey: config.xApiKey || getSetting('credentials.x_api_key') || '',
        apiSecret: config.xApiSecret || getSetting('credentials.x_api_secret') || '',
        accessToken: config.xAccessToken || getSetting('credentials.x_access_token') || '',
        accessSecret: config.xAccessSecret || getSetting('credentials.x_access_secret') || ''
    };
}

/**
 * Check if X API credentials are configured (either env or database)
 */
export function hasCredentials() {
    const creds = getCredentials();
    return !!(creds.apiKey && creds.apiSecret && creds.accessToken && creds.accessSecret);
}

/**
 * Get or create the Twitter API client
 * Uses OAuth 1.0a User Context for full read/write access
 */
export async function getClient() {
    if (client) return client;

    const creds = getCredentials();

    // Check for credentials
    if (!creds.apiKey || !creds.apiSecret || !creds.accessToken || !creds.accessSecret) {
        throw new Error('X API credentials not configured. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET in environment or database.');
    }

    client = new TwitterApi({
        appKey: creds.apiKey,
        appSecret: creds.apiSecret,
        accessToken: creds.accessToken,
        accessSecret: creds.accessSecret,
    });

    return client;
}

/**
 * Check if we have budget remaining for API calls
 */
export function checkBudget(type = 'read') {
    const apiName = type === 'write' ? 'x_write' : 'x_read';
    const limit = type === 'write' ? config.xApiMonthlyWriteLimit : config.xApiMonthlyReadLimit;
    const used = getApiUsageThisMonth(apiName);

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dayOfMonth = new Date().getDate();
    const daysRemaining = daysInMonth - dayOfMonth + 1;

    const remaining = limit - used;
    const dailyBudget = Math.floor(remaining / daysRemaining);

    return {
        used,
        remaining,
        limit,
        dailyBudget,
        hasCapacity: remaining > 0
    };
}

/**
 * Search for recent tweets matching a query
 * @param {string} query - Search query (e.g., "keyword -is:retweet -is:reply")
 * @param {object} options - Search options
 * @returns {Promise<Array>} Array of tweets with author info
 */
export async function searchTweets(query, options = {}) {
    const api = await getClient();

    // Destructure known options to prevent camelCase params leaking to API
    const { maxResults, ...restOptions } = options;

    const searchParams = {
        max_results: maxResults || 100,
        'tweet.fields': ['public_metrics', 'created_at', 'conversation_id', 'author_id'],
        'user.fields': ['public_metrics', 'username', 'name'],
        expansions: ['author_id'],
        ...restOptions
    };

    let result;
    try {
        result = await withRateLimitRetry(
            () => api.v2.search(query, searchParams),
            { maxRetries: 3, context: `search "${query.substring(0, 30)}..."` }
        );
    } catch (error) {
        // Extract detailed error info from twitter-api-v2
        const details = {
            code: error.code,
            message: error.message,
            data: error.data,
            errors: error.errors,
            query: query
        };
        console.error('[X API] Search failed:', JSON.stringify(details, null, 2));

        // Re-throw with more context
        const errorMsg = error.errors?.[0]?.message || error.message || 'Unknown error';
        throw new Error(`Request failed with code ${error.code || 'unknown'} - ${errorMsg}`);
    }

    // The v2.search returns a paginator object
    // Access tweets via .tweets or .data.data, users via .includes
    const tweets = result.tweets || result.data?.data || [];
    const includedUsers = result.includes?.users || result.data?.includes?.users || [];

    // Record API usage
    recordApiUsage('x_read', 'search', tweets.length);

    // Map users to tweets for easy access
    const users = new Map(
        includedUsers.map(u => [u.id, u])
    );

    return tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        author_id: tweet.author_id,
        author: users.get(tweet.author_id) || null,
        public_metrics: tweet.public_metrics,
        created_at: tweet.created_at,
        conversation_id: tweet.conversation_id
    }));
}

/**
 * Post a reply to a tweet
 * @param {string} tweetId - ID of the tweet to reply to
 * @param {string} text - Reply text (max 280 chars)
 * @returns {Promise<object>} Posted tweet data
 */
export async function postReply(tweetId, text) {
    if (text.length > 280) {
        throw new Error('Reply text exceeds 280 character limit');
    }

    const api = await getClient();

    const result = await api.v2.reply(text, tweetId);

    // Record API usage
    recordApiUsage('x_write', 'reply', 1);

    return {
        id: result.data.id,
        text: result.data.text
    };
}

/**
 * Get metrics for a specific tweet
 * @param {string} tweetId - Tweet ID
 * @returns {Promise<object>} Tweet metrics
 */
export async function getTweetMetrics(tweetId) {
    const api = await getClient();

    const tweet = await api.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics']
    });

    // Record API usage
    recordApiUsage('x_read', 'metrics', 1);

    const metrics = tweet.data.public_metrics || {};

    return {
        views: metrics.impression_count || 0,
        likes: metrics.like_count || 0,
        replies: metrics.reply_count || 0,
        retweets: metrics.retweet_count || 0,
        quotes: metrics.quote_count || 0
    };
}

/**
 * Get top replies from a thread/conversation
 * @param {string} conversationId - Conversation ID
 * @param {number} limit - Max replies to fetch
 * @returns {Promise<Array>} Array of reply tweets
 */
export async function getThreadReplies(conversationId, limit = 5) {
    const api = await getClient();

    const result = await api.v2.search(`conversation_id:${conversationId}`, {
        max_results: Math.min(limit, 100),
        'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
        'user.fields': ['username'],
        expansions: ['author_id'],
        sort_order: 'relevancy'
    });

    // The v2.search returns a paginator object
    const tweets = result.tweets || result.data?.data || [];
    const includedUsers = result.includes?.users || result.data?.includes?.users || [];

    // Record API usage
    recordApiUsage('x_read', 'thread_replies', tweets.length);

    const users = new Map(
        includedUsers.map(u => [u.id, u])
    );

    return tweets.map(tweet => ({
        text: tweet.text,
        author: users.get(tweet.author_id)?.username || 'unknown',
        likes: tweet.public_metrics?.like_count || 0,
        created_at: tweet.created_at
    }));
}

/**
 * Build a search query for keyword monitoring
 * Excludes retweets and replies to find original tweets
 * @param {string} keyword - Keyword to search for
 * @param {object} options - Query options
 * @param {boolean} options.excludeRetweets - Add -is:retweet (default: true)
 * @param {boolean} options.excludeReplies - Add -is:reply (default: true)
 * @param {string} options.lang - Language filter (default: null - disabled for Basic tier compatibility)
 * @returns {string} Formatted search query
 */
export function buildSearchQuery(keyword, options = {}) {
    const {
        excludeRetweets = true,
        excludeReplies = true,
        lang = null  // Disabled by default - may not be available on Basic tier
    } = options;

    // Quote multi-word phrases for exact matching
    // Twitter treats unquoted spaces as OR operators
    const searchTerm = keyword.includes(' ') ? `"${keyword}"` : keyword;

    const parts = [searchTerm];

    if (excludeRetweets) parts.push('-is:retweet');
    if (excludeReplies) parts.push('-is:reply');
    if (lang) parts.push(`lang:${lang}`);

    return parts.join(' ');
}

/**
 * Reset the client (useful after credential changes)
 */
export function resetClient() {
    client = null;
}

/**
 * Get current API usage stats
 */
export function getUsageStats() {
    return {
        read: checkBudget('read'),
        write: checkBudget('write')
    };
}

/**
 * Validate X API credentials without saving them
 * Creates a temporary client and tests authentication
 * @param {object} credentials - { apiKey, apiSecret, accessToken, accessSecret }
 * @returns {Promise<object>} { valid: boolean, details?: object, error?: string, code?: string }
 */
export async function validateCredentials(credentials) {
    const { apiKey, apiSecret, accessToken, accessSecret } = credentials;

    // Check all required fields are present
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        return {
            valid: false,
            error: 'All four credentials are required',
            code: 'MISSING_CREDENTIALS'
        };
    }

    try {
        // Create temporary client with provided credentials
        const tempClient = new TwitterApi({
            appKey: apiKey,
            appSecret: apiSecret,
            accessToken: accessToken,
            accessSecret: accessSecret,
        });

        // Test authentication by fetching current user
        const me = await tempClient.v2.me({
            'user.fields': ['username', 'name', 'public_metrics']
        });

        return {
            valid: true,
            details: {
                userId: me.data.id,
                username: me.data.username,
                name: me.data.name,
                followers: me.data.public_metrics?.followers_count || 0
            }
        };
    } catch (error) {
        // Parse Twitter API errors
        if (error.code === 401 || error.message?.includes('401')) {
            return {
                valid: false,
                error: 'Invalid credentials. Double-check your API key, secret, and tokens.',
                code: 'INVALID_CREDENTIALS'
            };
        }

        if (error.code === 403 || error.message?.includes('403')) {
            return {
                valid: false,
                error: 'Access forbidden. Your app may need elevated permissions at developer.x.com.',
                code: 'FORBIDDEN'
            };
        }

        if (error.code === 429 || error.message?.includes('429')) {
            return {
                valid: false,
                error: 'Rate limited. Please wait a moment and try again.',
                code: 'RATE_LIMITED'
            };
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return {
                valid: false,
                error: 'Network error. Check your internet connection.',
                code: 'NETWORK_ERROR'
            };
        }

        // Generic error
        return {
            valid: false,
            error: error.message || 'Failed to validate credentials',
            code: 'UNKNOWN_ERROR'
        };
    }
}

/**
 * Test search with different query configurations
 * Useful for diagnosing which operators work on your API tier
 * @param {string} keyword - Test keyword
 * @returns {Promise<object>} Test results for each configuration
 */
export async function testSearchConfigs(keyword = 'javascript') {
    const configs = [
        { name: 'bare', options: { excludeRetweets: false, excludeReplies: false, lang: null } },
        { name: 'no-retweets', options: { excludeRetweets: true, excludeReplies: false, lang: null } },
        { name: 'no-replies', options: { excludeRetweets: false, excludeReplies: true, lang: null } },
        { name: 'no-rt-no-reply', options: { excludeRetweets: true, excludeReplies: true, lang: null } },
        { name: 'with-lang', options: { excludeRetweets: true, excludeReplies: true, lang: 'en' } }
    ];

    const results = {};

    for (const config of configs) {
        const query = buildSearchQuery(keyword, config.options);
        try {
            const tweets = await searchTweets(query, { maxResults: 10 });
            results[config.name] = { success: true, query, count: tweets.length };
            console.log(`[Test] ✓ ${config.name}: ${tweets.length} tweets`);
        } catch (error) {
            results[config.name] = { success: false, query, error: error.message };
            console.log(`[Test] ✗ ${config.name}: ${error.message}`);
        }
    }

    return results;
}
