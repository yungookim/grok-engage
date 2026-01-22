import {
    getThread,
    updateLearnedPattern,
    getLearnedPatterns,
    addFeedback
} from '../db/db.js';
import { extractThreadFeatures } from './relevance.js';
import { updateKeywordScoresForThread } from './keyword-generator.js';

/**
 * Record a thread view (positive signal for learning)
 * @param {number} threadId - Thread ID
 */
export async function recordThreadView(threadId) {
    const thread = getThread(threadId);
    if (!thread) return;

    const features = extractThreadFeatures(thread);
    await updateThreadPreference(features, 'positive', 'view');

    // Update keyword performance scores
    updateKeywordScoresForThread(threadId, 'view');
}

/**
 * Record a thread skip (negative signal for learning)
 * @param {number} threadId - Thread ID
 */
export async function recordThreadSkip(threadId) {
    const thread = getThread(threadId);
    if (!thread) return;

    const features = extractThreadFeatures(thread);
    await updateThreadPreference(features, 'negative', 'skip');

    // Update keyword performance scores
    updateKeywordScoresForThread(threadId, 'skip');
}

/**
 * Update thread preference patterns based on user action
 */
async function updateThreadPreference(features, signalType, action) {
    // Update tone preference
    if (features.tone) {
        await incrementPatternCounter(
            'thread-preference',
            `tone:${features.tone}`,
            signalType === 'positive' ? 1 : -1
        );
    }

    // Update topic preference
    if (features.topic) {
        await incrementPatternCounter(
            'thread-preference',
            `topic:${features.topic}`,
            signalType === 'positive' ? 1 : -1
        );
    }

    // Update follower bucket preference
    if (features.follower_bucket) {
        await incrementPatternCounter(
            'thread-preference',
            `followers:${features.follower_bucket}`,
            signalType === 'positive' ? 1 : -1
        );
    }

    // Update reply count bucket preference
    if (features.reply_count_bucket) {
        await incrementPatternCounter(
            'thread-preference',
            `replies:${features.reply_count_bucket}`,
            signalType === 'positive' ? 1 : -1
        );
    }

    // Update hour of day preference (if available)
    if (features.hour_of_day !== null) {
        const hourBucket = getHourBucket(features.hour_of_day);
        await incrementPatternCounter(
            'thread-preference',
            `time:${hourBucket}`,
            signalType === 'positive' ? 1 : -1
        );
    }
}

/**
 * Record an edit to a suggested reply (for style learning)
 * @param {string} originalText - Original suggested text
 * @param {string} editedText - User's edited text
 * @returns {object} Edit diff for storage
 */
export function computeReplyEditDiff(originalText, editedText) {
    const original = originalText || '';
    const edited = editedText || '';

    const originalWords = new Set(original.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const editedWords = new Set(edited.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    const wordsAdded = [...editedWords].filter(w => !originalWords.has(w));
    const wordsRemoved = [...originalWords].filter(w => !editedWords.has(w));

    const diff = {
        length_change: edited.length - original.length,
        length_change_pct: original.length > 0 ? (edited.length - original.length) / original.length : 0,
        words_added: wordsAdded.slice(0, 10), // Limit to 10 for storage
        words_removed: wordsRemoved.slice(0, 10),
        added_emoji: hasEmoji(edited) && !hasEmoji(original),
        removed_emoji: hasEmoji(original) && !hasEmoji(edited),
        added_link: hasLink(edited) && !hasLink(original),
        removed_link: hasLink(original) && !hasLink(edited),
        tone_shift: detectToneShift(original, edited)
    };

    return diff;
}

/**
 * Record reply edit for learning
 * @param {object} diff - Edit diff from computeReplyEditDiff
 */
export async function recordReplyEdit(diff) {
    // Track length preference
    if (diff.length_change < -20) {
        await incrementPatternCounter('reply-style', 'prefers_shorter', 1);
    } else if (diff.length_change > 20) {
        await incrementPatternCounter('reply-style', 'prefers_longer', 1);
    }

    // Track emoji preference
    if (diff.removed_emoji) {
        await incrementPatternCounter('reply-style', 'removes_emoji', 1);
    } else if (diff.added_emoji) {
        await incrementPatternCounter('reply-style', 'adds_emoji', 1);
    }

    // Track link preference
    if (diff.removed_link) {
        await incrementPatternCounter('reply-style', 'removes_links', 1);
    } else if (diff.added_link) {
        await incrementPatternCounter('reply-style', 'adds_links', 1);
    }

    // Track common added words
    for (const word of (diff.words_added || []).slice(0, 5)) {
        await incrementPatternCounter('reply-style', `adds_word:${word}`, 1);
    }
}

/**
 * Record outcome data for a posted reply
 * @param {object} reply - Reply data with metrics
 * @param {object} thread - Thread data
 * @param {number} interval - Metrics interval (1, 6, or 24)
 */
export async function recordReplyOutcome(reply, thread, interval) {
    const engagementRate = calculateEngagementRate(reply, interval);

    // Store outcome by reply type
    if (reply.reply_type) {
        await updateOutcomePattern(
            `type:${reply.reply_type}`,
            engagementRate,
            interval
        );
    }

    // Store outcome by thread tone
    if (thread.detected_tone) {
        await updateOutcomePattern(
            `tone:${thread.detected_tone}`,
            engagementRate,
            interval
        );
    }

    // Store outcome by thread topic
    if (thread.detected_topic) {
        await updateOutcomePattern(
            `topic:${thread.detected_topic}`,
            engagementRate,
            interval
        );
    }
}

/**
 * Calculate engagement rate for a reply at a specific interval
 */
function calculateEngagementRate(reply, interval) {
    const suffix = `_${interval}h`;
    const views = reply[`views${suffix}`] || 0;
    const likes = reply[`likes${suffix}`] || 0;
    const replies = reply[`replies${suffix}`] || 0;

    if (views === 0) return 0;
    return (likes + replies) / views;
}

/**
 * Increment a pattern counter (handles both new and existing patterns)
 */
async function incrementPatternCounter(patternType, patternKey, delta) {
    const existing = getLearnedPatterns(patternType)
        .find(p => p.pattern_key === patternKey);

    if (existing) {
        const newValue = (existing.pattern_value.count || 0) + delta;
        const newSampleCount = (existing.sample_count || 0) + 1;
        const newConfidence = Math.min(1, newSampleCount / 20); // Confidence grows with samples

        updateLearnedPattern(
            patternType,
            patternKey,
            { count: newValue, lastDelta: delta },
            newConfidence,
            newSampleCount
        );
    } else {
        updateLearnedPattern(
            patternType,
            patternKey,
            { count: delta, lastDelta: delta },
            0.05, // Low initial confidence
            1
        );
    }
}

/**
 * Update outcome pattern with running average
 */
async function updateOutcomePattern(patternKey, engagementRate, interval) {
    const existing = getLearnedPatterns('outcome')
        .find(p => p.pattern_key === patternKey);

    if (existing) {
        const value = existing.pattern_value;
        const intervalKey = `avg_${interval}h`;
        const countKey = `count_${interval}h`;

        // Running average
        const oldCount = value[countKey] || 0;
        const oldAvg = value[intervalKey] || 0;
        const newCount = oldCount + 1;
        const newAvg = (oldAvg * oldCount + engagementRate) / newCount;

        updateLearnedPattern(
            'outcome',
            patternKey,
            { ...value, [intervalKey]: newAvg, [countKey]: newCount },
            Math.min(1, newCount / 10),
            newCount
        );
    } else {
        updateLearnedPattern(
            'outcome',
            patternKey,
            { [`avg_${interval}h`]: engagementRate, [`count_${interval}h`]: 1 },
            0.1,
            1
        );
    }
}

/**
 * Get hour bucket for timing preferences
 */
function getHourBucket(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

/**
 * Check if text contains emoji
 */
function hasEmoji(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    return emojiRegex.test(text);
}

/**
 * Check if text contains a link
 */
function hasLink(text) {
    return /https?:\/\/\S+/.test(text);
}

/**
 * Detect tone shift between original and edited text
 */
function detectToneShift(original, edited) {
    // Simple heuristics for tone detection
    const exclamationChange = (edited.match(/!/g) || []).length - (original.match(/!/g) || []).length;
    const questionChange = (edited.match(/\?/g) || []).length - (original.match(/\?/g) || []).length;

    if (exclamationChange > 0) return 'more_enthusiastic';
    if (exclamationChange < 0) return 'less_enthusiastic';
    if (questionChange > 0) return 'more_questioning';
    if (questionChange < 0) return 'less_questioning';

    return 'neutral';
}

/**
 * Get insights from learned patterns
 */
export function getLearnedInsights() {
    const threadPrefs = getLearnedPatterns('thread-preference');
    const replyStyle = getLearnedPatterns('reply-style');
    const outcomes = getLearnedPatterns('outcome');

    // Find best performing patterns
    const bestTone = findBestPattern(threadPrefs, 'tone:');
    const bestTopic = findBestPattern(threadPrefs, 'topic:');
    const bestTime = findBestPattern(threadPrefs, 'time:');
    const bestReplyType = findBestOutcome(outcomes, 'type:');

    return {
        threadPreferences: {
            preferredTones: bestTone,
            preferredTopics: bestTopic,
            preferredTimes: bestTime
        },
        replyStyle: replyStyle.map(p => ({
            key: p.pattern_key,
            value: p.pattern_value,
            confidence: p.confidence
        })),
        outcomes: {
            bestReplyType,
            allOutcomes: outcomes.map(p => ({
                key: p.pattern_key,
                value: p.pattern_value,
                confidence: p.confidence
            }))
        }
    };
}

function findBestPattern(patterns, prefix) {
    return patterns
        .filter(p => p.pattern_key.startsWith(prefix))
        .sort((a, b) => (b.pattern_value.count || 0) - (a.pattern_value.count || 0))
        .slice(0, 3)
        .map(p => ({
            name: p.pattern_key.replace(prefix, ''),
            score: p.pattern_value.count || 0,
            confidence: p.confidence
        }));
}

function findBestOutcome(outcomes, prefix) {
    return outcomes
        .filter(p => p.pattern_key.startsWith(prefix))
        .sort((a, b) => (b.pattern_value.avg_24h || 0) - (a.pattern_value.avg_24h || 0))
        .slice(0, 3)
        .map(p => ({
            name: p.pattern_key.replace(prefix, ''),
            avgEngagement24h: p.pattern_value.avg_24h || 0,
            sampleCount: p.pattern_value.count_24h || 0
        }));
}
