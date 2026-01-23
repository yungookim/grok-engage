/**
 * Activity View Component
 * Displays detailed activity logs and scanned posts
 */

import * as api from '../api.js';
import { createElement, formatTimeAgo, formatFollowers } from '../utils.js';

let appState = null;
let currentTab = 'logs';
let currentFilter = 'all';
let currentOffset = 0;
let lastLogTimestamp = null;
let autoRefreshInterval = null;
const PAGE_SIZE = 50;

/**
 * Initialize the activity view with app state
 */
export function initActivityView(state) {
    appState = state;
}

/**
 * Render the activity view
 */
export async function renderActivityView(container, state) {
    // Clear any existing auto-refresh
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    // Clear container
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Main wrapper
    const wrapper = createElement('div', '', 'max-w-6xl mx-auto');

    // Header
    const header = createElement('div', '', 'flex justify-between items-center mb-6');
    const title = createElement('h2', 'Activity Monitor', 'text-2xl font-bold');
    header.appendChild(title);

    // Stats summary
    const statsContainer = createElement('div', '', 'flex gap-4 text-sm');
    statsContainer.id = 'activity-stats';
    header.appendChild(statsContainer);

    wrapper.appendChild(header);

    // Tabs
    const tabBar = createTabBar();
    wrapper.appendChild(tabBar);

    // Content area
    const contentArea = createElement('div', '', 'mt-4');
    contentArea.id = 'activity-content';
    wrapper.appendChild(contentArea);

    container.appendChild(wrapper);

    // Load initial data
    await loadStats();
    await loadContent();

    // Set up auto-refresh (every 5 seconds)
    autoRefreshInterval = setInterval(async () => {
        await loadStats();
        if (currentTab === 'logs') {
            await refreshLogs();
        }
    }, 5000);
}

/**
 * Create the tab bar
 */
function createTabBar() {
    const bar = createElement('div', '', 'flex gap-2 border-b border-gray-800 pb-2');

    const tabs = [
        { key: 'logs', label: 'Activity Logs' },
        { key: 'scanned', label: 'Scanned Posts' }
    ];

    tabs.forEach(t => {
        const btn = createElement('button', t.label,
            `px-4 py-2 rounded-t text-sm ${currentTab === t.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`
        );
        btn.dataset.tab = t.key;
        btn.addEventListener('click', () => handleTabChange(t.key));
        bar.appendChild(btn);
    });

    return bar;
}

/**
 * Handle tab change
 */
async function handleTabChange(tab) {
    currentTab = tab;
    currentOffset = 0;
    lastLogTimestamp = null;

    // Update tab styles
    document.querySelectorAll('[data-tab]').forEach(btn => {
        const isActive = btn.dataset.tab === currentTab;
        btn.className = `px-4 py-2 rounded-t text-sm ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`;
    });

    await loadContent();
}

/**
 * Load stats
 */
async function loadStats() {
    try {
        const stats = await api.getActivityStats();
        const container = document.getElementById('activity-stats');
        if (!container) return;

        // Clear
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Session indicator
        if (stats.currentSession) {
            const sessionBadge = createElement('span', '', 'flex items-center gap-1 px-2 py-1 bg-blue-900/50 text-blue-300 rounded');
            const spinner = document.createElement('span');
            spinner.className = 'inline-block w-2 h-2 border border-blue-300 border-t-transparent rounded-full animate-spin';
            sessionBadge.appendChild(spinner);
            const sessionText = createElement('span', 'Discovery running', '');
            sessionBadge.appendChild(sessionText);
            container.appendChild(sessionBadge);
        }

        // Last hour stats
        const lastHour = stats.lastHour || {};
        const statItems = [
            { label: 'Scanned (1h)', value: lastHour.scanned || 0 },
            { label: 'Passed', value: lastHour.passed || 0, color: 'text-green-400' },
            { label: 'Below threshold', value: lastHour.belowThreshold || 0, color: 'text-yellow-400' },
            { label: 'Filtered', value: lastHour.filtered || 0, color: 'text-gray-400' }
        ];

        statItems.forEach(item => {
            const stat = createElement('span', `${item.label}: `, 'text-gray-400');
            const value = createElement('span', String(item.value), item.color || '');
            stat.appendChild(value);
            container.appendChild(stat);
        });
    } catch (error) {
        console.error('Failed to load activity stats:', error);
    }
}

/**
 * Load content based on current tab
 */
async function loadContent() {
    const container = document.getElementById('activity-content');
    if (!container) return;

    // Clear
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    if (currentTab === 'logs') {
        await renderLogsTab(container);
    } else {
        await renderScannedTab(container);
    }
}

/**
 * Render the logs tab
 */
async function renderLogsTab(container) {
    // Filter bar
    const filterBar = createElement('div', '', 'flex gap-2 mb-4');

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'discovery_start', label: 'Discovery' },
        { key: 'keyword_search', label: 'Keywords' },
        { key: 'tweet_scored', label: 'Scoring' },
        { key: 'error', label: 'Errors' }
    ];

    filters.forEach(f => {
        const btn = createElement('button', f.label,
            `px-3 py-1 rounded text-xs ${currentFilter === f.key ? 'bg-x-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`
        );
        btn.dataset.logFilter = f.key;
        btn.addEventListener('click', () => handleLogFilterChange(f.key));
        filterBar.appendChild(btn);
    });

    container.appendChild(filterBar);

    // Logs list
    const logsList = createElement('div', '', 'space-y-1 font-mono text-sm');
    logsList.id = 'logs-list';
    container.appendChild(logsList);

    await loadLogs();
}

/**
 * Handle log filter change
 */
async function handleLogFilterChange(filter) {
    currentFilter = filter;
    currentOffset = 0;
    lastLogTimestamp = null;

    // Update filter button styles
    document.querySelectorAll('[data-log-filter]').forEach(btn => {
        const isActive = btn.dataset.logFilter === currentFilter;
        btn.className = `px-3 py-1 rounded text-xs ${isActive ? 'bg-x-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`;
    });

    await loadLogs();
}

/**
 * Load logs
 */
async function loadLogs() {
    const logsList = document.getElementById('logs-list');
    if (!logsList) return;

    try {
        const type = currentFilter === 'all' ? null : currentFilter;
        const result = await api.getActivityLogs({ limit: PAGE_SIZE, offset: currentOffset, type });

        // Clear
        while (logsList.firstChild) {
            logsList.removeChild(logsList.firstChild);
        }

        if (result.logs.length === 0) {
            const emptyMsg = createElement('div', 'No activity logs yet. Run discovery to see logs here.', 'text-gray-500 text-center py-8');
            logsList.appendChild(emptyMsg);
            return;
        }

        // Update last timestamp for incremental refresh
        if (result.logs.length > 0) {
            lastLogTimestamp = result.logs[0].timestamp;
        }

        result.logs.forEach(log => {
            const logEntry = createLogEntry(log);
            logsList.appendChild(logEntry);
        });

        // Pagination
        if (result.total > PAGE_SIZE) {
            const pagination = createPagination(result.total, 'logs');
            logsList.appendChild(pagination);
        }
    } catch (error) {
        console.error('Failed to load logs:', error);
        const errorMsg = createElement('div', 'Failed to load logs: ' + error.message, 'text-red-400 text-center py-4');
        logsList.appendChild(errorMsg);
    }
}

/**
 * Refresh logs (for auto-refresh)
 */
async function refreshLogs() {
    if (!lastLogTimestamp) return;

    try {
        const type = currentFilter === 'all' ? null : currentFilter;
        const result = await api.getActivityLogs({ limit: 50, type, since: lastLogTimestamp });

        if (result.logs.length === 0) return;

        const logsList = document.getElementById('logs-list');
        if (!logsList) return;

        // Update last timestamp
        lastLogTimestamp = result.logs[0].timestamp;

        // Prepend new logs
        result.logs.reverse().forEach(log => {
            const logEntry = createLogEntry(log);
            logEntry.classList.add('animate-pulse');
            logsList.insertBefore(logEntry, logsList.firstChild);

            // Remove pulse animation after a moment
            setTimeout(() => {
                logEntry.classList.remove('animate-pulse');
            }, 2000);
        });
    } catch (error) {
        console.error('Failed to refresh logs:', error);
    }
}

/**
 * Create a log entry element
 */
function createLogEntry(log) {
    const entry = createElement('div', '', 'flex items-start gap-3 py-2 border-b border-gray-800/50 hover:bg-gray-900/30');

    // Timestamp
    const time = createElement('span', formatLogTime(log.timestamp), 'text-gray-500 w-20 flex-shrink-0');
    entry.appendChild(time);

    // Type badge
    const typeBadge = createTypeBadge(log.type);
    entry.appendChild(typeBadge);

    // Message
    const message = createElement('span', log.message, 'flex-1');
    entry.appendChild(message);

    return entry;
}

/**
 * Create type badge
 */
function createTypeBadge(type) {
    const colors = {
        'discovery_start': 'bg-blue-900/50 text-blue-300',
        'discovery_end': 'bg-green-900/50 text-green-300',
        'keyword_search': 'bg-purple-900/50 text-purple-300',
        'tweet_found': 'bg-gray-800 text-gray-400',
        'tweet_filtered': 'bg-gray-800 text-gray-400',
        'tweet_scored': 'bg-yellow-900/50 text-yellow-300',
        'tweet_added': 'bg-green-900/50 text-green-300',
        'tweet_skipped': 'bg-gray-800 text-gray-400',
        'error': 'bg-red-900/50 text-red-300',
        'rate_limit': 'bg-orange-900/50 text-orange-300',
        'info': 'bg-gray-800 text-gray-300'
    };

    const labels = {
        'discovery_start': 'START',
        'discovery_end': 'END',
        'keyword_search': 'KEYWORD',
        'tweet_found': 'FOUND',
        'tweet_filtered': 'FILTERED',
        'tweet_scored': 'SCORED',
        'tweet_added': 'ADDED',
        'tweet_skipped': 'SKIP',
        'error': 'ERROR',
        'rate_limit': 'RATE',
        'info': 'INFO'
    };

    const color = colors[type] || 'bg-gray-800 text-gray-400';
    const label = labels[type] || type.toUpperCase();

    return createElement('span', label, `px-2 py-0.5 rounded text-xs font-medium w-20 text-center ${color}`);
}

/**
 * Render the scanned posts tab
 */
async function renderScannedTab(container) {
    // Filter bar
    const filterBar = createElement('div', '', 'flex gap-2 mb-4');

    const filters = [
        { key: 'all', label: 'All' },
        { key: 'passed', label: 'Passed' },
        { key: 'below_threshold', label: 'Below Threshold' },
        { key: 'filtered', label: 'Filtered' }
    ];

    filters.forEach(f => {
        const btn = createElement('button', f.label,
            `px-3 py-1 rounded text-xs ${currentFilter === f.key ? 'bg-x-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`
        );
        btn.dataset.scannedFilter = f.key;
        btn.addEventListener('click', () => handleScannedFilterChange(f.key));
        filterBar.appendChild(btn);
    });

    container.appendChild(filterBar);

    // Scanned list
    const scannedList = createElement('div', '', 'space-y-3');
    scannedList.id = 'scanned-list';
    container.appendChild(scannedList);

    await loadScanned();
}

/**
 * Handle scanned filter change
 */
async function handleScannedFilterChange(filter) {
    currentFilter = filter;
    currentOffset = 0;

    // Update filter button styles
    document.querySelectorAll('[data-scanned-filter]').forEach(btn => {
        const isActive = btn.dataset.scannedFilter === currentFilter;
        btn.className = `px-3 py-1 rounded text-xs ${isActive ? 'bg-x-blue text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`;
    });

    await loadScanned();
}

/**
 * Load scanned tweets
 */
async function loadScanned() {
    const scannedList = document.getElementById('scanned-list');
    if (!scannedList) return;

    try {
        const status = currentFilter === 'all' ? null : currentFilter;
        const result = await api.getScannedTweets({ limit: PAGE_SIZE, offset: currentOffset, status });

        // Clear
        while (scannedList.firstChild) {
            scannedList.removeChild(scannedList.firstChild);
        }

        if (result.tweets.length === 0) {
            const emptyMsg = createElement('div', 'No scanned posts yet. Run discovery to see scanned posts here.', 'text-gray-500 text-center py-8');
            scannedList.appendChild(emptyMsg);
            return;
        }

        result.tweets.forEach(tweet => {
            const card = createScannedTweetCard(tweet);
            scannedList.appendChild(card);
        });

        // Pagination
        if (result.total > PAGE_SIZE) {
            const pagination = createPagination(result.total, 'scanned');
            scannedList.appendChild(pagination);
        }
    } catch (error) {
        console.error('Failed to load scanned tweets:', error);
        const errorMsg = createElement('div', 'Failed to load scanned posts: ' + error.message, 'text-red-400 text-center py-4');
        scannedList.appendChild(errorMsg);
    }
}

/**
 * Create a scanned tweet card
 */
function createScannedTweetCard(tweet) {
    const card = createElement('div', '', 'bg-gray-900/50 border border-gray-800 rounded-lg p-4');

    // Header row
    const header = createElement('div', '', 'flex justify-between items-start mb-2');

    // Author info
    const authorInfo = createElement('div', '', 'flex items-center gap-2');
    const authorName = createElement('span', tweet.authorName || tweet.authorUsername, 'font-medium');
    authorInfo.appendChild(authorName);
    const authorUsername = createElement('span', `@${tweet.authorUsername}`, 'text-gray-500 text-sm');
    authorInfo.appendChild(authorUsername);
    if (tweet.authorFollowers) {
        const followers = createElement('span', formatFollowers(tweet.authorFollowers) + ' followers', 'text-gray-500 text-xs');
        authorInfo.appendChild(followers);
    }
    header.appendChild(authorInfo);

    // Status badge and score
    const statusInfo = createElement('div', '', 'flex items-center gap-2');

    // Score if available
    if (tweet.score !== undefined) {
        const scoreClass = tweet.score >= tweet.threshold ? 'text-green-400' : 'text-yellow-400';
        const scoreText = createElement('span', `${tweet.score}/${tweet.threshold}`, `font-mono text-sm ${scoreClass}`);
        statusInfo.appendChild(scoreText);
    }

    // Status badge
    const statusColors = {
        'passed': 'bg-green-900/50 text-green-300',
        'below_threshold': 'bg-yellow-900/50 text-yellow-300',
        'filtered': 'bg-gray-800 text-gray-400'
    };
    const statusLabels = {
        'passed': 'Passed',
        'below_threshold': 'Below Threshold',
        'filtered': 'Filtered'
    };
    const statusBadge = createElement('span',
        statusLabels[tweet.status] || tweet.status,
        `px-2 py-0.5 rounded text-xs ${statusColors[tweet.status] || 'bg-gray-800 text-gray-400'}`
    );
    statusInfo.appendChild(statusBadge);

    header.appendChild(statusInfo);
    card.appendChild(header);

    // Content
    const content = createElement('p', tweet.content, 'text-gray-300 mb-3');
    card.appendChild(content);

    // Footer row
    const footer = createElement('div', '', 'flex justify-between items-center text-xs text-gray-500');

    // Metrics
    const metrics = createElement('div', '', 'flex gap-4');
    const replyMetric = createElement('span', `${tweet.replyCount || 0} replies`, '');
    metrics.appendChild(replyMetric);
    const likeMetric = createElement('span', `${tweet.likeCount || 0} likes`, '');
    metrics.appendChild(likeMetric);
    footer.appendChild(metrics);

    // Keyword and time
    const meta = createElement('div', '', 'flex gap-4');
    if (tweet.keyword) {
        const keyword = createElement('span', `Keyword: "${tweet.keyword}"`, 'text-purple-400');
        meta.appendChild(keyword);
    }
    const time = createElement('span', formatTimeAgo(tweet.timestamp), '');
    meta.appendChild(time);

    // Link to tweet
    if (tweet.tweetUrl) {
        const link = createElement('a', 'View on X', 'text-x-blue hover:underline');
        link.href = tweet.tweetUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        meta.appendChild(link);
    }

    footer.appendChild(meta);
    card.appendChild(footer);

    // Reasoning if available
    if (tweet.reasoning) {
        const reasoningSection = createElement('div', '', 'mt-3 pt-3 border-t border-gray-800');
        const reasoningLabel = createElement('span', 'Reasoning: ', 'text-gray-500 text-xs');
        reasoningSection.appendChild(reasoningLabel);
        const reasoningText = createElement('span', tweet.reasoning, 'text-gray-400 text-xs');
        reasoningSection.appendChild(reasoningText);
        card.appendChild(reasoningSection);
    }

    return card;
}

/**
 * Create pagination controls
 */
function createPagination(total, context) {
    const pagination = createElement('div', '', 'flex justify-between items-center mt-6 pt-4 border-t border-gray-800');

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;

    // Previous button
    const prevBtn = createElement('button', 'Previous',
        `px-4 py-2 rounded text-sm ${currentPage > 1 ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`
    );
    if (currentPage > 1) {
        prevBtn.addEventListener('click', async () => {
            currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
            if (context === 'logs') {
                await loadLogs();
            } else {
                await loadScanned();
            }
        });
    }
    pagination.appendChild(prevBtn);

    // Page info
    const pageInfo = createElement('span', `Page ${currentPage} of ${totalPages}`, 'text-gray-400');
    pagination.appendChild(pageInfo);

    // Next button
    const nextBtn = createElement('button', 'Next',
        `px-4 py-2 rounded text-sm ${currentPage < totalPages ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`
    );
    if (currentPage < totalPages) {
        nextBtn.addEventListener('click', async () => {
            currentOffset += PAGE_SIZE;
            if (context === 'logs') {
                await loadLogs();
            } else {
                await loadScanned();
            }
        });
    }
    pagination.appendChild(nextBtn);

    return pagination;
}

/**
 * Format log timestamp
 */
function formatLogTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}
