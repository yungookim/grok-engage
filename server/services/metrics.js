import * as xApi from './x-api.js';
import { getRepliesNeedingMetrics, updateReplyMetrics } from '../db/db.js';

/**
 * Fetch metrics for all replies that need updating
 * Replies are checked at 1h, 6h, and 24h after posting
 *
 * @returns {Promise<number>} Number of replies updated
 */
export async function fetchPendingMetrics() {
    // Get replies that need metrics fetched
    const replies = getRepliesNeedingMetrics();

    if (replies.length === 0) {
        return 0;
    }

    console.log(`[Metrics] Found ${replies.length} replies needing metrics update`);

    let updated = 0;

    for (const reply of replies) {
        try {
            // Fetch current metrics from X
            const metrics = await xApi.getTweetMetrics(reply.x_reply_id);

            // Determine which interval this is
            const interval = getMetricsInterval(reply.metrics_fetch_count);

            // Update in database
            updateReplyMetrics(reply.id, metrics, interval);
            updated++;

            console.log(`[Metrics] Updated reply ${reply.id} (${interval}h): ${metrics.views} views, ${metrics.likes} likes`);
        } catch (error) {
            console.error(`[Metrics] Failed to fetch metrics for reply ${reply.id}:`, error.message);
        }
    }

    return updated;
}

/**
 * Get the interval label based on fetch count
 * 0 fetches -> 1h check
 * 1 fetch -> 6h check
 * 2 fetches -> 24h check
 */
function getMetricsInterval(fetchCount) {
    switch (fetchCount) {
        case 0: return 1;
        case 1: return 6;
        case 2: return 24;
        default: return 24;
    }
}

/**
 * Calculate engagement rate for a reply
 * @param {object} metrics - Metrics object with views, likes, replies
 * @returns {number} Engagement rate (0-1)
 */
export function calculateEngagementRate(metrics) {
    const views = metrics.views || 0;
    if (views === 0) return 0;

    const engagements = (metrics.likes || 0) + (metrics.replies || 0);
    return engagements / views;
}

/**
 * Compare performance between two metric snapshots
 * @param {object} earlier - Earlier metrics (e.g., 1h)
 * @param {object} later - Later metrics (e.g., 24h)
 * @returns {object} Growth metrics
 */
export function compareMetrics(earlier, later) {
    return {
        viewGrowth: (later.views || 0) - (earlier.views || 0),
        likeGrowth: (later.likes || 0) - (earlier.likes || 0),
        replyGrowth: (later.replies || 0) - (earlier.replies || 0),
        engagementRateEarly: calculateEngagementRate(earlier),
        engagementRateLate: calculateEngagementRate(later)
    };
}
