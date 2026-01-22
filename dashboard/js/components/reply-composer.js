/**
 * Reply Composer Component
 * Generates, edits, and posts replies to threads
 * Uses safe DOM construction to prevent XSS
 */

import * as api from '../api.js';
import {
    createElement,
    formatTimeAgo,
    formatFollowers,
    getToneBadgeClasses,
    getScoreColor
} from '../utils.js';
import { createMiniThreadCard } from './thread-card.js';

let currentReply = null;
let regenOptions = [];

/**
 * Render the reply composer for a thread
 * @param {HTMLElement} container - Container element
 * @param {object} thread - Thread data
 * @param {object} state - App state
 */
export async function renderReplyComposer(container, thread, state) {
    // Load regen options if not loaded
    if (regenOptions.length === 0) {
        try {
            const result = await api.getRegenOptions();
            regenOptions = result.regen_options || [];
        } catch (e) {
            console.warn('Failed to load regen options:', e);
        }
    }

    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const wrapper = createElement('div', '', 'max-w-4xl mx-auto');

    // Back button
    const backBtn = createElement('button', 'Back to Feed',
        'text-gray-400 hover:text-white mb-4 flex items-center gap-2'
    );
    backBtn.addEventListener('click', () => {
        window.location.hash = '/';
    });
    wrapper.appendChild(backBtn);

    // Thread card (read-only display)
    const threadSection = createElement('div', '', 'mb-6');
    const threadLabel = createElement('h3', 'Original Thread', 'text-lg font-semibold mb-2');
    threadSection.appendChild(threadLabel);

    const threadCard = createThreadDisplay(thread);
    threadSection.appendChild(threadCard);
    wrapper.appendChild(threadSection);

    // Reply section
    const replySection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');
    replySection.id = 'reply-section';

    const replyHeader = createElement('div', '', 'flex justify-between items-center mb-4');
    const replyLabel = createElement('h3', 'Your Reply', 'text-lg font-semibold');
    replyHeader.appendChild(replyLabel);

    // Character count
    const charCount = createElement('span', '0/280', 'text-gray-500 text-sm');
    charCount.id = 'char-count';
    replyHeader.appendChild(charCount);

    replySection.appendChild(replyHeader);

    // Textarea
    const textarea = document.createElement('textarea');
    textarea.id = 'reply-text';
    textarea.className = 'w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:border-x-blue';
    textarea.rows = 4;
    textarea.placeholder = 'Generate a reply or type your own...';
    textarea.maxLength = 280;
    textarea.addEventListener('input', () => updateCharCount());
    replySection.appendChild(textarea);

    // Reply type indicator
    const typeIndicator = createElement('div', '', 'mt-2 text-sm');
    typeIndicator.id = 'reply-type-indicator';
    replySection.appendChild(typeIndicator);

    // Reasoning (if available)
    const reasoningDiv = createElement('div', '', 'mt-2 text-gray-500 text-sm italic hidden');
    reasoningDiv.id = 'reply-reasoning';
    replySection.appendChild(reasoningDiv);

    // Action buttons
    const actions = createElement('div', '', 'flex flex-wrap gap-3 mt-4');

    // Generate button
    const generateBtn = createElement('button', 'Generate Reply',
        'px-4 py-2 bg-x-blue hover:bg-blue-600 text-white rounded-lg'
    );
    generateBtn.id = 'generate-btn';
    generateBtn.addEventListener('click', () => handleGenerateReply(thread.id));
    actions.appendChild(generateBtn);

    // Regenerate options (hidden until reply is generated)
    const regenContainer = createElement('div', '', 'flex flex-wrap gap-2 hidden');
    regenContainer.id = 'regen-options';

    regenOptions.forEach(opt => {
        const btn = createElement('button', opt.label,
            'px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded'
        );
        btn.title = opt.description;
        btn.addEventListener('click', () => handleRegenerateReply(thread.id, opt.key));
        regenContainer.appendChild(btn);
    });

    actions.appendChild(regenContainer);

    replySection.appendChild(actions);

    // Post button row
    const postRow = createElement('div', '', 'flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800');

    const saveEditBtn = createElement('button', 'Save Edit',
        'px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg hidden'
    );
    saveEditBtn.id = 'save-edit-btn';
    saveEditBtn.addEventListener('click', () => handleSaveEdit());
    postRow.appendChild(saveEditBtn);

    const postBtn = createElement('button', 'Post to X',
        'px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg hidden'
    );
    postBtn.id = 'post-btn';
    postBtn.addEventListener('click', () => handlePostReply());
    postRow.appendChild(postBtn);

    replySection.appendChild(postRow);
    wrapper.appendChild(replySection);

    // Status messages
    const statusDiv = createElement('div', '', 'mt-4 text-center');
    statusDiv.id = 'status-message';
    wrapper.appendChild(statusDiv);

    container.appendChild(wrapper);
}

/**
 * Create the thread display card
 */
function createThreadDisplay(thread) {
    const card = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-4');

    // Header with author
    const header = createElement('div', '', 'flex items-center gap-3 mb-3');

    const authorLink = document.createElement('a');
    authorLink.href = thread.thread_url || '#';
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';
    authorLink.className = 'text-x-blue font-medium hover:underline';
    authorLink.textContent = '@' + (thread.x_author_username || 'unknown');
    header.appendChild(authorLink);

    const followers = createElement('span',
        formatFollowers(thread.x_author_followers) + ' followers',
        'text-gray-500 text-sm'
    );
    header.appendChild(followers);

    if (thread.detected_tone) {
        const toneBadge = createElement('span', thread.detected_tone,
            `text-xs px-2 py-0.5 rounded ${getToneBadgeClasses(thread.detected_tone)}`
        );
        header.appendChild(toneBadge);
    }

    card.appendChild(header);

    // Content
    const content = createElement('p', thread.content, 'text-gray-200 leading-relaxed mb-3');
    card.appendChild(content);

    // Meta
    const meta = createElement('div', '', 'flex gap-4 text-sm text-gray-500');

    const time = createElement('span', formatTimeAgo(thread.x_created_at || thread.first_seen_at), '');
    meta.appendChild(time);

    const engagement = createElement('span', '', '');
    const parts = [];
    if (thread.reply_count) parts.push(`${formatFollowers(thread.reply_count)} replies`);
    if (thread.like_count) parts.push(`${formatFollowers(thread.like_count)} likes`);
    engagement.textContent = parts.join(', ');
    meta.appendChild(engagement);

    if (thread.semantic_score !== null) {
        const score = createElement('span', 'Score: ' + thread.semantic_score,
            getScoreColor(thread.semantic_score)
        );
        meta.appendChild(score);
    }

    card.appendChild(meta);

    return card;
}

/**
 * Update character count display
 */
function updateCharCount() {
    const textarea = document.getElementById('reply-text');
    const charCount = document.getElementById('char-count');
    const saveEditBtn = document.getElementById('save-edit-btn');

    if (textarea && charCount) {
        const len = textarea.value.length;
        charCount.textContent = `${len}/280`;

        if (len > 280) {
            charCount.className = 'text-red-400 text-sm';
        } else if (len > 240) {
            charCount.className = 'text-yellow-400 text-sm';
        } else {
            charCount.className = 'text-gray-500 text-sm';
        }

        // Show save button if text differs from current reply
        if (saveEditBtn && currentReply) {
            const isDifferent = textarea.value !== currentReply.final_text;
            saveEditBtn.classList.toggle('hidden', !isDifferent);
        }
    }
}

/**
 * Handle generate reply button click
 */
async function handleGenerateReply(threadId) {
    const generateBtn = document.getElementById('generate-btn');
    const textarea = document.getElementById('reply-text');
    const statusDiv = document.getElementById('status-message');

    if (generateBtn) {
        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;
    }

    try {
        const reply = await api.generateReply(threadId);
        currentReply = reply;

        if (textarea) {
            textarea.value = reply.suggested_text || reply.final_text || '';
        }

        updateCharCount();
        updateReplyUI(reply);

        if (statusDiv) {
            statusDiv.textContent = '';
        }

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-red-400';
            statusDiv.textContent = 'Failed to generate reply: ' + error.message;
        }
    } finally {
        if (generateBtn) {
            generateBtn.textContent = 'Generate Reply';
            generateBtn.disabled = false;
        }
    }
}

/**
 * Handle regenerate with option
 */
async function handleRegenerateReply(threadId, option) {
    const statusDiv = document.getElementById('status-message');
    const textarea = document.getElementById('reply-text');

    // Find and disable the button
    const buttons = document.querySelectorAll('#regen-options button');
    buttons.forEach(btn => btn.disabled = true);

    if (statusDiv) {
        statusDiv.className = 'mt-4 text-center text-gray-400';
        statusDiv.textContent = 'Regenerating...';
    }

    try {
        const reply = await api.regenerateReply(threadId, option);
        currentReply = reply;

        if (textarea) {
            textarea.value = reply.suggested_text || reply.final_text || '';
        }

        updateCharCount();
        updateReplyUI(reply);

        if (statusDiv) {
            statusDiv.textContent = '';
        }

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-red-400';
            statusDiv.textContent = 'Failed to regenerate: ' + error.message;
        }
    } finally {
        buttons.forEach(btn => btn.disabled = false);
    }
}

/**
 * Handle save edit button click
 */
async function handleSaveEdit() {
    if (!currentReply) return;

    const textarea = document.getElementById('reply-text');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const statusDiv = document.getElementById('status-message');

    const newText = textarea?.value?.trim();
    if (!newText) return;

    if (saveEditBtn) {
        saveEditBtn.textContent = 'Saving...';
        saveEditBtn.disabled = true;
    }

    try {
        const updated = await api.editReply(currentReply.id, newText);
        currentReply = { ...currentReply, ...updated };

        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-green-400';
            statusDiv.textContent = 'Edit saved!';
            setTimeout(() => { statusDiv.textContent = ''; }, 2000);
        }

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-red-400';
            statusDiv.textContent = 'Failed to save edit: ' + error.message;
        }
    } finally {
        if (saveEditBtn) {
            saveEditBtn.textContent = 'Save Edit';
            saveEditBtn.disabled = false;
            saveEditBtn.classList.add('hidden');
        }
    }
}

/**
 * Handle post reply button click
 */
async function handlePostReply() {
    if (!currentReply) return;

    const postBtn = document.getElementById('post-btn');
    const statusDiv = document.getElementById('status-message');

    if (postBtn) {
        postBtn.textContent = 'Posting...';
        postBtn.disabled = true;
    }

    try {
        const result = await api.postReply(currentReply.id);

        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-green-400';
            statusDiv.textContent = 'Posted successfully!';
        }

        // Disable post button permanently after success
        if (postBtn) {
            postBtn.textContent = 'Posted!';
            postBtn.className = 'px-6 py-2 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed';
        }

        // Redirect back to feed after a short delay
        setTimeout(() => {
            window.location.hash = '/';
        }, 2000);

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-4 text-center text-red-400';
            statusDiv.textContent = 'Failed to post: ' + error.message;
        }

        if (postBtn) {
            postBtn.textContent = 'Post to X';
            postBtn.disabled = false;
        }
    }
}

/**
 * Update UI elements after reply is generated/regenerated
 */
function updateReplyUI(reply) {
    const regenContainer = document.getElementById('regen-options');
    const postBtn = document.getElementById('post-btn');
    const typeIndicator = document.getElementById('reply-type-indicator');
    const reasoningDiv = document.getElementById('reply-reasoning');

    // Show regen options
    if (regenContainer) {
        regenContainer.classList.remove('hidden');
    }

    // Show post button
    if (postBtn) {
        postBtn.classList.remove('hidden');
    }

    // Show reply type
    if (typeIndicator && reply.reply_type) {
        typeIndicator.textContent = '';

        const typeLabels = {
            'value-add': 'Value-Add (no product mention)',
            'light-promo': 'Light Promo (natural product mention)',
            'direct': 'Direct (explicit recommendation)'
        };

        const typeColors = {
            'value-add': 'text-green-400',
            'light-promo': 'text-yellow-400',
            'direct': 'text-blue-400'
        };

        const label = createElement('span', 'Type: ', 'text-gray-500');
        const value = createElement('span', typeLabels[reply.reply_type] || reply.reply_type,
            typeColors[reply.reply_type] || 'text-gray-300'
        );

        typeIndicator.appendChild(label);
        typeIndicator.appendChild(value);

        if (reply.confidence) {
            const conf = createElement('span', ` (${reply.confidence}% confidence)`, 'text-gray-500 ml-2');
            typeIndicator.appendChild(conf);
        }
    }

    // Show reasoning
    if (reasoningDiv && reply.reasoning) {
        reasoningDiv.textContent = reply.reasoning;
        reasoningDiv.classList.remove('hidden');
    }
}
