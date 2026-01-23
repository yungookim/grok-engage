/**
 * Thread Card Component
 * Displays a single thread with metadata and actions
 * Uses safe DOM construction to prevent XSS
 */

import {
    createElement,
    escapeHtml,
    formatTimeAgo,
    formatFollowers,
    getToneBadgeClasses,
    getScoreColor,
    getStatusBadgeClasses,
    truncate
} from '../utils.js';

/**
 * Create a thread card element
 * @param {object} thread - Thread data from API
 * @param {object} callbacks - Event callbacks { onView, onSkip, onClick }
 * @returns {HTMLElement} Thread card element
 */
export function createThreadCard(thread, callbacks = {}) {
    const card = createElement('div', '',
        'bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer'
    );

    // Make the card clickable
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons
        if (e.target.tagName === 'BUTTON') return;
        if (callbacks.onClick) callbacks.onClick(thread);
    });

    // Header row: Author info + status badge
    const header = createElement('div', '', 'flex justify-between items-start mb-2');

    // Author info
    const authorSection = createElement('div', '', 'flex items-center gap-2');

    const authorLink = createElement('a', '', 'flex items-center gap-2 hover:underline');
    authorLink.href = thread.thread_url || '#';
    authorLink.target = '_blank';
    authorLink.rel = 'noopener noreferrer';

    const username = createElement('span', '@' + (thread.x_author_username || 'unknown'), 'text-x-blue font-medium');
    authorLink.appendChild(username);

    if (thread.x_author_name) {
        const name = createElement('span', thread.x_author_name, 'text-gray-400 text-sm');
        authorLink.appendChild(name);
    }

    authorSection.appendChild(authorLink);

    // Follower count
    const followers = createElement('span',
        formatFollowers(thread.x_author_followers) + ' followers',
        'text-gray-500 text-xs'
    );
    authorSection.appendChild(followers);

    header.appendChild(authorSection);

    // Status badge
    const statusBadge = createElement('span', thread.status,
        `text-xs px-2 py-1 rounded ${getStatusBadgeClasses(thread.status)}`
    );
    header.appendChild(statusBadge);

    card.appendChild(header);

    // Tweet content
    const content = createElement('p', '', 'text-gray-200 mb-3 leading-relaxed');
    content.textContent = thread.content || '';
    card.appendChild(content);

    // Metadata row: Score, Tone, Topic, Engagement
    const metaRow = createElement('div', '', 'flex flex-wrap gap-3 items-center mb-3 text-sm');

    // Semantic score
    if (thread.semantic_score !== null && thread.semantic_score !== undefined) {
        const scoreContainer = createElement('div', '', 'flex items-center gap-1');
        const scoreLabel = createElement('span', 'Score:', 'text-gray-500');
        const scoreValue = createElement('span', String(thread.semantic_score),
            `font-medium ${getScoreColor(thread.semantic_score)}`
        );
        scoreContainer.appendChild(scoreLabel);
        scoreContainer.appendChild(scoreValue);
        metaRow.appendChild(scoreContainer);
    }

    // Tone badge
    if (thread.detected_tone) {
        const toneBadge = createElement('span', thread.detected_tone,
            `text-xs px-2 py-0.5 rounded ${getToneBadgeClasses(thread.detected_tone)}`
        );
        metaRow.appendChild(toneBadge);
    }

    // Topic
    if (thread.detected_topic) {
        const topicBadge = createElement('span', thread.detected_topic, 'text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300');
        metaRow.appendChild(topicBadge);
    }

    // Engagement
    const engagement = createElement('span', '',  'text-gray-500');
    const parts = [];
    if (thread.reply_count) parts.push(`${formatFollowers(thread.reply_count)} replies`);
    if (thread.like_count) parts.push(`${formatFollowers(thread.like_count)} likes`);
    engagement.textContent = parts.join(', ') || 'No engagement';
    metaRow.appendChild(engagement);

    card.appendChild(metaRow);

    // Relevance reasoning (if available, truncated)
    if (thread.relevance_reasoning) {
        const reasoning = createElement('p', truncate(thread.relevance_reasoning, 150),
            'text-gray-500 text-sm italic mb-3'
        );
        card.appendChild(reasoning);
    }

    // Footer: Time + Actions
    const footer = createElement('div', '', 'flex justify-between items-center');

    // Time
    const time = createElement('span', formatTimeAgo(thread.first_seen_at), 'text-gray-500 text-sm');
    footer.appendChild(time);

    // Actions
    const actions = createElement('div', '', 'flex gap-2');

    // View button (for new threads)
    if (thread.status === 'new' && callbacks.onView) {
        const viewBtn = createElement('button', 'View',
            'px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded text-white'
        );
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onView(thread);
        });
        actions.appendChild(viewBtn);
    }

    // Skip button (for new/viewed threads)
    if ((thread.status === 'new' || thread.status === 'viewed') && callbacks.onSkip) {
        const skipBtn = createElement('button', 'Skip',
            'px-3 py-1 text-sm bg-gray-800 hover:bg-red-900 rounded text-gray-400 hover:text-red-400'
        );
        skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onSkip(thread);
        });
        actions.appendChild(skipBtn);
    }

    // Reply button (for viewed threads)
    if (thread.status === 'viewed' && callbacks.onClick) {
        const replyBtn = createElement('button', 'Reply',
            'px-3 py-1 text-sm bg-x-blue hover:bg-blue-600 rounded text-white'
        );
        replyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onClick(thread);
        });
        actions.appendChild(replyBtn);
    }

    // Open on X button
    if (thread.thread_url) {
        const openBtn = createElement('button', 'Open',
            'px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-400'
        );
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(thread.thread_url, '_blank', 'noopener,noreferrer');
        });
        actions.appendChild(openBtn);
    }

    footer.appendChild(actions);
    card.appendChild(footer);

    return card;
}

/**
 * Create a minimal thread card for display in other contexts
 * @param {object} thread - Thread data
 * @returns {HTMLElement} Minimal card element
 */
export function createMiniThreadCard(thread) {
    const card = createElement('div', '', 'bg-gray-800 rounded p-3');

    // Author
    const author = createElement('div', '', 'flex items-center gap-2 mb-2');
    const username = createElement('span', '@' + (thread.x_author_username || 'unknown'), 'text-x-blue text-sm');
    author.appendChild(username);
    card.appendChild(author);

    // Content preview
    const content = createElement('p', truncate(thread.content, 100), 'text-gray-300 text-sm');
    card.appendChild(content);

    return card;
}
