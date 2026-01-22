import { generateReply as llmGenerateReply } from './llm.js';
import * as xApi from './x-api.js';
import {
    getThread,
    getActiveProductProfiles,
    getProductProfile,
    insertReply,
    getReply,
    updateReplyEdit,
    updateReplyAsPosted,
    updateThreadStatus,
    getLearnedPatterns
} from '../db/db.js';
import { computeReplyEditDiff, recordReplyEdit } from './learning.js';

/**
 * Regeneration instruction mappings
 */
const REGEN_INSTRUCTIONS = {
    'funnier': 'Add wit or humor while staying relevant to the conversation',
    'shorter': 'Condense to under 140 characters, keep the core message',
    'technical': 'Use more technical language, assume the reader has expertise',
    'casual': 'Make it more conversational and relaxed, like talking to a friend',
    'no-promo': 'Pure value-add reply, do NOT mention any product at all',
    'with-promo': 'Find a natural way to mention the product that adds value'
};

/**
 * Generate a reply for a thread
 *
 * @param {number} threadId - Thread ID
 * @param {object} options - Generation options
 * @param {string} options.instruction - Custom instruction
 * @param {string} options.regenOption - Predefined regeneration option
 * @param {number} options.productProfileId - Specific product profile to use
 * @returns {Promise<object>} Generated reply data
 */
export async function generateReplyForThread(threadId, options = {}) {
    // Get thread data
    const thread = getThread(threadId);
    if (!thread) {
        throw new Error('Thread not found');
    }

    // Get product profile
    let productProfile;
    if (options.productProfileId) {
        productProfile = getProductProfile(options.productProfileId);
    } else {
        const profiles = getActiveProductProfiles();
        productProfile = profiles[0]; // Use first active profile
    }

    if (!productProfile) {
        throw new Error('No product profile configured. Create a product profile in Settings first.');
    }

    // Get existing replies from the thread for context
    let existingReplies = [];
    if (thread.conversation_id) {
        try {
            existingReplies = await xApi.getThreadReplies(thread.conversation_id, 5);
        } catch (error) {
            console.warn('[ReplyGenerator] Could not fetch thread replies:', error.message);
            // Continue without context - not critical
        }
    }

    // Get learned reply style patterns
    const learnedPatterns = getLearnedPatterns('reply-style');

    // Build instruction
    let instruction = options.instruction || '';
    if (options.regenOption && REGEN_INSTRUCTIONS[options.regenOption]) {
        instruction = REGEN_INSTRUCTIONS[options.regenOption];
    }

    // Generate reply using LLM
    const result = await llmGenerateReply(
        thread,
        productProfile,
        existingReplies,
        learnedPatterns,
        { instruction }
    );

    // Store the generated reply
    const insertResult = insertReply({
        thread_id: threadId,
        product_profile_id: productProfile.id,
        suggested_text: result.reply_text,
        final_text: result.reply_text, // Initially same as suggested
        reply_type: result.reply_type,
        generation_reasoning: result.reasoning
    });

    return {
        id: insertResult.lastInsertRowid,
        thread_id: threadId,
        suggested_text: result.reply_text,
        final_text: result.reply_text,
        reply_type: result.reply_type,
        confidence: result.confidence,
        reasoning: result.reasoning
    };
}

/**
 * Regenerate a reply with different options
 *
 * @param {number} threadId - Thread ID
 * @param {string} regenOption - One of: funnier, shorter, technical, casual, no-promo, with-promo
 * @param {string} customInstruction - Custom instruction (overrides regenOption)
 * @returns {Promise<object>} New generated reply
 */
export async function regenerateReply(threadId, regenOption, customInstruction = null) {
    return generateReplyForThread(threadId, {
        regenOption,
        instruction: customInstruction
    });
}

/**
 * Update a reply with user edits
 *
 * @param {number} replyId - Reply ID
 * @param {string} editedText - User's edited text
 * @returns {Promise<object>} Updated reply data
 */
export async function editReply(replyId, editedText) {
    const reply = getReply(replyId);
    if (!reply) {
        throw new Error('Reply not found');
    }

    // Validate text length
    if (editedText.length > 280) {
        throw new Error('Reply exceeds 280 character limit');
    }

    // Compute edit diff for learning
    const diff = computeReplyEditDiff(reply.suggested_text, editedText);

    // Update reply in database
    updateReplyEdit(replyId, editedText, diff);

    // Record edit for learning system
    await recordReplyEdit(diff);

    return {
        id: replyId,
        suggested_text: reply.suggested_text,
        edited_text: editedText,
        final_text: editedText,
        was_edited: true,
        edit_diff: diff
    };
}

/**
 * Post a reply to X
 *
 * @param {number} replyId - Reply ID
 * @returns {Promise<object>} Posted reply data
 */
export async function postReply(replyId) {
    const reply = getReply(replyId);
    if (!reply) {
        throw new Error('Reply not found');
    }

    if (reply.x_reply_id) {
        throw new Error('Reply has already been posted');
    }

    const thread = getThread(reply.thread_id);
    if (!thread) {
        throw new Error('Thread not found');
    }

    // Post to X
    const result = await xApi.postReply(thread.x_tweet_id, reply.final_text);

    // Update reply with X post ID
    updateReplyAsPosted(replyId, result.id);

    // Update thread status to 'replied'
    updateThreadStatus(reply.thread_id, 'replied');

    return {
        id: replyId,
        x_reply_id: result.id,
        posted_at: new Date().toISOString(),
        final_text: reply.final_text
    };
}

/**
 * Get available regeneration options
 */
export function getRegenOptions() {
    return Object.entries(REGEN_INSTRUCTIONS).map(([key, description]) => ({
        key,
        label: formatRegenLabel(key),
        description
    }));
}

/**
 * Format regeneration option key to display label
 */
function formatRegenLabel(key) {
    const labels = {
        'funnier': 'Make it funnier',
        'shorter': 'Make it shorter',
        'technical': 'More technical',
        'casual': 'More casual',
        'no-promo': 'No product mention',
        'with-promo': 'Mention product'
    };
    return labels[key] || key;
}
