/**
 * Thread Feed Component
 * Displays paginated list of discovered threads with filtering
 */

import * as api from '../api.js';
import { createElement, formatTimeAgo, formatFollowers, getStatusBadgeClasses } from '../utils.js';
import { createThreadCard } from './thread-card.js';

let appState = null;
let navigateFn = null;
let currentFilter = 'new';
let currentOffset = 0;
const PAGE_SIZE = 20;

/**
 * Initialize the thread feed with app state and navigation
 */
export function initThreadFeed(state, navigate) {
    appState = state;
    navigateFn = navigate;
}

/**
 * Render the thread feed view
 */
export async function renderThreadFeed(container, state) {
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Main wrapper
    const wrapper = createElement('div', '', 'max-w-4xl mx-auto');

    // Header
    const header = createElement('div', '', 'flex justify-between items-center mb-4');

    const title = createElement('h2', 'Thread Feed', 'text-2xl font-bold');
    header.appendChild(title);

    // Right side: status + button
    const headerRight = createElement('div', '', 'flex items-center gap-4');

    // Browser discovery button (no API rate limits)
    const browserDiscoverBtn = createElement('button', 'Browser Discovery', 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm');
    browserDiscoverBtn.id = 'browser-discovery-btn';
    browserDiscoverBtn.title = 'Scrape X via browser - no API rate limits';
    browserDiscoverBtn.addEventListener('click', handleBrowserDiscovery);
    headerRight.appendChild(browserDiscoverBtn);

    // Trigger discovery button (uses X API)
    const discoverBtn = createElement('button', 'API Discovery', 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm');
    discoverBtn.id = 'discovery-btn';
    discoverBtn.title = 'Uses X API - subject to rate limits';
    discoverBtn.addEventListener('click', handleTriggerDiscovery);
    headerRight.appendChild(discoverBtn);

    header.appendChild(headerRight);
    wrapper.appendChild(header);

    // Discovery status bar (last run + activity toggle)
    const statusBar = createElement('div', '', 'flex justify-between items-center mb-4 text-sm');
    statusBar.id = 'discovery-status-bar';
    wrapper.appendChild(statusBar);

    // Activity log (collapsible)
    const activityLog = createElement('div', '', 'hidden mb-4');
    activityLog.id = 'activity-log';
    wrapper.appendChild(activityLog);

    // Discovery errors banner (hidden by default)
    const errorBanner = createElement('div', '', 'hidden mb-4');
    errorBanner.id = 'discovery-errors';
    wrapper.appendChild(errorBanner);

    // Load and display discovery status
    await updateDiscoveryStatusBar();

    // Filter tabs
    const filterBar = createFilterBar();
    wrapper.appendChild(filterBar);

    // Loading indicator
    const loadingDiv = createElement('div', 'Loading threads...', 'text-gray-400 py-8 text-center');
    loadingDiv.id = 'thread-loading';
    wrapper.appendChild(loadingDiv);

    // Thread list container
    const listContainer = createElement('div', '', 'space-y-4');
    listContainer.id = 'thread-list';
    wrapper.appendChild(listContainer);

    // Pagination
    const pagination = createElement('div', '', 'flex justify-between items-center mt-6');
    pagination.id = 'pagination';
    wrapper.appendChild(pagination);

    container.appendChild(wrapper);

    // Check for errors from last scheduled discovery
    await checkLastDiscoveryErrors();

    // Load threads
    await loadThreads();
}

/**
 * Check if last scheduled discovery had errors and display them
 */
async function checkLastDiscoveryErrors() {
    try {
        const status = await api.getStatus();
        const lastDiscovery = status.scheduler?.lastDiscovery;

        if (lastDiscovery?.errors?.length > 0) {
            showDiscoveryErrors(lastDiscovery.errors, lastDiscovery.time);
        }
    } catch (error) {
        console.error('Failed to check discovery status:', error);
    }
}

/**
 * Create the filter bar with status tabs
 */
function createFilterBar() {
    const bar = createElement('div', '', 'flex gap-2 mb-4 border-b border-gray-800 pb-2');

    const filters = [
        { key: 'new', label: 'New' },
        { key: 'viewed', label: 'Viewed' },
        { key: 'replied', label: 'Replied' },
        { key: 'skipped', label: 'Skipped' },
        { key: 'all', label: 'All' }
    ];

    filters.forEach(f => {
        const btn = createElement('button', f.label,
            `px-4 py-2 rounded-t text-sm ${currentFilter === f.key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`
        );
        btn.dataset.filter = f.key;
        btn.addEventListener('click', () => handleFilterChange(f.key));
        bar.appendChild(btn);
    });

    return bar;
}

/**
 * Handle filter change
 */
async function handleFilterChange(filter) {
    currentFilter = filter;
    currentOffset = 0;
    await loadThreads();
}

/**
 * Load and render threads
 */
async function loadThreads() {
    const loadingDiv = document.getElementById('thread-loading');
    const listContainer = document.getElementById('thread-list');
    const pagination = document.getElementById('pagination');

    if (loadingDiv) loadingDiv.style.display = 'block';
    if (listContainer) {
        while (listContainer.firstChild) {
            listContainer.removeChild(listContainer.firstChild);
        }
    }

    try {
        const status = currentFilter === 'all' ? undefined : currentFilter;
        console.log('[ThreadFeed] Loading threads with filter:', status, 'offset:', currentOffset);
        const result = await api.getThreads({
            status,
            limit: PAGE_SIZE,
            offset: currentOffset
        });
        console.log('[ThreadFeed] API returned:', result.threads?.length, 'threads, total:', result.total);

        if (loadingDiv) loadingDiv.style.display = 'none';

        // Render threads
        if (result.threads && result.threads.length > 0) {
            result.threads.forEach(thread => {
                const card = createThreadCard(thread, {
                    onView: handleViewThread,
                    onSkip: handleSkipThread,
                    onClick: handleThreadClick
                });
                listContainer.appendChild(card);
            });
        } else {
            const emptyMsg = createElement('div', `No ${currentFilter === 'all' ? '' : currentFilter + ' '}threads found`, 'text-gray-500 text-center py-8');
            listContainer.appendChild(emptyMsg);
        }

        // Render pagination
        renderPagination(pagination, result.total);

        // Update filter button styles
        document.querySelectorAll('[data-filter]').forEach(btn => {
            const isActive = btn.dataset.filter === currentFilter;
            btn.className = `px-4 py-2 rounded-t text-sm ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`;
        });

    } catch (error) {
        if (loadingDiv) loadingDiv.style.display = 'none';
        const errorMsg = createElement('div', 'Failed to load threads: ' + error.message, 'text-red-400 text-center py-8');
        listContainer.appendChild(errorMsg);
    }
}

/**
 * Render pagination controls
 */
function renderPagination(container, total) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = Math.floor(currentOffset / PAGE_SIZE) + 1;

    // Previous button
    const prevBtn = createElement('button', 'Previous',
        `px-4 py-2 rounded text-sm ${currentPage > 1 ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`
    );
    if (currentPage > 1) {
        prevBtn.addEventListener('click', () => {
            currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
            loadThreads();
        });
    }
    container.appendChild(prevBtn);

    // Page info
    const pageInfo = createElement('span', `Page ${currentPage} of ${totalPages || 1}`, 'text-gray-400');
    container.appendChild(pageInfo);

    // Next button
    const nextBtn = createElement('button', 'Next',
        `px-4 py-2 rounded text-sm ${currentPage < totalPages ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`
    );
    if (currentPage < totalPages) {
        nextBtn.addEventListener('click', () => {
            currentOffset += PAGE_SIZE;
            loadThreads();
        });
    }
    container.appendChild(nextBtn);
}

/**
 * Handle thread card click - navigate to detail view
 */
function handleThreadClick(thread) {
    if (navigateFn) {
        navigateFn(`/thread/${thread.id}`);
    }
}

/**
 * Handle view thread action
 */
async function handleViewThread(thread) {
    try {
        await api.markThreadViewed(thread.id);
        await loadThreads();
    } catch (error) {
        console.error('Failed to mark thread as viewed:', error);
    }
}

/**
 * Handle skip thread action
 */
async function handleSkipThread(thread) {
    try {
        await api.markThreadSkipped(thread.id);
        await loadThreads();
    } catch (error) {
        console.error('Failed to skip thread:', error);
    }
}

/**
 * Handle browser discovery button click
 * Shows instructions for using Claude to scrape X
 */
async function handleBrowserDiscovery() {
    const btn = document.getElementById('browser-discovery-btn');

    if (btn) {
        btn.textContent = 'Ready for Claude';
        btn.classList.remove('bg-green-600', 'hover:bg-green-700');
        btn.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
    }

    // Show instruction modal/banner
    const errorBanner = document.getElementById('discovery-errors');
    if (errorBanner) {
        while (errorBanner.firstChild) {
            errorBanner.removeChild(errorBanner.firstChild);
        }

        const content = createElement('div', '', 'bg-green-900/30 border border-green-700 rounded-lg p-4');

        const header = createElement('div', '', 'flex justify-between items-start mb-2');
        const title = createElement('h4', 'Browser Discovery Ready', 'text-green-400 font-semibold');
        header.appendChild(title);

        const dismissBtn = createElement('button', '\u00d7', 'text-green-400 hover:text-white text-xl leading-none');
        dismissBtn.addEventListener('click', () => {
            errorBanner.className = 'hidden';
            if (btn) {
                btn.textContent = 'Browser Discovery';
                btn.classList.remove('bg-yellow-600', 'hover:bg-yellow-700');
                btn.classList.add('bg-green-600', 'hover:bg-green-700');
            }
        });
        header.appendChild(dismissBtn);
        content.appendChild(header);

        const instructions = createElement('div', '', 'text-green-300 text-sm space-y-2');
        const step1 = createElement('p', 'Ask Claude to run browser discovery. Example:');
        const example = createElement('code', '"Run browser discovery for my keywords"', 'block bg-gray-800 px-3 py-2 rounded mt-1 text-gray-200');
        step1.appendChild(example);
        instructions.appendChild(step1);

        const step2 = createElement('p', 'Claude will scrape X search results and send them to this app for processing.', 'mt-2 text-gray-400');
        instructions.appendChild(step2);

        content.appendChild(instructions);
        errorBanner.appendChild(content);
        errorBanner.className = 'mb-4';
    }
}

/**
 * Handle trigger discovery button click
 */
async function handleTriggerDiscovery() {
    const btn = document.getElementById('discovery-btn') ||
                Array.from(document.querySelectorAll('button'))
                     .find(b => b.textContent.trim() === 'Run Discovery');
    const errorBanner = document.getElementById('discovery-errors');

    // Hide previous errors
    if (errorBanner) {
        errorBanner.className = 'hidden';
    }

    if (btn) {
        btn.textContent = 'Running...';
        btn.disabled = true;
        btn.classList.add('opacity-75');
    }

    // Update status bar to show running state
    await updateDiscoveryStatusBar();

    try {
        const result = await api.triggerDiscovery();

        if (btn) {
            btn.textContent = result.success
                ? `Found ${result.results?.threadsAdded || 0} threads`
                : 'Discovery failed';
        }

        // Show errors if any
        if (result.results?.errors?.length > 0) {
            showDiscoveryErrors(result.results.errors);
        } else if (!result.success && result.message) {
            // Show error message when discovery failed without results object
            showDiscoveryErrors([result.message]);
        }

        // Update status bar with new results
        await updateDiscoveryStatusBar();

        // Reload threads after discovery
        setTimeout(async () => {
            if (btn) {
                btn.textContent = 'Run Discovery';
                btn.disabled = false;
                btn.classList.remove('opacity-75');
            }
            await loadThreads();
        }, 2000);

    } catch (error) {
        if (btn) {
            btn.textContent = 'Run Discovery';
            btn.disabled = false;
            btn.classList.remove('opacity-75');
        }
        showDiscoveryErrors([error.message]);
        // Update status bar to clear running state
        await updateDiscoveryStatusBar();
        // Reload threads to show any that were added before the error
        await loadThreads();
        console.error('Discovery failed:', error);
    }
}

/**
 * Update the discovery status bar with last run info
 */
async function updateDiscoveryStatusBar() {
    const statusBar = document.getElementById('discovery-status-bar');
    if (!statusBar) return;

    // Clear previous content
    while (statusBar.firstChild) {
        statusBar.removeChild(statusBar.firstChild);
    }

    try {
        const status = await api.getStatus();
        const scheduler = status.scheduler;

        // Left side: last run info
        const lastRunInfo = createElement('div', '', 'flex items-center gap-2 text-gray-400');

        if (scheduler?.isDiscoveryActive) {
            // Currently running - spinner
            const spinner = document.createElement('span');
            spinner.className = 'inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin';
            lastRunInfo.appendChild(spinner);
            const runningText = createElement('span', 'Discovery running...', 'text-blue-400');
            lastRunInfo.appendChild(runningText);
        } else if (scheduler?.lastDiscovery) {
            const last = scheduler.lastDiscovery;
            const timeAgo = formatTimeAgo(last.time);
            const hasErrors = last.errors?.length > 0;

            // Status icon
            const statusIcon = createElement('span', hasErrors ? '\u26a0' : '\u2713', hasErrors ? 'text-yellow-500' : 'text-green-500');
            lastRunInfo.appendChild(statusIcon);

            // Last run text
            const runText = createElement('span', `Last run ${timeAgo}`, '');
            lastRunInfo.appendChild(runText);

            // Results summary
            if (last.threadsAdded > 0) {
                const resultText = createElement('span', `\u2022 Found ${last.threadsAdded} thread${last.threadsAdded === 1 ? '' : 's'}`, 'text-green-400');
                lastRunInfo.appendChild(resultText);
            } else if (!hasErrors) {
                const resultText = createElement('span', '\u2022 No new threads', '');
                lastRunInfo.appendChild(resultText);
            }

            if (hasErrors) {
                const errorText = createElement('span', `\u2022 ${last.errors.length} error${last.errors.length === 1 ? '' : 's'}`, 'text-yellow-400');
                lastRunInfo.appendChild(errorText);
            }
        } else {
            const noRunText = createElement('span', 'No discovery runs yet', '');
            lastRunInfo.appendChild(noRunText);
        }

        statusBar.appendChild(lastRunInfo);

        // Right side: activity log toggle
        const activityToggle = createElement('button', '', 'flex items-center gap-1 text-gray-400 hover:text-white transition-colors');

        const activityLabel = createElement('span', 'Activity', '');
        activityToggle.appendChild(activityLabel);

        // Create SVG chevron using DOM methods
        const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        chevron.setAttribute('class', 'w-4 h-4 transition-transform');
        chevron.setAttribute('id', 'activity-chevron');
        chevron.setAttribute('fill', 'none');
        chevron.setAttribute('stroke', 'currentColor');
        chevron.setAttribute('viewBox', '0 0 24 24');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('d', 'M19 9l-7 7-7-7');
        chevron.appendChild(path);
        activityToggle.appendChild(chevron);

        activityToggle.addEventListener('click', () => toggleActivityLog(scheduler?.history || []));
        statusBar.appendChild(activityToggle);

    } catch (error) {
        console.error('Failed to update discovery status:', error);
        const errorText = createElement('span', 'Could not load status', 'text-gray-500');
        statusBar.appendChild(errorText);
    }
}

/**
 * Toggle the activity log visibility and populate it
 */
function toggleActivityLog(history) {
    const activityLog = document.getElementById('activity-log');
    const chevron = document.getElementById('activity-chevron');
    if (!activityLog) return;

    const isHidden = activityLog.classList.contains('hidden');

    if (isHidden) {
        // Show and populate
        activityLog.classList.remove('hidden');
        chevron?.classList.add('rotate-180');
        renderActivityLog(history);
    } else {
        // Hide
        activityLog.classList.add('hidden');
        chevron?.classList.remove('rotate-180');
    }
}

/**
 * Render the activity log content
 */
function renderActivityLog(history) {
    const activityLog = document.getElementById('activity-log');
    if (!activityLog) return;

    // Clear previous content
    while (activityLog.firstChild) {
        activityLog.removeChild(activityLog.firstChild);
    }

    const container = createElement('div', '', 'bg-gray-900/50 border border-gray-800 rounded-lg p-4');

    // Header
    const header = createElement('div', '', 'flex justify-between items-center mb-3');
    const title = createElement('h4', 'Recent Discovery Activity', 'text-sm font-medium text-gray-300');
    header.appendChild(title);
    container.appendChild(header);

    if (!history || history.length === 0) {
        const emptyMsg = createElement('p', 'No activity recorded yet', 'text-gray-500 text-sm');
        container.appendChild(emptyMsg);
    } else {
        // Activity list
        const list = createElement('div', '', 'space-y-2 max-h-64 overflow-y-auto');

        history.slice(0, 10).forEach(entry => {
            const item = createElement('div', '', 'flex items-start gap-3 text-sm py-2 border-b border-gray-800 last:border-0');

            // Timestamp
            const time = createElement('span', formatTimeAgo(entry.time), 'text-gray-500 w-20 flex-shrink-0');
            item.appendChild(time);

            // Trigger badge
            const triggerClass = entry.trigger === 'manual' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-800 text-gray-400';
            const trigger = createElement('span', entry.trigger === 'manual' ? 'Manual' : 'Auto', `px-2 py-0.5 rounded text-xs ${triggerClass}`);
            item.appendChild(trigger);

            // Result
            const hasErrors = entry.errors?.length > 0;
            const resultContainer = createElement('div', '', 'flex-1');

            if (entry.threadsAdded > 0) {
                const resultText = createElement('span', `Found ${entry.threadsAdded} thread${entry.threadsAdded === 1 ? '' : 's'}`, 'text-green-400');
                resultContainer.appendChild(resultText);
            } else if (hasErrors) {
                const errorText = createElement('span', `Failed: ${entry.errors[0]}`, 'text-red-400');
                resultContainer.appendChild(errorText);
            } else {
                const noResultText = createElement('span', 'No new threads', 'text-gray-400');
                resultContainer.appendChild(noResultText);
            }

            // Additional stats if available
            if (entry.keywordsSearched) {
                const statsText = createElement('div', `${entry.keywordsSearched} keywords searched, ${entry.tweetsFound || 0} tweets found`, 'text-gray-500 text-xs mt-0.5');
                resultContainer.appendChild(statsText);
            }

            item.appendChild(resultContainer);
            list.appendChild(item);
        });

        container.appendChild(list);
    }

    activityLog.appendChild(container);
}

/**
 * Display discovery errors in the UI
 * @param {string[]} errors - Array of error messages
 * @param {string} [timestamp] - ISO timestamp of when errors occurred
 */
function showDiscoveryErrors(errors, timestamp) {
    const banner = document.getElementById('discovery-errors');
    if (!banner) return;

    // Clear previous content
    while (banner.firstChild) {
        banner.removeChild(banner.firstChild);
    }

    // Categorize errors
    const rateLimitErrors = errors.filter(e => e.includes('429') || e.includes('Rate limit'));
    const otherErrors = errors.filter(e => !e.includes('429') && !e.includes('Rate limit'));

    // Build error content
    const content = createElement('div', '', 'bg-red-900/30 border border-red-700 rounded-lg p-4');

    // Header with dismiss button
    const header = createElement('div', '', 'flex justify-between items-start mb-2');
    const titleText = timestamp
        ? `Discovery Errors (${formatTimeAgo(timestamp)})`
        : 'Discovery Errors';
    const title = createElement('h4', titleText, 'text-red-400 font-semibold');
    header.appendChild(title);

    const dismissBtn = createElement('button', '\u00d7', 'text-red-400 hover:text-white text-xl leading-none');
    dismissBtn.addEventListener('click', () => {
        banner.className = 'hidden';
    });
    header.appendChild(dismissBtn);
    content.appendChild(header);

    // Rate limit warning (special treatment)
    if (rateLimitErrors.length > 0) {
        const rateLimitMsg = createElement('div', '', 'bg-yellow-900/30 border border-yellow-700 rounded p-2 mb-2 text-sm');
        const rateLimitLabel = createElement('span', 'Rate Limited: ', 'text-yellow-400 font-medium');
        const rateLimitText = createElement('span', 'X API rate limit reached. Try again in 15 minutes or reduce keyword count.', 'text-yellow-300');
        rateLimitMsg.appendChild(rateLimitLabel);
        rateLimitMsg.appendChild(rateLimitText);
        content.appendChild(rateLimitMsg);
    }

    // Other errors list
    if (otherErrors.length > 0) {
        const errorList = createElement('ul', '', 'text-red-300 text-sm space-y-1 list-disc list-inside');
        otherErrors.slice(0, 5).forEach(err => {
            const li = createElement('li', err);
            errorList.appendChild(li);
        });
        if (otherErrors.length > 5) {
            const more = createElement('li', `... and ${otherErrors.length - 5} more errors`, 'text-red-400');
            errorList.appendChild(more);
        }
        content.appendChild(errorList);
    }

    banner.appendChild(content);
    banner.className = 'mb-4';
}
