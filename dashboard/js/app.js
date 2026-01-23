/**
 * Main Application Module
 * Hash-based router and state management for the SPA dashboard
 */

import * as api from './api.js';
import { renderThreadFeed, initThreadFeed } from './components/thread-feed.js';
import { renderAnalyticsView, initAnalyticsView } from './components/analytics-view.js';
import { renderSettingsView, initSettingsView } from './components/settings-view.js';
import { renderKeywordsView, initKeywordsView } from './components/keywords-view.js';
import { renderActivityView, initActivityView } from './components/activity-view.js';
import { showSetupWizard, shouldShowSetupWizard } from './components/setup-wizard.js';
import { updateWarningBanner } from './components/warning-banner.js';

// ============================================
// Application State
// ============================================

const state = {
    currentView: 'feed',
    threads: [],
    threadCount: { new: 0, viewed: 0, replied: 0, skipped: 0 },
    selectedThread: null,
    currentReply: null,
    settings: {},
    isLoading: false,
    error: null
};

// ============================================
// Router
// ============================================

const routes = {
    '/': 'feed',
    '/keywords': 'keywords',
    '/activity': 'activity',
    '/analytics': 'analytics',
    '/settings': 'settings',
    '/thread/:id': 'thread-detail'
};

function parseRoute(hash) {
    const path = hash.replace('#', '') || '/';

    // Check for parameterized routes
    const threadMatch = path.match(/^\/thread\/(\d+)$/);
    if (threadMatch) {
        return { view: 'thread-detail', params: { id: parseInt(threadMatch[1], 10) } };
    }

    const view = routes[path];
    return { view: view || 'feed', params: {} };
}

function navigate(path) {
    window.location.hash = path;
}

async function handleRouteChange() {
    const { view, params } = parseRoute(window.location.hash);
    state.currentView = view;

    // Update nav link highlighting
    updateNavLinks(view);

    // Render the appropriate view
    const appContainer = document.getElementById('app');

    switch (view) {
        case 'feed':
            await renderThreadFeed(appContainer, state);
            break;
        case 'keywords':
            await renderKeywordsView(appContainer, state);
            break;
        case 'activity':
            await renderActivityView(appContainer, state);
            break;
        case 'analytics':
            await renderAnalyticsView(appContainer, state);
            break;
        case 'settings':
            await renderSettingsView(appContainer, state);
            break;
        case 'thread-detail':
            await renderThreadDetail(appContainer, params.id);
            break;
        default:
            await renderThreadFeed(appContainer, state);
    }
}

function updateNavLinks(currentView) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkView = link.dataset.nav;
        if (linkView === currentView || (currentView === 'thread-detail' && linkView === 'feed')) {
            link.classList.add('bg-gray-900');
        } else {
            link.classList.remove('bg-gray-900');
        }
    });
}

// ============================================
// Thread Detail View (simple inline for now)
// ============================================

async function renderThreadDetail(container, threadId) {
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-gray-400';
    loadingDiv.textContent = 'Loading thread...';
    container.appendChild(loadingDiv);

    try {
        const thread = await api.getThread(threadId);

        // Import and render reply composer
        const { renderReplyComposer } = await import('./components/reply-composer.js');

        // Clear container safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        await renderReplyComposer(container, thread, state);

    } catch (error) {
        // Clear container safely
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-400';
        errorDiv.textContent = 'Failed to load thread: ' + error.message;
        container.appendChild(errorDiv);
    }
}

// ============================================
// Status Updates
// ============================================

async function updateStatus() {
    try {
        const status = await api.getStatus();

        const dotEl = document.getElementById('status-dot');
        const textEl = document.getElementById('status-text');

        if (status.scheduler?.isDiscoveryActive) {
            // Currently running discovery - show pulsing indicator
            dotEl.className = 'w-2 h-2 rounded-full bg-blue-500 animate-pulse';
            textEl.textContent = 'Discovering...';
        } else if (status.scheduler?.discoveryRunning) {
            // Scheduled but not currently running
            dotEl.className = 'w-2 h-2 rounded-full bg-green-500';
            textEl.textContent = 'Monitoring active';
        } else {
            dotEl.className = 'w-2 h-2 rounded-full bg-yellow-500';
            textEl.textContent = 'Monitoring paused';
        }

        // Store status globally for other components
        state.schedulerStatus = status.scheduler;
    } catch (error) {
        const textEl = document.getElementById('status-text');
        textEl.textContent = 'Status unknown';
    }
}

async function updateThreadCount() {
    try {
        const result = await api.getThreads({ status: 'new', limit: 0 });
        const countEl = document.getElementById('new-count');
        if (countEl) {
            countEl.textContent = result.total || 0;
        }
    } catch (error) {
        console.warn('Failed to update thread count:', error);
    }
}

// ============================================
// Initialize Application
// ============================================

async function init() {
    // Set up router
    window.addEventListener('hashchange', handleRouteChange);

    // Initialize components
    initThreadFeed(state, navigate);
    initKeywordsView(state);
    initActivityView(state);
    initAnalyticsView(state);
    initSettingsView(state);

    // Check configuration status first
    try {
        const configStatus = await api.getConfigStatus();

        if (!configStatus.isConfigured) {
            // Show setup wizard for missing required config
            showSetupWizard(async () => {
                // After setup completes, reload config and continue
                await continueInit();
            });
            return; // Don't continue init until setup is complete
        }

        // Show warnings for non-critical issues
        if (configStatus.warnings && configStatus.warnings.length > 0) {
            updateWarningBanner(configStatus);
        }
    } catch (error) {
        console.warn('Failed to check config status:', error);
        // Continue anyway - the app will show errors when features fail
    }

    await continueInit();
}

/**
 * Continue initialization after setup wizard (if shown)
 */
async function continueInit() {
    // Load initial data
    try {
        state.settings = await api.getSettings();
    } catch (error) {
        console.warn('Failed to load settings:', error);
    }

    // Check for warnings again after setup
    try {
        const configStatus = await api.getConfigStatus();
        if (configStatus.warnings && configStatus.warnings.length > 0) {
            updateWarningBanner(configStatus);
        }
    } catch (error) {
        // Ignore
    }

    // Initial route handling
    await handleRouteChange();

    // Update status
    await updateStatus();
    await updateThreadCount();

    // Set up auto-refresh for content
    const refreshInterval = (state.settings['ui.refresh_interval_seconds'] || 60) * 1000;
    setInterval(() => {
        if (state.settings['ui.auto_refresh'] !== false) {
            updateThreadCount();
            if (state.currentView === 'feed') {
                // Soft refresh the feed
                handleRouteChange();
            }
        }
    }, refreshInterval);

    // Set up faster status polling (every 10 seconds) to catch running discovery
    setInterval(() => {
        updateStatus();
    }, 10000);
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Export for use in other modules
export { state, navigate };
