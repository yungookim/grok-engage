import { scoreRelevance as llmScoreRelevance } from './llm.js';
import { getActiveProductProfiles, getLearnedPatterns } from '../db/db.js';

/**
 * Score a tweet's relevance for engagement
 * Combines product profiles, learned preferences, and LLM analysis
 *
 * @param {object} tweet - Tweet data from X API
 * @returns {Promise<object>} Score result { score, tone, topic, reasoning }
 */
export async function scoreThread(tweet) {
    // Get product profiles for context
    const productProfiles = getActiveProductProfiles();

    if (productProfiles.length === 0) {
        // No product profiles configured - use basic scoring
        return basicScore(tweet);
    }

    // Get learned thread preferences
    const learnedPreferences = getLearnedPatterns('thread-preference');

    // Use LLM for comprehensive scoring
    try {
        const result = await llmScoreRelevance(tweet, productProfiles, learnedPreferences);

        // Validate and normalize the response
        return normalizeScoreResult(result);
    } catch (error) {
        console.error('[Relevance] LLM scoring failed, using basic score:', error.message);
        return basicScore(tweet);
    }
}

/**
 * Basic scoring without LLM (fallback)
 * Uses heuristics based on engagement and content
 *
 * @param {object} tweet - Tweet data
 * @returns {object} Basic score result
 */
function basicScore(tweet) {
    let score = 50; // Base score

    // Engagement boost
    const replies = tweet.public_metrics?.reply_count || 0;
    const likes = tweet.public_metrics?.like_count || 0;

    if (replies >= 50) score += 15;
    else if (replies >= 25) score += 10;
    else if (replies >= 15) score += 5;

    if (likes >= 100) score += 10;
    else if (likes >= 50) score += 5;

    // Question detection (more likely to need help)
    if (tweet.text.includes('?')) {
        score += 10;
    }

    // Tool/recommendation request signals
    const toolKeywords = ['recommend', 'suggestion', 'looking for', 'anyone know', 'best tool', 'alternative'];
    const lowerText = tweet.text.toLowerCase();
    if (toolKeywords.some(kw => lowerText.includes(kw))) {
        score += 15;
    }

    // Detect tone heuristically
    const tone = detectToneBasic(tweet.text);

    // Detect topic heuristically
    const topic = detectTopicBasic(tweet.text);

    return {
        score: Math.min(100, Math.max(0, score)),
        tone,
        topic,
        reasoning: 'Basic heuristic scoring (LLM not available or no product profiles)'
    };
}

/**
 * Simple tone detection based on text patterns
 */
function detectToneBasic(text) {
    const lowerText = text.toLowerCase();

    if (text.includes('?')) return 'question';
    if (lowerText.includes('frustrated') || lowerText.includes('annoyed') ||
        lowerText.includes('hate') || lowerText.includes('ugh')) return 'rant';
    if (lowerText.includes('code') || lowerText.includes('api') ||
        lowerText.includes('implementation') || lowerText.includes('bug')) return 'technical';
    if (lowerText.includes('!') && lowerText.length < 100) return 'casual';

    return 'casual';
}

/**
 * Simple topic detection based on text patterns
 */
function detectTopicBasic(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('recommend') || lowerText.includes('looking for') ||
        lowerText.includes('best tool') || lowerText.includes('alternative')) return 'tool-search';
    if (lowerText.includes('feature') || lowerText.includes('wish') ||
        lowerText.includes('should have')) return 'feature-request';
    if (lowerText.includes('how do') || lowerText.includes('how to') ||
        lowerText.includes('tutorial')) return 'how-to';
    if (lowerText.includes('frustrated') || lowerText.includes('annoyed') ||
        lowerText.includes('broken') || lowerText.includes('doesn\'t work')) return 'venting';

    return 'discussion';
}

/**
 * Normalize and validate LLM score result
 */
function normalizeScoreResult(result) {
    const validTones = ['casual', 'serious', 'technical', 'rant', 'question'];
    const validTopics = ['tool-search', 'feature-request', 'venting', 'how-to', 'discussion', 'building-in-public', 'announcement'];

    return {
        score: Math.min(100, Math.max(0, parseInt(result.score, 10) || 50)),
        tone: validTones.includes(result.tone) ? result.tone : 'casual',
        topic: validTopics.includes(result.topic) ? result.topic : 'discussion',
        reasoning: result.reasoning || 'No reasoning provided'
    };
}

/**
 * Extract features from a thread for learning purposes
 * @param {object} thread - Thread data from database
 * @returns {object} Feature vector for learning
 */
export function extractThreadFeatures(thread) {
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

        // Timing features (if x_created_at is available)
        hour_of_day: thread.x_created_at ? new Date(thread.x_created_at).getHours() : null,
        day_of_week: thread.x_created_at ? new Date(thread.x_created_at).getDay() : null,

        // Score features
        semantic_score: thread.semantic_score,

        // Keywords
        keyword_matches: thread.keyword_matches || []
    };
}

/**
 * Bucket follower counts for pattern learning
 */
function bucketFollowers(count) {
    if (!count || count < 1000) return 'micro';
    if (count < 10000) return 'small';
    if (count < 50000) return 'medium';
    if (count < 200000) return 'large';
    return 'mega';
}

/**
 * Bucket content length for pattern learning
 */
function bucketLength(length) {
    if (length < 50) return 'very-short';
    if (length < 140) return 'short';
    if (length < 200) return 'medium';
    return 'long';
}

/**
 * Bucket reply counts for pattern learning
 */
function bucketReplies(count) {
    if (!count || count < 10) return 'low';
    if (count < 25) return 'moderate';
    if (count < 50) return 'high';
    return 'viral';
}
