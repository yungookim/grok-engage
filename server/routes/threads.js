import { Router } from 'express';
import {
    getThreads,
    getThread,
    getThreadCount,
    updateThreadStatus,
    deleteThread
} from '../db/db.js';
import { recordThreadView, recordThreadSkip } from '../services/learning.js';

const router = Router();

/**
 * Middleware to validate thread ID parameter
 */
function validateThreadId(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid thread ID' });
    }
    req.threadId = id;
    next();
}

/**
 * GET /api/threads
 * List threads with optional filtering and pagination
 *
 * Query params:
 * - status: 'new' | 'viewed' | 'replied' | 'skipped'
 * - limit: number (default 20)
 * - offset: number (default 0)
 */
router.get('/', (req, res) => {
    try {
        const { status, limit = 20, offset = 0 } = req.query;

        // Validate status if provided
        const validStatuses = ['new', 'viewed', 'replied', 'skipped'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status filter' });
        }

        // Parse and validate pagination
        const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

        const threads = getThreads({
            status: status || undefined,
            limit: parsedLimit,
            offset: parsedOffset
        });

        const total = getThreadCount(status || undefined);

        res.json({
            threads,
            total,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        console.error('Error fetching threads:', error);
        res.status(500).json({ error: 'Failed to fetch threads' });
    }
});

/**
 * GET /api/threads/:id
 * Get a single thread by ID
 */
router.get('/:id', validateThreadId, (req, res) => {
    try {
        const thread = getThread(req.threadId);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        res.json(thread);
    } catch (error) {
        console.error('Error fetching thread:', error);
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

/**
 * POST /api/threads/:id/view
 * Mark a thread as viewed and record for learning
 */
router.post('/:id/view', validateThreadId, async (req, res) => {
    try {
        const thread = getThread(req.threadId);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Only update if currently 'new'
        if (thread.status === 'new') {
            updateThreadStatus(req.threadId, 'viewed');

            // Record for learning system
            await recordThreadView(req.threadId);
        }

        res.json({ success: true, status: 'viewed' });
    } catch (error) {
        console.error('Error marking thread as viewed:', error);
        res.status(500).json({ error: 'Failed to update thread status' });
    }
});

/**
 * POST /api/threads/:id/skip
 * Mark a thread as skipped and record for learning
 */
router.post('/:id/skip', validateThreadId, async (req, res) => {
    try {
        const thread = getThread(req.threadId);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Can skip from 'new' or 'viewed'
        if (thread.status === 'new' || thread.status === 'viewed') {
            updateThreadStatus(req.threadId, 'skipped');

            // Record for learning system
            await recordThreadSkip(req.threadId);
        }

        res.json({ success: true, status: 'skipped' });
    } catch (error) {
        console.error('Error marking thread as skipped:', error);
        res.status(500).json({ error: 'Failed to update thread status' });
    }
});

/**
 * DELETE /api/threads/:id
 * Remove a thread from the database
 */
router.delete('/:id', validateThreadId, (req, res) => {
    try {
        const thread = getThread(req.threadId);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        deleteThread(req.threadId);

        res.json({ success: true, message: 'Thread deleted' });
    } catch (error) {
        console.error('Error deleting thread:', error);
        res.status(500).json({ error: 'Failed to delete thread' });
    }
});

export default router;
