/**
 * Analytics View Component
 * Displays summary stats, API usage, and learned insights
 */

import * as api from '../api.js';
import { createElement, formatFollowers } from '../utils.js';

let appState = null;

/**
 * Initialize analytics view with app state
 */
export function initAnalyticsView(state) {
    appState = state;
}

/**
 * Render the analytics view
 */
export async function renderAnalyticsView(container, state) {
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const wrapper = createElement('div', '', 'max-w-4xl mx-auto');

    // Header
    const header = createElement('h2', 'Analytics', 'text-2xl font-bold mb-6');
    wrapper.appendChild(header);

    // Loading indicator
    const loading = createElement('div', 'Loading analytics...', 'text-gray-400');
    loading.id = 'analytics-loading';
    wrapper.appendChild(loading);

    // Content container
    const content = createElement('div', '', 'space-y-6');
    content.id = 'analytics-content';
    wrapper.appendChild(content);

    container.appendChild(wrapper);

    // Load data
    await loadAnalytics();
}

/**
 * Load and render analytics data
 */
async function loadAnalytics() {
    const loading = document.getElementById('analytics-loading');
    const content = document.getElementById('analytics-content');

    try {
        // Load all data in parallel
        const [summary, insights, apiUsage] = await Promise.all([
            api.getAnalyticsSummary(),
            api.getInsights(),
            api.getApiUsage()
        ]);

        if (loading) loading.style.display = 'none';

        // Clear content
        while (content.firstChild) {
            content.removeChild(content.firstChild);
        }

        // Summary stats
        content.appendChild(createSummarySection(summary));

        // API usage
        content.appendChild(createApiUsageSection(apiUsage));

        // Insights
        content.appendChild(createInsightsSection(insights));

    } catch (error) {
        if (loading) loading.style.display = 'none';

        const errorDiv = createElement('div', 'Failed to load analytics: ' + error.message,
            'text-red-400 text-center py-8'
        );
        content.appendChild(errorDiv);
    }
}

/**
 * Create summary stats section
 */
function createSummarySection(summary) {
    const section = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const title = createElement('h3', 'Summary', 'text-lg font-semibold mb-4');
    section.appendChild(title);

    const grid = createElement('div', '', 'grid grid-cols-2 md:grid-cols-4 gap-4');

    // Thread stats
    const threadStats = [
        { label: 'Total Threads', value: summary.threads?.total || 0 },
        { label: 'New', value: summary.threads?.new || 0, color: 'text-blue-400' },
        { label: 'Replied', value: summary.threads?.replied || 0, color: 'text-green-400' },
        { label: 'Skipped', value: summary.threads?.skipped || 0, color: 'text-gray-400' }
    ];

    threadStats.forEach(stat => {
        const card = createElement('div', '', 'bg-gray-800 rounded p-4 text-center');
        const value = createElement('div', String(stat.value), `text-2xl font-bold ${stat.color || 'text-white'}`);
        const label = createElement('div', stat.label, 'text-gray-500 text-sm');
        card.appendChild(value);
        card.appendChild(label);
        grid.appendChild(card);
    });

    section.appendChild(grid);

    // Reply stats
    const replyGrid = createElement('div', '', 'grid grid-cols-2 md:grid-cols-3 gap-4 mt-4');

    const replyStats = [
        { label: 'Total Replies', value: summary.replies?.total || 0 },
        { label: 'Posted', value: summary.replies?.posted || 0, color: 'text-green-400' },
        { label: 'Edited', value: summary.replies?.edited || 0, color: 'text-yellow-400' }
    ];

    replyStats.forEach(stat => {
        const card = createElement('div', '', 'bg-gray-800 rounded p-4 text-center');
        const value = createElement('div', String(stat.value), `text-2xl font-bold ${stat.color || 'text-white'}`);
        const label = createElement('div', stat.label, 'text-gray-500 text-sm');
        card.appendChild(value);
        card.appendChild(label);
        replyGrid.appendChild(card);
    });

    section.appendChild(replyGrid);

    return section;
}

/**
 * Create API usage section
 */
function createApiUsageSection(usage) {
    const section = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const title = createElement('h3', 'API Usage This Month', 'text-lg font-semibold mb-4');
    section.appendChild(title);

    const grid = createElement('div', '', 'grid grid-cols-1 md:grid-cols-2 gap-4');

    // X API Read
    const readCard = createUsageCard(
        'X API Reads',
        usage.read?.used || 0,
        usage.read?.limit || 10000,
        usage.read?.dailyBudget || 0
    );
    grid.appendChild(readCard);

    // X API Write
    const writeCard = createUsageCard(
        'X API Writes',
        usage.write?.used || 0,
        usage.write?.limit || 500,
        usage.write?.dailyBudget || 0
    );
    grid.appendChild(writeCard);

    section.appendChild(grid);

    return section;
}

/**
 * Create a usage meter card
 */
function createUsageCard(label, used, limit, dailyBudget) {
    const card = createElement('div', '', 'bg-gray-800 rounded p-4');

    const header = createElement('div', '', 'flex justify-between items-center mb-2');
    const labelEl = createElement('span', label, 'text-gray-300');
    const valueEl = createElement('span', `${used} / ${limit}`, 'text-gray-400 text-sm');
    header.appendChild(labelEl);
    header.appendChild(valueEl);
    card.appendChild(header);

    // Progress bar
    const progressBg = createElement('div', '', 'w-full bg-gray-700 rounded-full h-2');
    const progress = createElement('div', '', 'h-2 rounded-full');

    const percentage = Math.min(100, (used / limit) * 100);
    progress.style.width = `${percentage}%`;

    if (percentage > 90) {
        progress.className += ' bg-red-500';
    } else if (percentage > 70) {
        progress.className += ' bg-yellow-500';
    } else {
        progress.className += ' bg-green-500';
    }

    progressBg.appendChild(progress);
    card.appendChild(progressBg);

    // Daily budget
    const budget = createElement('div', `Daily budget: ${dailyBudget} remaining`, 'text-gray-500 text-xs mt-2');
    card.appendChild(budget);

    return card;
}

/**
 * Create insights section
 */
function createInsightsSection(insights) {
    const section = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const title = createElement('h3', 'Learned Insights', 'text-lg font-semibold mb-4');
    section.appendChild(title);

    // Thread preferences
    if (insights.threadPreferences) {
        const prefSection = createElement('div', '', 'mb-6');
        const prefTitle = createElement('h4', 'Thread Preferences', 'text-md font-medium mb-2 text-gray-300');
        prefSection.appendChild(prefTitle);

        const prefGrid = createElement('div', '', 'grid grid-cols-1 md:grid-cols-3 gap-4');

        // Preferred tones
        if (insights.threadPreferences.preferredTones?.length > 0) {
            prefGrid.appendChild(createPreferenceList('Preferred Tones', insights.threadPreferences.preferredTones));
        }

        // Preferred topics
        if (insights.threadPreferences.preferredTopics?.length > 0) {
            prefGrid.appendChild(createPreferenceList('Preferred Topics', insights.threadPreferences.preferredTopics));
        }

        // Preferred times
        if (insights.threadPreferences.preferredTimes?.length > 0) {
            prefGrid.appendChild(createPreferenceList('Best Times', insights.threadPreferences.preferredTimes));
        }

        prefSection.appendChild(prefGrid);
        section.appendChild(prefSection);
    }

    // Reply style patterns
    if (insights.replyStyle?.length > 0) {
        const styleSection = createElement('div', '', 'mb-6');
        const styleTitle = createElement('h4', 'Reply Style Patterns', 'text-md font-medium mb-2 text-gray-300');
        styleSection.appendChild(styleTitle);

        const styleList = createElement('div', '', 'space-y-2');

        insights.replyStyle.forEach(pattern => {
            const item = createElement('div', '', 'flex justify-between items-center bg-gray-800 rounded p-2');
            const key = createElement('span', formatPatternKey(pattern.key), 'text-gray-300');
            const value = createElement('span', `Score: ${pattern.value?.count || 0}`, 'text-gray-500 text-sm');
            item.appendChild(key);
            item.appendChild(value);
            styleList.appendChild(item);
        });

        styleSection.appendChild(styleList);
        section.appendChild(styleSection);
    }

    // Outcomes
    if (insights.outcomes?.bestReplyType?.length > 0) {
        const outcomeSection = createElement('div', '', '');
        const outcomeTitle = createElement('h4', 'Best Performing Reply Types', 'text-md font-medium mb-2 text-gray-300');
        outcomeSection.appendChild(outcomeTitle);

        const outcomeList = createElement('div', '', 'space-y-2');

        insights.outcomes.bestReplyType.forEach(item => {
            const row = createElement('div', '', 'flex justify-between items-center bg-gray-800 rounded p-2');
            const name = createElement('span', item.name, 'text-gray-300');
            const stats = createElement('span', '',  'text-gray-500 text-sm');
            stats.textContent = `Avg engagement: ${(item.avgEngagement24h * 100).toFixed(2)}% (${item.sampleCount} samples)`;
            row.appendChild(name);
            row.appendChild(stats);
            outcomeList.appendChild(row);
        });

        outcomeSection.appendChild(outcomeList);
        section.appendChild(outcomeSection);
    }

    // No insights message
    if (!insights.threadPreferences?.preferredTones?.length &&
        !insights.replyStyle?.length &&
        !insights.outcomes?.bestReplyType?.length) {
        const noData = createElement('p', 'No insights yet. Keep using the app to build up patterns!', 'text-gray-500');
        section.appendChild(noData);
    }

    return section;
}

/**
 * Create a preference list for insights
 */
function createPreferenceList(title, items) {
    const container = createElement('div', '', 'bg-gray-800 rounded p-3');
    const titleEl = createElement('div', title, 'text-gray-400 text-sm mb-2');
    container.appendChild(titleEl);

    const list = createElement('ul', '', 'space-y-1');

    items.forEach(item => {
        const li = createElement('li', '', 'flex justify-between text-sm');
        const name = createElement('span', item.name, 'text-gray-300');
        const score = createElement('span', `+${item.score}`, 'text-green-400');
        li.appendChild(name);
        li.appendChild(score);
        list.appendChild(li);
    });

    container.appendChild(list);
    return container;
}

/**
 * Format pattern key for display
 */
function formatPatternKey(key) {
    return key
        .replace(/_/g, ' ')
        .replace(/^adds /i, 'Adds ')
        .replace(/^removes /i, 'Removes ')
        .replace(/^prefers /i, 'Prefers ');
}
