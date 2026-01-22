import { Router } from 'express';
import { getAnalyticsSummary, getLearnedPatterns } from '../db/db.js';
import { getLearnedInsights } from '../services/learning.js';
import { getUsageStats } from '../services/x-api.js';

const router = Router();

/**
 * GET /api/analytics/summary
 * Get overall analytics summary (threads, replies, API usage)
 */
router.get('/summary', (req, res) => {
    try {
        const summary = getAnalyticsSummary();
        res.json(summary);
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

/**
 * GET /api/analytics/insights
 * Get learned insights from the learning system
 */
router.get('/insights', (req, res) => {
    try {
        const insights = getLearnedInsights();
        res.json(insights);
    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

/**
 * GET /api/analytics/patterns
 * Get raw learned patterns with optional type filter
 *
 * Query params:
 * - type: 'thread-preference' | 'reply-style' | 'outcome'
 */
router.get('/patterns', (req, res) => {
    try {
        const { type } = req.query;

        // Validate type if provided
        const validTypes = ['thread-preference', 'reply-style', 'outcome'];
        if (type && !validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Invalid pattern type',
                valid_types: validTypes
            });
        }

        const patterns = type
            ? getLearnedPatterns(type)
            : [
                ...getLearnedPatterns('thread-preference'),
                ...getLearnedPatterns('reply-style'),
                ...getLearnedPatterns('outcome')
            ];

        res.json({ patterns });
    } catch (error) {
        console.error('Error fetching patterns:', error);
        res.status(500).json({ error: 'Failed to fetch patterns' });
    }
});

/**
 * GET /api/analytics/api-usage
 * Get detailed API usage statistics
 */
router.get('/api-usage', (req, res) => {
    try {
        const usage = getUsageStats();
        res.json(usage);
    } catch (error) {
        console.error('Error fetching API usage:', error);
        res.status(500).json({ error: 'Failed to fetch API usage' });
    }
});

/**
 * GET /api/analytics/outcomes
 * Get reply outcome performance data
 */
router.get('/outcomes', (req, res) => {
    try {
        const outcomePatterns = getLearnedPatterns('outcome');

        // Group by category (type, tone, topic)
        const outcomes = {
            byReplyType: [],
            byTone: [],
            byTopic: []
        };

        for (const pattern of outcomePatterns) {
            const entry = {
                key: pattern.pattern_key,
                name: pattern.pattern_key.split(':')[1] || pattern.pattern_key,
                engagement1h: pattern.pattern_value.avg_1h || null,
                engagement6h: pattern.pattern_value.avg_6h || null,
                engagement24h: pattern.pattern_value.avg_24h || null,
                sampleCount: pattern.pattern_value.count_24h || pattern.sample_count || 0,
                confidence: pattern.confidence
            };

            if (pattern.pattern_key.startsWith('type:')) {
                outcomes.byReplyType.push(entry);
            } else if (pattern.pattern_key.startsWith('tone:')) {
                outcomes.byTone.push(entry);
            } else if (pattern.pattern_key.startsWith('topic:')) {
                outcomes.byTopic.push(entry);
            }
        }

        // Sort each by 24h engagement (descending)
        const sortByEngagement = (a, b) => (b.engagement24h || 0) - (a.engagement24h || 0);
        outcomes.byReplyType.sort(sortByEngagement);
        outcomes.byTone.sort(sortByEngagement);
        outcomes.byTopic.sort(sortByEngagement);

        res.json(outcomes);
    } catch (error) {
        console.error('Error fetching outcomes:', error);
        res.status(500).json({ error: 'Failed to fetch outcomes' });
    }
});

export default router;
