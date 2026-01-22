import { Router } from 'express';
import {
    getReplies,
    getReply
} from '../db/db.js';
import {
    generateReplyForThread,
    regenerateReply,
    editReply,
    postReply,
    getRegenOptions
} from '../services/reply-generator.js';

const router = Router();

/**
 * Middleware to validate reply ID parameter
 */
function validateReplyId(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
        return res.status(400).json({ error: 'Invalid reply ID' });
    }
    req.replyId = id;
    next();
}

/**
 * POST /api/replies/generate
 * Generate a new reply for a thread
 *
 * Body:
 * - thread_id: number (required)
 * - product_profile_id: number (optional)
 * - instruction: string (optional)
 */
router.post('/generate', async (req, res) => {
    try {
        const { thread_id, product_profile_id, instruction } = req.body;

        // Validate thread_id
        if (!thread_id || typeof thread_id !== 'number') {
            return res.status(400).json({ error: 'thread_id is required and must be a number' });
        }

        const reply = await generateReplyForThread(thread_id, {
            productProfileId: product_profile_id,
            instruction
        });

        res.json(reply);
    } catch (error) {
        console.error('Error generating reply:', error);

        if (error.message.includes('not found') || error.message.includes('not configured')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to generate reply' });
    }
});

/**
 * POST /api/replies/regenerate
 * Regenerate a reply with different options
 *
 * Body:
 * - thread_id: number (required)
 * - regen_option: string (optional) - one of: funnier, shorter, technical, casual, no-promo, with-promo
 * - instruction: string (optional) - custom instruction
 */
router.post('/regenerate', async (req, res) => {
    try {
        const { thread_id, regen_option, instruction } = req.body;

        // Validate thread_id
        if (!thread_id || typeof thread_id !== 'number') {
            return res.status(400).json({ error: 'thread_id is required and must be a number' });
        }

        // Validate regen_option if provided
        const validOptions = ['funnier', 'shorter', 'technical', 'casual', 'no-promo', 'with-promo'];
        if (regen_option && !validOptions.includes(regen_option)) {
            return res.status(400).json({
                error: 'Invalid regen_option',
                valid_options: validOptions
            });
        }

        const reply = await regenerateReply(thread_id, regen_option, instruction);

        res.json(reply);
    } catch (error) {
        console.error('Error regenerating reply:', error);

        if (error.message.includes('not found')) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to regenerate reply' });
    }
});

/**
 * POST /api/replies/:id/edit
 * Update a reply with user edits
 *
 * Body:
 * - text: string (required) - edited reply text
 */
router.post('/:id/edit', validateReplyId, async (req, res) => {
    try {
        const { text } = req.body;

        // Validate text
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'text is required and must be a string' });
        }

        if (text.length > 280) {
            return res.status(400).json({ error: 'Reply exceeds 280 character limit' });
        }

        const reply = await editReply(req.replyId, text.trim());

        res.json(reply);
    } catch (error) {
        console.error('Error editing reply:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to edit reply' });
    }
});

/**
 * POST /api/replies/:id/post
 * Post a reply to X
 */
router.post('/:id/post', validateReplyId, async (req, res) => {
    try {
        const result = await postReply(req.replyId);

        res.json(result);
    } catch (error) {
        console.error('Error posting reply:', error);

        if (error.message.includes('not found')) {
            return res.status(404).json({ error: error.message });
        }

        if (error.message.includes('already been posted')) {
            return res.status(400).json({ error: error.message });
        }

        if (error.message.includes('limit')) {
            return res.status(429).json({ error: error.message });
        }

        res.status(500).json({ error: 'Failed to post reply' });
    }
});

/**
 * GET /api/replies
 * List replies with optional filtering
 *
 * Query params:
 * - thread_id: number (optional) - filter by thread
 * - posted: boolean (optional) - filter by posted status
 * - limit: number (default 20)
 * - offset: number (default 0)
 */
router.get('/', (req, res) => {
    try {
        const { thread_id, posted, limit = 20, offset = 0 } = req.query;

        const parsedLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
        const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

        const options = {
            limit: parsedLimit,
            offset: parsedOffset
        };

        if (thread_id) {
            const parsedThreadId = parseInt(thread_id, 10);
            if (isNaN(parsedThreadId)) {
                return res.status(400).json({ error: 'Invalid thread_id' });
            }
            options.threadId = parsedThreadId;
        }

        if (posted !== undefined) {
            options.posted = posted === 'true';
        }

        const replies = getReplies(options);

        res.json({
            replies,
            limit: parsedLimit,
            offset: parsedOffset
        });
    } catch (error) {
        console.error('Error fetching replies:', error);
        res.status(500).json({ error: 'Failed to fetch replies' });
    }
});

/**
 * GET /api/replies/options
 * Get available regeneration options
 */
router.get('/options', (req, res) => {
    res.json({
        regen_options: getRegenOptions()
    });
});

/**
 * GET /api/replies/:id
 * Get a single reply by ID
 */
router.get('/:id', validateReplyId, (req, res) => {
    try {
        const reply = getReply(req.replyId);

        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        res.json(reply);
    } catch (error) {
        console.error('Error fetching reply:', error);
        res.status(500).json({ error: 'Failed to fetch reply' });
    }
});

export default router;
