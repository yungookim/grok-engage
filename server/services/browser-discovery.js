/**
 * Browser Discovery Service
 * Processes tweets scraped via browser automation (Claude-in-Chrome)
 * This bypasses X API rate limits by using unauthenticated browser access
 */

import { scoreThread } from './relevance.js';
import * as activityLogger from './activity-logger.js';
import {
    getSetting,
    threadExists,
    insertThread
} from '../db/db.js';

/**
 * Process tweets scraped from browser
 * Filters by engagement, scores relevance, and inserts qualifying threads
 *
 * @param {Array} tweets - Array of scraped tweet objects
 * @param {string} keyword - The keyword that was searched
 * @returns {Promise<object>} Processing results
 */
export async function processBrowserTweets(tweets, keyword) {
    const results = {
        tweetsReceived: tweets.length,
        tweetsFiltered: 0,
        tweetsScored: 0,
        threadsAdded: 0,
        errors: []
    };

    if (!tweets || tweets.length === 0) {
        return results;
    }

    // Start activity logging
    activityLogger.startDiscoverySession('browser');

    // Get settings
    const minReplies = getSetting('monitoring.min_replies') || 15;
    const semanticThreshold = getSetting('monitoring.semantic_threshold') || 70;

    activityLogger.log(activityLogger.LogType.INFO,
        `Processing ${tweets.length} browser-scraped tweets for keyword "${keyword}"`,
        { keyword, tweetCount: tweets.length, minReplies, semanticThreshold }
    );

    for (const tweet of tweets) {
        try {
            // Normalize scraped tweet to match X API format
            const normalizedTweet = normalizeTweet(tweet);

            // Filter by engagement threshold
            const replyCount = normalizedTweet.public_metrics?.reply_count || 0;
            if (replyCount < minReplies) {
                activityLogger.logTweetFiltered(normalizedTweet, keyword,
                    `Reply count (${replyCount}) below minimum (${minReplies})`);
                continue;
            }
            results.tweetsFiltered++;

            // Skip if already in database
            if (threadExists(normalizedTweet.id)) {
                continue;
            }

            // Score semantic relevance
            const score = await scoreThread(normalizedTweet);
            results.tweetsScored++;

            const passed = score.score >= semanticThreshold;
            activityLogger.logTweetScored(normalizedTweet, keyword, score, semanticThreshold, passed);

            if (passed) {
                // Store the thread
                // Use username as author_id fallback for browser-scraped tweets
                const authorId = normalizedTweet.author_id || normalizedTweet.author?.username || 'unknown';
                insertThread({
                    x_tweet_id: normalizedTweet.id,
                    x_author_id: authorId,
                    x_author_username: normalizedTweet.author?.username,
                    x_author_name: normalizedTweet.author?.name,
                    x_author_followers: normalizedTweet.author?.public_metrics?.followers_count || 0,
                    content: normalizedTweet.text,
                    reply_count: replyCount,
                    like_count: normalizedTweet.public_metrics?.like_count || 0,
                    retweet_count: normalizedTweet.public_metrics?.retweet_count || 0,
                    view_count: normalizedTweet.public_metrics?.impression_count || 0,
                    thread_url: normalizedTweet.url || `https://x.com/i/status/${normalizedTweet.id}`,
                    keyword_matches: [keyword],
                    semantic_score: score.score,
                    relevance_reasoning: score.reasoning,
                    detected_tone: score.tone,
                    detected_topic: score.topic,
                    x_created_at: normalizedTweet.created_at,
                    conversation_id: normalizedTweet.id // Use tweet ID as conversation ID for scraped tweets
                });

                results.threadsAdded++;
                activityLogger.logTweetAdded(normalizedTweet, score.score);
                console.log(`[BrowserDiscovery] Added thread ${normalizedTweet.id} (score: ${score.score})`);
            }
        } catch (error) {
            console.error(`[BrowserDiscovery] Error processing tweet:`, error.message);
            results.errors.push(error.message);
            activityLogger.logError(`Failed to process tweet: ${error.message}`);
        }
    }

    activityLogger.endDiscoverySession(results);
    console.log(`[BrowserDiscovery] Complete: ${results.threadsAdded} threads from ${results.tweetsScored} scored`);

    return results;
}

/**
 * Normalize scraped tweet data to match X API format
 * Handles different field names and structures
 *
 * @param {object} tweet - Raw scraped tweet
 * @returns {object} Normalized tweet matching X API structure
 */
function normalizeTweet(tweet) {
    // Extract tweet ID from URL if not provided directly
    let tweetId = tweet.id;
    if (!tweetId && tweet.url) {
        const match = tweet.url.match(/status\/(\d+)/);
        if (match) {
            tweetId = match[1];
        }
    }

    // Parse metrics - handle both nested and flat structures
    const metrics = tweet.metrics || {};
    const publicMetrics = {
        reply_count: parseInt(metrics.replies || tweet.replies || tweet.reply_count || 0, 10),
        like_count: parseInt(metrics.likes || tweet.likes || tweet.like_count || 0, 10),
        retweet_count: parseInt(metrics.retweets || tweet.retweets || tweet.retweet_count || 0, 10),
        impression_count: parseInt(metrics.views || tweet.views || tweet.view_count || 0, 10)
    };

    // Build author object
    const author = {
        username: tweet.author_username || tweet.username || tweet.handle,
        name: tweet.author_name || tweet.displayName || tweet.name,
        public_metrics: {
            followers_count: parseInt(tweet.author_followers || tweet.followers || 0, 10)
        }
    };

    return {
        id: tweetId,
        text: tweet.text || tweet.content,
        author_id: tweet.author_id,
        author,
        public_metrics: publicMetrics,
        created_at: tweet.timestamp || tweet.created_at,
        url: tweet.url,
        conversation_id: tweetId
    };
}

/**
 * Parse metric string (e.g., "1.2K", "5M") to number
 * @param {string|number} value - Metric value
 * @returns {number} Parsed number
 */
export function parseMetricString(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const str = String(value).trim().toUpperCase();

    // Handle K (thousands)
    if (str.endsWith('K')) {
        return Math.round(parseFloat(str.slice(0, -1)) * 1000);
    }

    // Handle M (millions)
    if (str.endsWith('M')) {
        return Math.round(parseFloat(str.slice(0, -1)) * 1000000);
    }

    // Handle commas
    return parseInt(str.replace(/,/g, ''), 10) || 0;
}
