/**
 * Dashboard Utility Functions
 * Helpers for safe DOM manipulation and formatting
 */

/**
 * Escape HTML characters to prevent XSS
 * @param {string} str - Input string
 * @returns {string} Escaped string safe for HTML display
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Format follower count with K/M suffix
 * @param {number} count - Follower count
 * @returns {string} Formatted count (e.g., "12.5K", "1.2M")
 */
export function formatFollowers(count) {
    if (count === null || count === undefined) return '0';
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
        return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return String(count);
}

/**
 * Format a date as relative time (e.g., "2h ago", "3d ago")
 * @param {string|Date} date - ISO date string or Date object
 * @returns {string} Relative time string
 */
export function formatTimeAgo(date) {
    if (!date) return '';

    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    // For older dates, show the date
    return then.toLocaleDateString();
}

/**
 * Get Tailwind color class for detected tone
 * @param {string} tone - Tone value ('casual', 'serious', 'technical', 'rant', 'question')
 * @returns {string} Tailwind text color class
 */
export function getToneColor(tone) {
    const colors = {
        'casual': 'text-green-400',
        'serious': 'text-blue-400',
        'technical': 'text-purple-400',
        'rant': 'text-red-400',
        'question': 'text-yellow-400'
    };
    return colors[tone] || 'text-gray-400';
}

/**
 * Get Tailwind background color class for detected tone (for badges)
 * @param {string} tone - Tone value
 * @returns {string} Tailwind background/text color classes
 */
export function getToneBadgeClasses(tone) {
    const classes = {
        'casual': 'bg-green-900 text-green-200',
        'serious': 'bg-blue-900 text-blue-200',
        'technical': 'bg-purple-900 text-purple-200',
        'rant': 'bg-red-900 text-red-200',
        'question': 'bg-yellow-900 text-yellow-200'
    };
    return classes[tone] || 'bg-gray-700 text-gray-200';
}

/**
 * Get color class for semantic score
 * @param {number} score - Score from 0-100
 * @returns {string} Tailwind text color class
 */
export function getScoreColor(score) {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
}

/**
 * Create an element with safe text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content (will be safely set)
 * @param {string} className - CSS classes
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, text = '', className = '') {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Debounce a function call
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Format engagement numbers
 * @param {object} metrics - Object with reply_count, like_count, etc.
 * @returns {string} Formatted string like "25 replies, 120 likes"
 */
export function formatEngagement(metrics) {
    const parts = [];
    if (metrics.reply_count) {
        parts.push(`${formatFollowers(metrics.reply_count)} replies`);
    }
    if (metrics.like_count) {
        parts.push(`${formatFollowers(metrics.like_count)} likes`);
    }
    return parts.join(', ') || 'No engagement';
}

/**
 * Get status badge classes
 * @param {string} status - Thread status
 * @returns {string} Tailwind classes for badge
 */
export function getStatusBadgeClasses(status) {
    const classes = {
        'new': 'bg-blue-900 text-blue-200',
        'viewed': 'bg-gray-700 text-gray-300',
        'replied': 'bg-green-900 text-green-200',
        'skipped': 'bg-gray-800 text-gray-400'
    };
    return classes[status] || 'bg-gray-700 text-gray-300';
}
