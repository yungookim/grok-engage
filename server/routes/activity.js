import { Router } from 'express';
import * as activityLogger from '../services/activity-logger.js';

const router = Router();

/**
 * GET /api/activity/logs
 * Get activity logs
 *
 * Query params:
 * - limit: number (default 100)
 * - offset: number (default 0)
 * - type: string (filter by log type)
 * - sessionId: string (filter by session)
 * - since: ISO timestamp (get logs newer than this)
 */
router.get('/logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const offset = parseInt(req.query.offset, 10) || 0;
        const type = req.query.type || null;
        const sessionId = req.query.sessionId || null;
        const since = req.query.since || null;

        const result = activityLogger.getLogs({ limit, offset, type, sessionId, since });

        res.json(result);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

/**
 * GET /api/activity/scanned
 * Get scanned tweets (including those that didn't pass threshold)
 *
 * Query params:
 * - limit: number (default 50)
 * - offset: number (default 0)
 * - status: string (passed, below_threshold, filtered)
 * - sessionId: string (filter by session)
 */
router.get('/scanned', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;
        const status = req.query.status || null;
        const sessionId = req.query.sessionId || null;

        const result = activityLogger.getScannedTweets({ limit, offset, status, sessionId });

        res.json(result);
    } catch (error) {
        console.error('Error fetching scanned tweets:', error);
        res.status(500).json({ error: 'Failed to fetch scanned tweets' });
    }
});

/**
 * GET /api/activity/stats
 * Get activity statistics
 */
router.get('/stats', (req, res) => {
    try {
        const stats = activityLogger.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        res.status(500).json({ error: 'Failed to fetch activity stats' });
    }
});

/**
 * GET /api/activity/log-types
 * Get available log types for filtering
 */
router.get('/log-types', (req, res) => {
    res.json({
        types: Object.values(activityLogger.LogType)
    });
});

export default router;
