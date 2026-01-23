import * as xApi from './x-api.js';
import * as relevance from './relevance.js';
import * as activityLogger from './activity-logger.js';
import {
    getActiveKeywords,
    getSettings,
    getSetting,
    setSetting,
    threadExists,
    insertThread,
    getStaleThreads,
    updateThreadStatus
} from '../db/db.js';

// Default batch size - process this many keywords per cycle
const DEFAULT_BATCH_SIZE = 3;
// Delay between keyword searches (ms) to reduce rate limit pressure
const KEYWORD_DELAY_MS = 5000;

/**
 * Main thread discovery function
 * Searches X for tweets matching configured keywords,
 * filters by engagement, scores relevance, and stores qualifying threads
 *
 * @returns {Promise<object>} Discovery results summary
 */
export async function discoverThreads(trigger = 'scheduled') {
    const results = {
        keywordsSearched: 0,
        tweetsFound: 0,
        tweetsFiltered: 0,
        tweetsScored: 0,
        threadsAdded: 0,
        errors: []
    };

    // Start activity logging session
    activityLogger.startDiscoverySession(trigger);

    // Check if we're in a rate limit window
    const rateLimitStatus = xApi.getRateLimitStatus();
    if (rateLimitStatus.isLimited) {
        const msg = `Rate limited - resets in ${rateLimitStatus.resetIn}s`;
        results.errors.push(msg);
        activityLogger.logRateLimit(msg);
        console.log(`[Discovery] Skipping cycle - rate limited for ${rateLimitStatus.resetIn}s`);
        activityLogger.endDiscoverySession(results);
        return results;
    }

    // Get active keywords
    const allKeywords = getActiveKeywords();
    if (allKeywords.length === 0) {
        const msg = 'No active keywords configured';
        results.errors.push(msg);
        activityLogger.logError(msg);
        activityLogger.endDiscoverySession(results);
        return results;
    }

    // Get settings
    const minReplies = getSetting('monitoring.min_replies') || 15;
    const semanticThreshold = getSetting('monitoring.semantic_threshold') || 70;
    const batchSize = getSetting('discovery.batch_size') || DEFAULT_BATCH_SIZE;

    // Get current batch index and select keywords for this cycle
    const batchIndex = getSetting('discovery.batch_index') || 0;
    const totalBatches = Math.ceil(allKeywords.length / batchSize);
    const startIdx = batchIndex * batchSize;
    const keywords = allKeywords.slice(startIdx, startIdx + batchSize);

    // Update batch index for next cycle (rotate through all keywords)
    const nextBatchIndex = (batchIndex + 1) % totalBatches;
    setSetting('discovery.batch_index', nextBatchIndex);

    activityLogger.log(activityLogger.LogType.INFO,
        `Starting batch ${batchIndex + 1}/${totalBatches} with ${keywords.length}/${allKeywords.length} keywords, min ${minReplies} replies, threshold ${semanticThreshold}`,
        { batchIndex: batchIndex + 1, totalBatches, keywordCount: keywords.length, minReplies, semanticThreshold }
    );
    console.log(`[Discovery] Starting batch ${batchIndex + 1}/${totalBatches} with ${keywords.length}/${allKeywords.length} keywords, min ${minReplies} replies, threshold ${semanticThreshold}`);

    let rateLimited = false;

    for (const keywordRow of keywords) {
        // Stop if we've hit rate limits
        if (rateLimited) {
            console.log(`[Discovery] Skipping remaining keywords due to rate limiting`);
            break;
        }

        try {
            // Check budget for each iteration
            const currentBudget = xApi.checkBudget('read');
            if (!currentBudget.hasCapacity) {
                results.errors.push('Budget exhausted mid-discovery');
                break;
            }

            const keyword = keywordRow.keyword;
            results.keywordsSearched++;

            // Build search query (excludes retweets and replies)
            const query = xApi.buildSearchQuery(keyword);

            // Search X for tweets
            const tweets = await xApi.searchTweets(query, { maxResults: 50 });
            results.tweetsFound += tweets.length;

            // Log keyword search result
            activityLogger.logKeywordSearch(keyword, tweets.length);
            console.log(`[Discovery] Keyword "${keyword}": found ${tweets.length} tweets`);

            for (const tweet of tweets) {
                // Filter by engagement threshold
                const replyCount = tweet.public_metrics?.reply_count || 0;
                if (replyCount < minReplies) {
                    // Log filtered tweet (below engagement threshold)
                    activityLogger.logTweetFiltered(tweet, keyword, `Reply count (${replyCount}) below minimum (${minReplies})`);
                    continue;
                }
                results.tweetsFiltered++;

                // Skip if already in database
                if (threadExists(tweet.id)) {
                    continue;
                }

                // Score semantic relevance
                try {
                    const score = await relevance.scoreThread(tweet);
                    results.tweetsScored++;

                    const passed = score.score >= semanticThreshold;

                    // Log the scoring result
                    activityLogger.logTweetScored(tweet, keyword, score, semanticThreshold, passed);
                    console.log(`[Discovery] Scored tweet ${tweet.id}: ${score.score}/100 (threshold: ${semanticThreshold}) - ${passed ? 'PASS' : 'SKIP'}`);

                    if (passed) {
                        // Store the thread
                        insertThread({
                            x_tweet_id: tweet.id,
                            x_author_id: tweet.author_id,
                            x_author_username: tweet.author?.username,
                            x_author_name: tweet.author?.name,
                            x_author_followers: tweet.author?.public_metrics?.followers_count || 0,
                            content: tweet.text,
                            reply_count: replyCount,
                            like_count: tweet.public_metrics?.like_count || 0,
                            retweet_count: tweet.public_metrics?.retweet_count || 0,
                            view_count: tweet.public_metrics?.impression_count || 0,
                            thread_url: `https://x.com/${tweet.author?.username || 'i'}/status/${tweet.id}`,
                            keyword_matches: [keyword],
                            semantic_score: score.score,
                            relevance_reasoning: score.reasoning,
                            detected_tone: score.tone,
                            detected_topic: score.topic,
                            x_created_at: tweet.created_at,
                            conversation_id: tweet.conversation_id
                        });

                        results.threadsAdded++;
                        activityLogger.logTweetAdded(tweet, score.score);
                        console.log(`[Discovery] Added thread ${tweet.id} (score: ${score.score}, tone: ${score.tone})`);
                    }
                } catch (scoreError) {
                    console.error(`[Discovery] Failed to score tweet ${tweet.id}:`, scoreError.message);
                    results.errors.push(`Score error for ${tweet.id}: ${scoreError.message}`);
                    activityLogger.logError(`Failed to score tweet ${tweet.id}: ${scoreError.message}`, { tweetId: tweet.id });
                }
            }

            // Delay between keywords to reduce rate limit pressure
            if (keywords.indexOf(keywordRow) < keywords.length - 1) {
                await new Promise(resolve => setTimeout(resolve, KEYWORD_DELAY_MS));
            }
        } catch (keywordError) {
            console.error(`[Discovery] Error searching keyword "${keywordRow.keyword}":`, keywordError.message);
            results.errors.push(`Search error for "${keywordRow.keyword}": ${keywordError.message}`);
            activityLogger.logError(`Error searching keyword "${keywordRow.keyword}": ${keywordError.message}`, { keyword: keywordRow.keyword });

            // Stop on rate limiting - no point hammering a rate-limited API
            if (keywordError.message?.includes('429') || keywordError.code === 429) {
                rateLimited = true;
                const rateLimitMsg = 'Rate limited by X API - stopping discovery cycle';
                results.errors.push(rateLimitMsg);
                activityLogger.logRateLimit(rateLimitMsg);
            }
        }
    }

    console.log(`[Discovery] Complete: ${results.threadsAdded} new threads from ${results.tweetsScored} scored tweets`);

    // End activity logging session
    activityLogger.endDiscoverySession(results);

    return results;
}

/**
 * Auto-skip threads that are too old and haven't been viewed
 * @param {number} hoursOld - Hours after which to skip (default 24)
 * @returns {Promise<number>} Number of threads auto-skipped
 */
export async function autoSkipStaleThreads(hoursOld = 24) {
    const staleThreads = getStaleThreads(hoursOld);
    let skipped = 0;

    for (const thread of staleThreads) {
        updateThreadStatus(thread.id, 'skipped');
        skipped++;
    }

    if (skipped > 0) {
        console.log(`[Discovery] Auto-skipped ${skipped} stale threads (>${hoursOld}h old)`);
    }

    return skipped;
}

/**
 * Run a full discovery cycle (discover + auto-skip stale)
 * @param {string} trigger - 'scheduled' or 'manual'
 * @returns {Promise<object>} Combined results
 */
export async function runDiscoveryCycle(trigger = 'scheduled') {
    const discoveryResults = await discoverThreads(trigger);
    const skippedCount = await autoSkipStaleThreads();

    // Track dry cycles for experimentation trigger
    updateDryCycleCount(discoveryResults.threadsAdded);

    return {
        ...discoveryResults,
        staleSkipped: skippedCount
    };
}

/**
 * Update dry cycle count based on discovery results
 * Increments if no threads found, resets if threads were added
 * @param {number} threadsAdded - Number of threads added in this cycle
 */
function updateDryCycleCount(threadsAdded) {
    if (threadsAdded > 0) {
        // Reset counter when discovery finds content
        setSetting('discovery.dry_cycle_count', 0);
    } else {
        // Increment counter on dry cycle
        const currentCount = getSetting('discovery.dry_cycle_count') || 0;
        setSetting('discovery.dry_cycle_count', currentCount + 1);
    }
}
