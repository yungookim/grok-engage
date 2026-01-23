/**
 * Keywords View Component
 * Dedicated page for keyword management, notifications, and performance reports
 */

import * as api from '../api.js';
import { createElement, escapeHtml } from '../utils.js';

let appState = null;

/**
 * Initialize keywords view with app state
 */
export function initKeywordsView(state) {
    appState = state;
}

/**
 * Render the keywords view
 */
export async function renderKeywordsView(container, state) {
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const wrapper = createElement('div', '', 'max-w-4xl mx-auto');

    // Header
    const header = createElement('h2', 'Keywords', 'text-2xl font-bold mb-6');
    wrapper.appendChild(header);

    // Notifications section (changes banner)
    const notificationsContainer = createElement('div', '', 'mb-6');
    notificationsContainer.id = 'keyword-notifications';
    wrapper.appendChild(notificationsContainer);

    // Performance Overview
    const statsSection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6');
    statsSection.id = 'keyword-stats';
    wrapper.appendChild(statsSection);

    // Manage Keywords section
    const manageSection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');
    manageSection.id = 'keyword-manage';
    wrapper.appendChild(manageSection);

    container.appendChild(wrapper);

    // Load data
    await Promise.all([
        loadNotifications(),
        loadStats(),
        loadKeywordManager()
    ]);
}

/**
 * Load and render notifications banner
 */
async function loadNotifications() {
    const container = document.getElementById('keyword-notifications');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    try {
        const result = await api.getKeywordChanges(7);
        const changes = result.changes || [];

        if (changes.length === 0) return;

        const banner = createElement('div', '', 'bg-blue-900/30 border border-blue-800 rounded-lg p-4');

        const headerRow = createElement('div', '', 'flex justify-between items-center mb-3');
        const title = createElement('h3', 'Keyword Updates (last 7 days)', 'text-sm font-medium text-blue-300');
        headerRow.appendChild(title);

        const dismissBtn = createElement('button', 'Dismiss', 'text-xs text-gray-400 hover:text-white');
        dismissBtn.addEventListener('click', async () => {
            await api.dismissKeywordChanges();
            container.textContent = '';
        });
        headerRow.appendChild(dismissBtn);

        banner.appendChild(headerRow);

        const list = createElement('ul', '', 'space-y-1 text-sm');
        for (const change of changes.slice(0, 5)) {
            const item = createElement('li', '', 'text-gray-300');

            const icon = change.action === 'added' ? '+' : change.action === 'disabled' ? '-' : '~';
            const iconClass = change.action === 'added' ? 'text-green-400' : change.action === 'disabled' ? 'text-red-400' : 'text-yellow-400';

            const iconSpan = createElement('span', icon, iconClass);
            item.appendChild(iconSpan);
            item.appendChild(document.createTextNode(' '));

            const keywordSpan = createElement('strong', change.keyword_text, '');
            item.appendChild(keywordSpan);
            item.appendChild(document.createTextNode(` (${change.reason || change.action})`));

            list.appendChild(item);
        }

        if (changes.length > 5) {
            const more = createElement('li', `... and ${changes.length - 5} more`, 'text-gray-500');
            list.appendChild(more);
        }

        banner.appendChild(list);
        container.appendChild(banner);

    } catch (error) {
        console.error('Failed to load keyword notifications:', error);
    }
}

/**
 * Load and render performance stats
 */
async function loadStats() {
    const container = document.getElementById('keyword-stats');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const title = createElement('h3', 'Performance Overview', 'text-lg font-semibold mb-4');
    container.appendChild(title);

    try {
        const stats = await api.getKeywordStats();

        // Summary row
        const summaryRow = createElement('div', '', 'flex gap-6 mb-6 text-sm');

        const activeStat = createElement('div', '', '');
        const activeLabel = createElement('span', 'Active: ', 'text-gray-400');
        const activeValue = createElement('span', String(stats.active), 'text-white font-medium');
        activeStat.appendChild(activeLabel);
        activeStat.appendChild(activeValue);
        summaryRow.appendChild(activeStat);

        const disabledStat = createElement('div', '', '');
        const disabledLabel = createElement('span', 'Disabled: ', 'text-gray-400');
        const disabledValue = createElement('span', String(stats.disabled), 'text-white font-medium');
        disabledStat.appendChild(disabledLabel);
        disabledStat.appendChild(disabledValue);
        summaryRow.appendChild(disabledStat);

        const avgStat = createElement('div', '', '');
        const avgLabel = createElement('span', 'Avg Score: ', 'text-gray-400');
        const avgValue = createElement('span', String(Math.round(stats.avgScore)), 'text-white font-medium');
        avgStat.appendChild(avgLabel);
        avgStat.appendChild(avgValue);
        summaryRow.appendChild(avgStat);

        container.appendChild(summaryRow);

        // Two column layout for top/underperforming
        const columns = createElement('div', '', 'grid grid-cols-2 gap-6');

        // Top performers
        const topCol = createElement('div', '', '');
        const topTitle = createElement('h4', 'Top Performers', 'text-sm font-medium text-gray-400 mb-2');
        topCol.appendChild(topTitle);

        if (stats.topPerformers && stats.topPerformers.length > 0) {
            const topList = createElement('ul', '', 'space-y-1');
            for (const kw of stats.topPerformers) {
                const item = createElement('li', '', 'flex justify-between text-sm');
                const kwName = createElement('span', kw.keyword, 'text-white');
                const kwScore = createElement('span', String(kw.performance_score), 'text-green-400');
                item.appendChild(kwName);
                item.appendChild(kwScore);
                topList.appendChild(item);
            }
            topCol.appendChild(topList);
        } else {
            const empty = createElement('p', 'No data yet', 'text-gray-500 text-sm');
            topCol.appendChild(empty);
        }

        columns.appendChild(topCol);

        // Underperforming
        const lowCol = createElement('div', '', '');
        const lowTitle = createElement('h4', 'Underperforming', 'text-sm font-medium text-gray-400 mb-2');
        lowCol.appendChild(lowTitle);

        if (stats.underperforming && stats.underperforming.length > 0) {
            const lowList = createElement('ul', '', 'space-y-1');
            for (const kw of stats.underperforming) {
                const item = createElement('li', '', 'flex justify-between text-sm');
                const kwName = createElement('span', kw.keyword, 'text-white');
                const kwScore = createElement('span', String(kw.performance_score), 'text-red-400');
                item.appendChild(kwName);
                item.appendChild(kwScore);
                lowList.appendChild(item);
            }
            lowCol.appendChild(lowList);
        } else {
            const empty = createElement('p', 'No data yet', 'text-gray-500 text-sm');
            lowCol.appendChild(empty);
        }

        columns.appendChild(lowCol);
        container.appendChild(columns);

    } catch (error) {
        const errorDiv = createElement('p', 'Failed to load stats: ' + error.message, 'text-red-400');
        container.appendChild(errorDiv);
    }
}

/**
 * Load and render keyword manager
 */
async function loadKeywordManager() {
    const container = document.getElementById('keyword-manage');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const title = createElement('h3', 'Manage Keywords', 'text-lg font-semibold mb-4');
    container.appendChild(title);

    // Add keyword form
    const addForm = createElement('div', '', 'flex gap-2 mb-4');

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'new-keyword';
    input.placeholder = 'Enter keyword to monitor...';
    input.className = 'flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-x-blue';
    addForm.appendChild(input);

    const categorySelect = document.createElement('select');
    categorySelect.id = 'keyword-category';
    categorySelect.className = 'bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-300';
    const categories = [
        { value: 'custom', label: 'Custom' },
        { value: 'pain-point', label: 'Pain Point' },
        { value: 'tool-discovery', label: 'Tool Discovery' },
        { value: 'building-in-public', label: 'Building in Public' }
    ];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.value;
        opt.textContent = cat.label;
        categorySelect.appendChild(opt);
    });
    addForm.appendChild(categorySelect);

    const addBtn = createElement('button', 'Add', 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded');
    addBtn.addEventListener('click', handleAddKeyword);
    addForm.appendChild(addBtn);

    container.appendChild(addForm);

    // Keyword list
    const listContainer = createElement('div', '', 'space-y-2');
    listContainer.id = 'keyword-list';
    container.appendChild(listContainer);

    // Load keywords
    await loadKeywords();
}

/**
 * Load and render keywords
 */
async function loadKeywords() {
    const container = document.getElementById('keyword-list');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    try {
        const result = await api.getKeywords(false);
        const keywords = result.keywords || [];

        if (keywords.length === 0) {
            const empty = createElement('p', 'No keywords configured. Add some above or create a product profile to auto-generate keywords!', 'text-gray-500');
            container.appendChild(empty);
            return;
        }

        keywords.forEach(kw => {
            container.appendChild(createKeywordRow(kw));
        });

    } catch (error) {
        const errorDiv = createElement('p', 'Failed to load keywords: ' + error.message, 'text-red-400');
        container.appendChild(errorDiv);
    }
}

/**
 * Create a keyword row
 */
function createKeywordRow(keyword) {
    const row = createElement('div', '', 'flex items-center justify-between bg-gray-800 rounded p-3');

    const left = createElement('div', '', 'flex items-center gap-3');

    // Toggle checkbox
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = keyword.is_active;
    toggle.className = 'w-4 h-4 rounded';
    toggle.addEventListener('change', () => handleToggleKeyword(keyword.id, toggle.checked));
    left.appendChild(toggle);

    // Keyword text
    const text = createElement('span', keyword.keyword, keyword.is_active ? 'text-white' : 'text-gray-500');
    left.appendChild(text);

    // Category badge
    const categoryColors = {
        'auto-generated': 'bg-blue-900 text-blue-300',
        'auto-discovered': 'bg-purple-900 text-purple-300',
        'auto-experiment': 'bg-pink-900 text-pink-300',
        'custom': 'bg-gray-700 text-gray-400',
        'pain-point': 'bg-orange-900 text-orange-300',
        'tool-discovery': 'bg-green-900 text-green-300',
        'building-in-public': 'bg-yellow-900 text-yellow-300'
    };
    const badgeClass = categoryColors[keyword.category] || 'bg-gray-700 text-gray-400';
    const badge = createElement('span', keyword.category || 'custom', `text-xs px-2 py-0.5 rounded ${badgeClass}`);
    left.appendChild(badge);

    // Performance score
    if (keyword.threads_matched > 0) {
        const scoreColor = keyword.performance_score >= 60 ? 'text-green-400' : keyword.performance_score >= 40 ? 'text-yellow-400' : 'text-red-400';
        const score = createElement('span', String(keyword.performance_score), `text-xs ${scoreColor}`);
        left.appendChild(score);
    }

    row.appendChild(left);

    // Delete button (only for manual keywords)
    if (!['auto-generated', 'auto-discovered', 'auto-experiment'].includes(keyword.category)) {
        const deleteBtn = createElement('button', 'Delete', 'text-red-400 hover:text-red-300 text-sm');
        deleteBtn.addEventListener('click', () => handleDeleteKeyword(keyword.id));
        row.appendChild(deleteBtn);
    } else {
        // For auto keywords, show disable hint
        const hint = createElement('span', keyword.is_active ? '' : 'disabled', 'text-gray-500 text-xs');
        row.appendChild(hint);
    }

    return row;
}

/**
 * Handle add keyword
 */
async function handleAddKeyword() {
    const input = document.getElementById('new-keyword');
    const categorySelect = document.getElementById('keyword-category');

    const keyword = input?.value?.trim();
    const category = categorySelect?.value || 'custom';

    if (!keyword) return;

    try {
        await api.addKeyword(keyword, category);
        input.value = '';

        // Preserve scroll position of the #app container (not window)
        const scrollContainer = document.getElementById('app');
        const scrollTop = scrollContainer?.scrollTop || 0;

        await loadKeywords();
        await loadStats();

        // Restore scroll position after DOM update
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
        }
    } catch (error) {
        alert('Failed to add keyword: ' + error.message);
    }
}

/**
 * Handle toggle keyword
 */
async function handleToggleKeyword(id, isActive) {
    try {
        await api.toggleKeyword(id, isActive);

        // Preserve scroll position of the #app container (not window)
        const scrollContainer = document.getElementById('app');
        const scrollTop = scrollContainer?.scrollTop || 0;

        await loadKeywords();
        await loadStats();

        // Restore scroll position after DOM update
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
        }
    } catch (error) {
        alert('Failed to update keyword: ' + error.message);
    }
}

/**
 * Handle delete keyword
 */
async function handleDeleteKeyword(id) {
    if (!confirm('Delete this keyword?')) return;

    try {
        await api.deleteKeyword(id);

        // Preserve scroll position of the #app container (not window)
        const scrollContainer = document.getElementById('app');
        const scrollTop = scrollContainer?.scrollTop || 0;

        await loadKeywords();
        await loadStats();

        // Restore scroll position after DOM update
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollTop;
        }
    } catch (error) {
        alert('Failed to delete keyword: ' + error.message);
    }
}
