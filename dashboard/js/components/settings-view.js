/**
 * Settings View Component
 * Manages product profiles and app settings
 */

import * as api from '../api.js';
import { createElement } from '../utils.js';

let appState = null;

/**
 * Initialize settings view with app state
 */
export function initSettingsView(state) {
    appState = state;
}

/**
 * Render the settings view
 */
export async function renderSettingsView(container, state) {
    // Clear container safely
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const wrapper = createElement('div', '', 'max-w-4xl mx-auto');

    // Header
    const header = createElement('h2', 'Settings', 'text-2xl font-bold mb-6');
    wrapper.appendChild(header);

    // Tab bar
    const tabs = createElement('div', '', 'flex gap-2 border-b border-gray-800 mb-6');
    const tabItems = [
        { id: 'profiles', label: 'Product Profiles' },
        { id: 'monitoring', label: 'Monitoring' },
        { id: 'apikeys', label: 'API Keys' }
    ];

    tabItems.forEach((tab, index) => {
        const btn = createElement('button', tab.label,
            `px-4 py-2 text-sm ${index === 0 ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'} rounded-t`
        );
        btn.dataset.tab = tab.id;
        btn.addEventListener('click', () => switchTab(tab.id));
        tabs.appendChild(btn);
    });
    wrapper.appendChild(tabs);

    // Tab content containers
    const profilesTab = createElement('div', '', '');
    profilesTab.id = 'tab-profiles';
    wrapper.appendChild(profilesTab);

    const monitoringTab = createElement('div', '', 'hidden');
    monitoringTab.id = 'tab-monitoring';
    wrapper.appendChild(monitoringTab);

    const apiKeysTab = createElement('div', '', 'hidden');
    apiKeysTab.id = 'tab-apikeys';
    wrapper.appendChild(apiKeysTab);

    container.appendChild(wrapper);

    // Load data for tabs
    await Promise.all([
        renderProfilesTab(profilesTab),
        renderMonitoringTab(monitoringTab, state.settings),
        renderApiKeysTab(apiKeysTab)
    ]);
}

/**
 * Switch between tabs
 */
function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.className = btn.dataset.tab === tabId
            ? 'px-4 py-2 text-sm bg-gray-800 text-white rounded-t'
            : 'px-4 py-2 text-sm text-gray-400 hover:text-white rounded-t';
    });

    // Show/hide tab content
    ['profiles', 'monitoring', 'apikeys'].forEach(id => {
        const el = document.getElementById(`tab-${id}`);
        if (el) {
            el.classList.toggle('hidden', id !== tabId);
        }
    });
}

/**
 * Render profiles tab
 */
async function renderProfilesTab(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const section = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const title = createElement('h3', 'Product Profiles', 'text-lg font-semibold mb-4');
    section.appendChild(title);

    // URL-based generation (primary flow)
    const urlSection = createElement('div', '', 'mb-6');

    const urlLabel = createElement('label', 'Add from Website', 'block text-gray-400 text-sm mb-2');
    urlSection.appendChild(urlLabel);

    const urlRow = createElement('div', '', 'flex gap-2');

    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.id = 'profile-url-input';
    urlInput.placeholder = 'https://yourproduct.com';
    urlInput.className = 'flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-x-blue';
    urlRow.appendChild(urlInput);

    const generateBtn = createElement('button', 'Generate', 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded whitespace-nowrap');
    generateBtn.id = 'generate-profile-btn';
    generateBtn.addEventListener('click', handleGenerateFromUrl);
    urlRow.appendChild(generateBtn);

    urlSection.appendChild(urlRow);

    // Status message for generation
    const statusMsg = createElement('div', '', 'mt-2 text-sm');
    statusMsg.id = 'generate-status';
    urlSection.appendChild(statusMsg);

    // Manual entry link
    const manualLink = createElement('button', 'Or create manually →', 'text-gray-500 hover:text-gray-300 text-sm mt-2');
    manualLink.addEventListener('click', () => showProfileForm());
    urlSection.appendChild(manualLink);

    section.appendChild(urlSection);

    // Divider
    const divider = createElement('div', '', 'border-t border-gray-800 my-4');
    section.appendChild(divider);

    // Profile list
    const listContainer = createElement('div', '', 'space-y-4');
    listContainer.id = 'profile-list';
    section.appendChild(listContainer);

    // Profile form (hidden by default)
    const formContainer = createElement('div', '', 'hidden mt-6 border-t border-gray-800 pt-6');
    formContainer.id = 'profile-form-container';
    section.appendChild(formContainer);

    container.appendChild(section);

    // Load profiles
    await loadProfiles();
}

/**
 * Load and render profiles
 */
async function loadProfiles() {
    const container = document.getElementById('profile-list');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    try {
        const result = await api.getProfiles(false);
        const profiles = result.profiles || [];

        if (profiles.length === 0) {
            const empty = createElement('p', 'No product profiles configured. Add one to enable reply generation!', 'text-gray-500');
            container.appendChild(empty);
            return;
        }

        profiles.forEach(profile => {
            container.appendChild(createProfileCard(profile));
        });

    } catch (error) {
        const errorDiv = createElement('p', 'Failed to load profiles: ' + error.message, 'text-red-400');
        container.appendChild(errorDiv);
    }
}

/**
 * Handle generate profile from URL
 */
async function handleGenerateFromUrl() {
    const urlInput = document.getElementById('profile-url-input');
    const generateBtn = document.getElementById('generate-profile-btn');
    const statusMsg = document.getElementById('generate-status');

    const url = urlInput?.value?.trim();
    if (!url) {
        statusMsg.className = 'mt-2 text-sm text-red-400';
        statusMsg.textContent = 'Please enter a website URL';
        return;
    }

    // Show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = 'Analyzing...';
    generateBtn.className = 'bg-gray-600 text-gray-300 px-4 py-2 rounded whitespace-nowrap cursor-not-allowed';
    urlInput.disabled = true;
    statusMsg.className = 'mt-2 text-sm text-gray-400';
    statusMsg.textContent = 'Fetching website and extracting product info...';

    try {
        const result = await api.generateProfileFromUrl(url);

        // Success
        statusMsg.className = 'mt-2 text-sm text-green-400';
        statusMsg.textContent = `Profile created for "${result.profile.name}"`;
        urlInput.value = '';

        // Reload profiles list
        await loadProfiles();

        // Clear success message after 5 seconds
        setTimeout(() => {
            if (statusMsg.textContent.includes('Profile created')) {
                statusMsg.textContent = '';
            }
        }, 5000);

    } catch (error) {
        statusMsg.className = 'mt-2 text-sm text-red-400';
        statusMsg.textContent = error.message || 'Failed to generate profile';
    } finally {
        // Reset button state
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate';
        generateBtn.className = 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded whitespace-nowrap';
        urlInput.disabled = false;
    }
}

/**
 * Create a profile card
 */
function createProfileCard(profile) {
    const card = createElement('div', '', 'bg-gray-800 rounded p-4');

    const header = createElement('div', '', 'flex justify-between items-start mb-2');

    const left = createElement('div', '', '');

    // Name row with badge
    const nameRow = createElement('div', '', 'flex items-center gap-2');
    const name = createElement('h4', profile.name, 'font-medium text-white');
    nameRow.appendChild(name);

    // Show badge if profile was generated from URL
    if (profile.url) {
        const badge = createElement('span', 'Generated', 'text-xs px-2 py-0.5 rounded bg-blue-900 text-blue-300');
        nameRow.appendChild(badge);
    }

    left.appendChild(nameRow);

    if (profile.one_liner) {
        const liner = createElement('p', profile.one_liner, 'text-gray-400 text-sm');
        left.appendChild(liner);
    }

    header.appendChild(left);

    const actions = createElement('div', '', 'flex gap-2');
    const editBtn = createElement('button', 'Edit', 'text-x-blue hover:underline text-sm');
    editBtn.addEventListener('click', () => showProfileForm(profile));
    actions.appendChild(editBtn);

    const deleteBtn = createElement('button', 'Delete', 'text-red-400 hover:text-red-300 text-sm');
    deleteBtn.addEventListener('click', () => handleDeleteProfile(profile.id));
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // Details
    if (profile.problems_solved?.length > 0) {
        const problems = createElement('p', 'Solves: ' + profile.problems_solved.join(', '), 'text-gray-500 text-sm mt-2');
        card.appendChild(problems);
    }

    return card;
}

/**
 * Show profile form (create or edit)
 */
function showProfileForm(existingProfile = null) {
    const container = document.getElementById('profile-form-container');
    if (!container) return;

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    container.classList.remove('hidden');

    const title = createElement('h4', existingProfile ? 'Edit Profile' : 'Add Profile', 'text-lg font-semibold mb-4');
    container.appendChild(title);

    const form = createElement('div', '', 'space-y-4');

    // Name
    const nameGroup = createFormGroup('Name', 'profile-name', 'text', existingProfile?.name || '', 'Product name');
    form.appendChild(nameGroup);

    // One-liner
    const linerGroup = createFormGroup('One-liner', 'profile-liner', 'text', existingProfile?.one_liner || '', 'Brief description');
    form.appendChild(linerGroup);

    // Problems solved (textarea for comma-separated)
    const problemsGroup = createFormGroup('Problems Solved', 'profile-problems', 'textarea',
        (existingProfile?.problems_solved || []).join(', '), 'Comma-separated list of problems');
    form.appendChild(problemsGroup);

    // Target audience
    const audienceGroup = createFormGroup('Target Audience', 'profile-audience', 'textarea',
        (existingProfile?.target_audience || []).join(', '), 'Comma-separated list');
    form.appendChild(audienceGroup);

    // When to mention
    const mentionGroup = createFormGroup('When to Mention', 'profile-mention', 'textarea',
        existingProfile?.when_to_mention || '', 'Guidelines for when to mention the product');
    form.appendChild(mentionGroup);

    // When NOT to mention
    const notMentionGroup = createFormGroup('When NOT to Mention', 'profile-not-mention', 'textarea',
        existingProfile?.when_not_to_mention || '', 'Guidelines for when to avoid mentioning');
    form.appendChild(notMentionGroup);

    // URL
    const urlGroup = createFormGroup('URL', 'profile-url', 'text', existingProfile?.url || '', 'Product website');
    form.appendChild(urlGroup);

    // Buttons
    const buttons = createElement('div', '', 'flex gap-3 pt-4');

    const saveBtn = createElement('button', existingProfile ? 'Update' : 'Create',
        'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded'
    );
    saveBtn.addEventListener('click', () => handleSaveProfile(existingProfile?.id));
    buttons.appendChild(saveBtn);

    const cancelBtn = createElement('button', 'Cancel', 'bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded');
    cancelBtn.addEventListener('click', () => {
        container.classList.add('hidden');
    });
    buttons.appendChild(cancelBtn);

    form.appendChild(buttons);
    container.appendChild(form);
}

/**
 * Create a form group
 */
function createFormGroup(label, id, type, value, placeholder) {
    const group = createElement('div', '', '');

    const labelEl = createElement('label', label, 'block text-gray-400 text-sm mb-1');
    labelEl.htmlFor = id;
    group.appendChild(labelEl);

    if (type === 'textarea') {
        const input = document.createElement('textarea');
        input.id = id;
        input.className = 'w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-x-blue';
        input.rows = 3;
        input.placeholder = placeholder;
        input.value = value;
        group.appendChild(input);
    } else {
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.className = 'w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-x-blue';
        input.placeholder = placeholder;
        input.value = value;
        group.appendChild(input);
    }

    return group;
}

/**
 * Handle save profile
 */
async function handleSaveProfile(existingId = null) {
    const getValue = (id) => document.getElementById(id)?.value?.trim() || '';
    const getArray = (id) => getValue(id).split(',').map(s => s.trim()).filter(s => s);

    const profile = {
        name: getValue('profile-name'),
        one_liner: getValue('profile-liner'),
        problems_solved: getArray('profile-problems'),
        target_audience: getArray('profile-audience'),
        when_to_mention: getValue('profile-mention'),
        when_not_to_mention: getValue('profile-not-mention'),
        url: getValue('profile-url')
    };

    if (!profile.name) {
        alert('Name is required');
        return;
    }

    try {
        if (existingId) {
            await api.updateProfile(existingId, profile);
        } else {
            await api.createProfile(profile);
        }

        document.getElementById('profile-form-container')?.classList.add('hidden');
        await loadProfiles();

    } catch (error) {
        alert('Failed to save profile: ' + error.message);
    }
}

/**
 * Handle delete profile
 */
async function handleDeleteProfile(id) {
    if (!confirm('Delete this profile?')) return;

    try {
        await api.deleteProfile(id);
        await loadProfiles();
    } catch (error) {
        alert('Failed to delete profile: ' + error.message);
    }
}

/**
 * Render monitoring tab
 */
async function renderMonitoringTab(container, settings) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // Monitoring Settings Section
    const section = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6');

    const title = createElement('h3', 'Monitoring Settings', 'text-lg font-semibold mb-4');
    section.appendChild(title);

    const form = createElement('div', '', 'space-y-4');

    // Monitoring enabled
    const enabledGroup = createElement('div', '', 'flex items-center justify-between');
    const enabledLabel = createElement('span', 'Enable Monitoring', 'text-gray-300');
    enabledGroup.appendChild(enabledLabel);

    const enabledToggle = document.createElement('input');
    enabledToggle.type = 'checkbox';
    enabledToggle.id = 'monitoring-enabled';
    enabledToggle.checked = settings['monitoring.enabled'] !== false;
    enabledToggle.className = 'w-5 h-5';
    enabledGroup.appendChild(enabledToggle);

    form.appendChild(enabledGroup);

    // Interval
    const intervalGroup = createFormGroup('Check Interval (minutes)', 'monitoring-interval', 'number',
        settings['monitoring.interval_minutes'] || 5, '5');
    form.appendChild(intervalGroup);

    // Min replies threshold
    const repliesGroup = createFormGroup('Min Replies Threshold', 'monitoring-min-replies', 'number',
        settings['monitoring.min_replies'] || 15, '15');
    form.appendChild(repliesGroup);

    // Semantic score threshold
    const scoreGroup = createFormGroup('Semantic Score Threshold (0-100)', 'monitoring-threshold', 'number',
        settings['monitoring.semantic_threshold'] || 70, '70');
    form.appendChild(scoreGroup);

    // Save button
    const saveBtn = createElement('button', 'Save Settings',
        'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded mt-4'
    );
    saveBtn.addEventListener('click', handleSaveMonitoringSettings);
    form.appendChild(saveBtn);

    // Status message
    const status = createElement('div', '', 'mt-2 text-sm');
    status.id = 'monitoring-status';
    form.appendChild(status);

    section.appendChild(form);
    container.appendChild(section);

    // Keyword Experimentation Section
    const expSection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const expTitle = createElement('h3', 'Keyword Experimentation', 'text-lg font-semibold mb-2');
    expSection.appendChild(expTitle);

    const expDesc = createElement('p', 'Automatically generate new keywords when discovery runs dry.',
        'text-sm text-gray-500 mb-4');
    expSection.appendChild(expDesc);

    // Dry cycle status indicator
    const statusIndicator = createElement('div', '', 'bg-gray-800 rounded p-3 mb-4');
    statusIndicator.id = 'experimentation-dry-status';
    expSection.appendChild(statusIndicator);

    // Load and display dry cycle status
    loadDryCycleStatus();

    const expForm = createElement('div', '', 'space-y-4');

    // Experimentation enabled
    const expEnabledGroup = createElement('div', '', 'flex items-center justify-between');
    const expEnabledLabel = createElement('span', 'Enable Experimentation', 'text-gray-300');
    expEnabledGroup.appendChild(expEnabledLabel);

    const expEnabledToggle = document.createElement('input');
    expEnabledToggle.type = 'checkbox';
    expEnabledToggle.id = 'experimentation-enabled';
    expEnabledToggle.checked = settings['experimentation.enabled'] !== false;
    expEnabledToggle.className = 'w-5 h-5';
    expEnabledGroup.appendChild(expEnabledToggle);

    expForm.appendChild(expEnabledGroup);

    // Dry threshold
    const dryGroup = createFormGroup('Dry Cycle Threshold', 'experimentation-dry-threshold', 'number',
        settings['experimentation.dry_threshold'] || 3, '3');
    const dryHint = createElement('p', 'Trigger experimentation after this many discovery cycles find nothing',
        'text-xs text-gray-500 mt-1');
    dryGroup.appendChild(dryHint);
    expForm.appendChild(dryGroup);

    // Batch size
    const batchGroup = createFormGroup('Keywords per Batch', 'experimentation-batch-size', 'number',
        settings['experimentation.batch_size'] || 7, '7');
    const batchHint = createElement('p', 'Number of experimental keywords to generate each time',
        'text-xs text-gray-500 mt-1');
    batchGroup.appendChild(batchHint);
    expForm.appendChild(batchGroup);

    // Button row
    const expBtnRow = createElement('div', '', 'flex gap-3 mt-4');

    // Save button
    const expSaveBtn = createElement('button', 'Save Settings',
        'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded'
    );
    expSaveBtn.addEventListener('click', handleSaveExperimentationSettings);
    expBtnRow.appendChild(expSaveBtn);

    // Trigger Now button
    const triggerBtn = createElement('button', 'Generate Keywords Now',
        'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded'
    );
    triggerBtn.id = 'trigger-experimentation-btn';
    triggerBtn.addEventListener('click', handleTriggerExperimentation);
    expBtnRow.appendChild(triggerBtn);

    expForm.appendChild(expBtnRow);

    // Status message
    const expStatus = createElement('div', '', 'mt-2 text-sm');
    expStatus.id = 'experimentation-status';
    expForm.appendChild(expStatus);

    expSection.appendChild(expForm);
    container.appendChild(expSection);
}

/**
 * Handle save monitoring settings
 */
async function handleSaveMonitoringSettings() {
    const statusDiv = document.getElementById('monitoring-status');

    const settings = {
        'monitoring.enabled': document.getElementById('monitoring-enabled')?.checked ?? true,
        'monitoring.interval_minutes': parseInt(document.getElementById('monitoring-interval')?.value || '5', 10),
        'monitoring.min_replies': parseInt(document.getElementById('monitoring-min-replies')?.value || '15', 10),
        'monitoring.semantic_threshold': parseInt(document.getElementById('monitoring-threshold')?.value || '70', 10)
    };

    try {
        await api.updateSettings(settings);

        if (appState) {
            Object.assign(appState.settings, settings);
        }

        if (statusDiv) {
            statusDiv.className = 'mt-2 text-sm text-green-400';
            statusDiv.textContent = 'Settings saved!';
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-2 text-sm text-red-400';
            statusDiv.textContent = 'Failed to save: ' + error.message;
        }
    }
}

/**
 * Handle save experimentation settings
 */
async function handleSaveExperimentationSettings() {
    const statusDiv = document.getElementById('experimentation-status');

    const settings = {
        'experimentation.enabled': document.getElementById('experimentation-enabled')?.checked ?? true,
        'experimentation.dry_threshold': parseInt(document.getElementById('experimentation-dry-threshold')?.value || '3', 10),
        'experimentation.batch_size': parseInt(document.getElementById('experimentation-batch-size')?.value || '7', 10)
    };

    try {
        await api.updateSettings(settings);

        if (appState) {
            Object.assign(appState.settings, settings);
        }

        if (statusDiv) {
            statusDiv.className = 'mt-2 text-sm text-green-400';
            statusDiv.textContent = 'Experimentation settings saved!';
            setTimeout(() => { statusDiv.textContent = ''; }, 3000);
        }

    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-2 text-sm text-red-400';
            statusDiv.textContent = 'Failed to save: ' + error.message;
        }
    }
}

/**
 * Load and display dry cycle status
 */
async function loadDryCycleStatus() {
    const container = document.getElementById('experimentation-dry-status');
    if (!container) return;

    try {
        const status = await api.getStatus();
        const exp = status.scheduler?.experimentation;

        if (!exp) {
            container.textContent = 'Status unavailable';
            return;
        }

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const row = createElement('div', '', 'flex items-center justify-between');

        const leftSide = createElement('div', '', 'flex items-center gap-2');

        // Status indicator dot
        const dotColor = exp.willTrigger ? 'bg-yellow-400' : exp.dryCount > 0 ? 'bg-orange-400' : 'bg-green-400';
        const dot = createElement('span', '', `w-2 h-2 rounded-full ${dotColor}`);
        leftSide.appendChild(dot);

        // Status text
        let statusText;
        if (exp.willTrigger) {
            statusText = 'Will generate keywords on next check';
        } else if (exp.dryCount > 0) {
            statusText = `${exp.dryCount} dry cycle${exp.dryCount > 1 ? 's' : ''} (triggers at ${exp.dryThreshold})`;
        } else {
            statusText = 'Discovery finding content';
        }
        const text = createElement('span', statusText, 'text-sm text-gray-300');
        leftSide.appendChild(text);

        row.appendChild(leftSide);

        // Counter badge
        const badge = createElement('span', `${exp.dryCount}/${exp.dryThreshold}`,
            'text-xs px-2 py-1 rounded bg-gray-700 text-gray-400');
        row.appendChild(badge);

        container.appendChild(row);

    } catch (error) {
        container.textContent = 'Failed to load status';
        container.className = 'bg-gray-800 rounded p-3 mb-4 text-sm text-red-400';
    }
}

/**
 * Handle trigger experimentation
 */
async function handleTriggerExperimentation() {
    const statusDiv = document.getElementById('experimentation-status');
    const triggerBtn = document.getElementById('trigger-experimentation-btn');

    // Show loading state
    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'Generating...';
        triggerBtn.className = 'bg-gray-600 text-gray-300 px-4 py-2 rounded cursor-not-allowed';
    }

    if (statusDiv) {
        statusDiv.className = 'mt-2 text-sm text-gray-400';
        statusDiv.textContent = 'Generating experimental keywords...';
    }

    try {
        const result = await api.triggerExperimentation();

        if (result.success) {
            const count = result.results?.generated?.length || 0;
            const strategy = result.results?.strategy || 'unknown';

            if (statusDiv) {
                statusDiv.className = 'mt-2 text-sm text-green-400';
                statusDiv.textContent = `Generated ${count} keywords using ${strategy} strategy. Check Keywords page to see them.`;
            }

            // Refresh dry cycle status (it resets to 0 after generating)
            loadDryCycleStatus();
        } else {
            if (statusDiv) {
                statusDiv.className = 'mt-2 text-sm text-red-400';
                statusDiv.textContent = result.message || 'Failed to generate keywords';
            }
        }
    } catch (error) {
        if (statusDiv) {
            statusDiv.className = 'mt-2 text-sm text-red-400';
            statusDiv.textContent = 'Error: ' + error.message;
        }
    } finally {
        // Reset button
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.textContent = 'Generate Keywords Now';
            triggerBtn.className = 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded';
        }
    }
}

// ============================================
// API Keys Tab
// ============================================

// State for API keys form
let apiKeysState = {
    x: {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessSecret: '',
        status: null,      // null | 'validating' | 'success' | 'error'
        error: null,
        details: null
    },
    xai: {
        apiKey: '',
        status: null,
        error: null,
        details: null
    }
};

/**
 * Render API Keys tab
 */
async function renderApiKeysTab(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    // X API Section
    const xSection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6');

    const xTitle = createElement('h3', 'X API Credentials', 'text-lg font-semibold mb-2');
    xSection.appendChild(xTitle);

    const xDesc = createElement('p', '', 'text-sm text-gray-500 mb-4');
    xDesc.appendChild(document.createTextNode('Required for searching tweets and posting replies. Get credentials from '));
    const xLink = document.createElement('a');
    xLink.href = 'https://developer.x.com';
    xLink.target = '_blank';
    xLink.rel = 'noopener';
    xLink.className = 'text-x-blue hover:underline';
    xLink.textContent = 'developer.x.com';
    xDesc.appendChild(xLink);
    xSection.appendChild(xDesc);

    const xForm = createElement('div', '', 'space-y-4');

    // X API Key
    xForm.appendChild(createApiInputGroup('API Key', 'x-api-key', 'text',
        apiKeysState.x.apiKey, 'Enter your X API Key',
        (val) => { apiKeysState.x.apiKey = val; }
    ));

    // X API Secret
    xForm.appendChild(createApiInputGroup('API Secret', 'x-api-secret', 'password',
        apiKeysState.x.apiSecret, 'Enter your X API Secret',
        (val) => { apiKeysState.x.apiSecret = val; }
    ));

    // X Access Token
    xForm.appendChild(createApiInputGroup('Access Token', 'x-access-token', 'text',
        apiKeysState.x.accessToken, 'Enter your Access Token',
        (val) => { apiKeysState.x.accessToken = val; }
    ));

    // X Access Secret
    xForm.appendChild(createApiInputGroup('Access Secret', 'x-access-secret', 'password',
        apiKeysState.x.accessSecret, 'Enter your Access Secret',
        (val) => { apiKeysState.x.accessSecret = val; }
    ));

    xSection.appendChild(xForm);

    // X validation status
    const xStatus = createElement('div', '', 'mt-4');
    xStatus.id = 'x-validation-status';
    renderApiValidationStatus(xStatus, 'x');
    xSection.appendChild(xStatus);

    // X save button
    const xBtnRow = createElement('div', '', 'mt-4');
    const xSaveBtn = createElement('button', 'Validate & Save',
        'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded'
    );
    xSaveBtn.id = 'x-save-btn';
    xSaveBtn.addEventListener('click', handleSaveXCredentials);
    xBtnRow.appendChild(xSaveBtn);
    xSection.appendChild(xBtnRow);

    container.appendChild(xSection);

    // xAI API Section
    const xaiSection = createElement('div', '', 'bg-gray-900 border border-gray-800 rounded-lg p-6');

    const xaiTitle = createElement('h3', 'xAI API Key', 'text-lg font-semibold mb-2');
    xaiSection.appendChild(xaiTitle);

    const xaiDesc = createElement('p', '', 'text-sm text-gray-500 mb-4');
    xaiDesc.appendChild(document.createTextNode('Required for semantic scoring and reply generation. Get your key from '));
    const xaiLink = document.createElement('a');
    xaiLink.href = 'https://console.x.ai';
    xaiLink.target = '_blank';
    xaiLink.rel = 'noopener';
    xaiLink.className = 'text-x-blue hover:underline';
    xaiLink.textContent = 'console.x.ai';
    xaiDesc.appendChild(xaiLink);
    xaiSection.appendChild(xaiDesc);

    const xaiForm = createElement('div', '', 'space-y-4');

    // xAI API Key
    xaiForm.appendChild(createApiInputGroup('API Key', 'xai-api-key', 'password',
        apiKeysState.xai.apiKey, 'Enter your xAI API Key',
        (val) => { apiKeysState.xai.apiKey = val; }
    ));

    xaiSection.appendChild(xaiForm);

    // xAI validation status
    const xaiStatus = createElement('div', '', 'mt-4');
    xaiStatus.id = 'xai-validation-status';
    renderApiValidationStatus(xaiStatus, 'xai');
    xaiSection.appendChild(xaiStatus);

    // xAI save button
    const xaiBtnRow = createElement('div', '', 'mt-4');
    const xaiSaveBtn = createElement('button', 'Validate & Save',
        'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded'
    );
    xaiSaveBtn.id = 'xai-save-btn';
    xaiSaveBtn.addEventListener('click', handleSaveXaiCredentials);
    xaiBtnRow.appendChild(xaiSaveBtn);
    xaiSection.appendChild(xaiBtnRow);

    container.appendChild(xaiSection);

    // Security note
    const secNote = createElement('div', '', 'mt-6 p-3 bg-gray-800 rounded-lg border border-gray-700 flex items-start gap-2');
    const infoIcon = createElement('span', '\u24D8', 'text-gray-400');
    secNote.appendChild(infoIcon);
    const secText = createElement('span', '', 'text-sm text-gray-400');
    secText.appendChild(document.createTextNode('Your API keys are stored locally. For encryption at rest, set '));
    const secCode = createElement('code', 'MASTER_KEY', 'text-gray-300 bg-gray-700 px-1 rounded');
    secText.appendChild(secCode);
    secText.appendChild(document.createTextNode(' in your .env file.'));
    secNote.appendChild(secText);
    container.appendChild(secNote);
}

/**
 * Create an input group for API keys
 */
function createApiInputGroup(label, id, type, value, placeholder, onChange) {
    const group = createElement('div', '', '');

    const labelEl = createElement('label', label, 'block text-gray-400 text-sm mb-1');
    labelEl.htmlFor = id;
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.value = value || '';
    input.placeholder = placeholder;
    input.className = 'w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-x-blue focus:ring-1 focus:ring-x-blue';
    input.addEventListener('input', (e) => onChange(e.target.value));
    group.appendChild(input);

    return group;
}

/**
 * Render validation status for API keys
 */
function renderApiValidationStatus(container, type) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const state = apiKeysState[type];
    if (!state.status) return;

    const statusDiv = createElement('div', '', 'rounded-lg p-3 flex items-center gap-2');

    if (state.status === 'validating') {
        statusDiv.className += ' bg-gray-800 border border-gray-700';
        const spinner = createElement('span', '\u23F3', 'text-gray-400');
        statusDiv.appendChild(spinner);
        const text = createElement('span', 'Validating...', 'text-gray-400');
        statusDiv.appendChild(text);
    } else if (state.status === 'success') {
        statusDiv.className += ' bg-green-900/50 border border-green-700';
        const checkmark = createElement('span', '\u2713', 'text-green-400');
        statusDiv.appendChild(checkmark);
        let successText = 'Connected successfully';
        if (type === 'x' && state.details?.username) {
            successText += ` as @${state.details.username}`;
        } else if (type === 'xai' && state.details?.modelsAvailable) {
            successText += ` (${state.details.modelsAvailable} models available)`;
        }
        const text = createElement('span', successText, 'text-green-400');
        statusDiv.appendChild(text);
    } else if (state.status === 'error') {
        statusDiv.className += ' bg-red-900/50 border border-red-700';
        const xmark = createElement('span', '\u2717', 'text-red-400');
        statusDiv.appendChild(xmark);
        const errorText = state.error || 'Validation failed';
        const text = createElement('span', errorText, 'text-red-400');
        statusDiv.appendChild(text);
    }

    container.appendChild(statusDiv);
}

/**
 * Handle save X credentials
 */
async function handleSaveXCredentials() {
    const { apiKey, apiSecret, accessToken, accessSecret } = apiKeysState.x;

    // Basic validation
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        apiKeysState.x.status = 'error';
        apiKeysState.x.error = 'All four credentials are required';
        const statusContainer = document.getElementById('x-validation-status');
        if (statusContainer) renderApiValidationStatus(statusContainer, 'x');
        return;
    }

    // Show validating state
    apiKeysState.x.status = 'validating';
    const statusContainer = document.getElementById('x-validation-status');
    if (statusContainer) renderApiValidationStatus(statusContainer, 'x');

    // Disable button
    const saveBtn = document.getElementById('x-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Validating...';
        saveBtn.className = 'bg-gray-600 text-gray-300 px-4 py-2 rounded cursor-not-allowed';
    }

    try {
        const result = await api.validateCredentials('x', {
            apiKey,
            apiSecret,
            accessToken,
            accessSecret
        });

        if (result.valid) {
            // Save credentials
            await api.saveCredentials('x', {
                apiKey,
                apiSecret,
                accessToken,
                accessSecret
            });

            apiKeysState.x.status = 'success';
            apiKeysState.x.details = result.details;
            if (statusContainer) renderApiValidationStatus(statusContainer, 'x');
        } else {
            apiKeysState.x.status = 'error';
            apiKeysState.x.error = result.error;
            if (statusContainer) renderApiValidationStatus(statusContainer, 'x');
        }
    } catch (error) {
        apiKeysState.x.status = 'error';
        apiKeysState.x.error = error.message || 'Failed to validate credentials';
        if (statusContainer) renderApiValidationStatus(statusContainer, 'x');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Validate & Save';
            saveBtn.className = 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded';
        }
    }
}

/**
 * Handle save xAI credentials
 */
async function handleSaveXaiCredentials() {
    const { apiKey } = apiKeysState.xai;

    // Basic validation
    if (!apiKey) {
        apiKeysState.xai.status = 'error';
        apiKeysState.xai.error = 'API key is required';
        const statusContainer = document.getElementById('xai-validation-status');
        if (statusContainer) renderApiValidationStatus(statusContainer, 'xai');
        return;
    }

    // Show validating state
    apiKeysState.xai.status = 'validating';
    const statusContainer = document.getElementById('xai-validation-status');
    if (statusContainer) renderApiValidationStatus(statusContainer, 'xai');

    // Disable button
    const saveBtn = document.getElementById('xai-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Validating...';
        saveBtn.className = 'bg-gray-600 text-gray-300 px-4 py-2 rounded cursor-not-allowed';
    }

    try {
        const result = await api.validateCredentials('xai', { apiKey });

        if (result.valid) {
            // Save credentials
            await api.saveCredentials('xai', { apiKey });

            apiKeysState.xai.status = 'success';
            apiKeysState.xai.details = result.details;
            if (statusContainer) renderApiValidationStatus(statusContainer, 'xai');
        } else {
            apiKeysState.xai.status = 'error';
            apiKeysState.xai.error = result.error;
            if (statusContainer) renderApiValidationStatus(statusContainer, 'xai');
        }
    } catch (error) {
        apiKeysState.xai.status = 'error';
        apiKeysState.xai.error = error.message || 'Failed to validate API key';
        if (statusContainer) renderApiValidationStatus(statusContainer, 'xai');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Validate & Save';
            saveBtn.className = 'bg-x-blue hover:bg-blue-600 text-white px-4 py-2 rounded';
        }
    }
}
