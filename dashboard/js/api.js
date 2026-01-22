/**
 * API Client Module
 * Handles all communication with the backend server
 */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    // Don't set Content-Type for GET requests without body
    if (options.method === undefined || options.method === 'GET') {
        delete config.body;
    } else if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// ============================================
// Health
// ============================================

export async function getHealth() {
    return request('/health');
}

// ============================================
// Threads
// ============================================

export async function getThreads({ status, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    return request(`/threads?${params}`);
}

export async function getThread(id) {
    return request(`/threads/${id}`);
}

export async function markThreadViewed(id) {
    return request(`/threads/${id}/view`, { method: 'POST' });
}

export async function markThreadSkipped(id) {
    return request(`/threads/${id}/skip`, { method: 'POST' });
}

export async function deleteThread(id) {
    return request(`/threads/${id}`, { method: 'DELETE' });
}

// ============================================
// Replies
// ============================================

export async function generateReply(threadId, options = {}) {
    return request('/replies/generate', {
        method: 'POST',
        body: {
            thread_id: threadId,
            product_profile_id: options.productProfileId,
            instruction: options.instruction
        }
    });
}

export async function regenerateReply(threadId, regenOption, instruction = null) {
    return request('/replies/regenerate', {
        method: 'POST',
        body: {
            thread_id: threadId,
            regen_option: regenOption,
            instruction
        }
    });
}

export async function editReply(replyId, text) {
    return request(`/replies/${replyId}/edit`, {
        method: 'POST',
        body: { text }
    });
}

export async function postReply(replyId) {
    return request(`/replies/${replyId}/post`, { method: 'POST' });
}

export async function getReplies({ threadId, posted, limit = 20, offset = 0 } = {}) {
    const params = new URLSearchParams();
    if (threadId) params.set('thread_id', String(threadId));
    if (posted !== undefined) params.set('posted', String(posted));
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    return request(`/replies?${params}`);
}

export async function getReply(id) {
    return request(`/replies/${id}`);
}

export async function getRegenOptions() {
    return request('/replies/options');
}

// ============================================
// Analytics
// ============================================

export async function getAnalyticsSummary() {
    return request('/analytics/summary');
}

export async function getInsights() {
    return request('/analytics/insights');
}

export async function getPatterns(type) {
    const params = type ? `?type=${type}` : '';
    return request(`/analytics/patterns${params}`);
}

export async function getApiUsage() {
    return request('/analytics/api-usage');
}

export async function getOutcomes() {
    return request('/analytics/outcomes');
}

// ============================================
// Settings
// ============================================

export async function getSettings() {
    return request('/settings');
}

export async function updateSettings(settings) {
    return request('/settings', {
        method: 'PUT',
        body: settings
    });
}

export async function getStatus() {
    return request('/settings/status');
}

export async function triggerDiscovery() {
    return request('/settings/trigger-discovery', { method: 'POST' });
}

export async function triggerExperimentation() {
    return request('/settings/trigger-experimentation', { method: 'POST' });
}

// ============================================
// Keywords
// ============================================

export async function getKeywords(activeOnly = true) {
    return request(`/settings/keywords?active_only=${activeOnly}`);
}

export async function addKeyword(keyword, category = 'custom') {
    return request('/settings/keywords', {
        method: 'POST',
        body: { keyword, category }
    });
}

export async function toggleKeyword(id, isActive) {
    return request(`/settings/keywords/${id}`, {
        method: 'PUT',
        body: { is_active: isActive }
    });
}

export async function deleteKeyword(id) {
    return request(`/settings/keywords/${id}`, { method: 'DELETE' });
}

export async function getKeywordStats() {
    return request('/settings/keywords/stats');
}

export async function getKeywordChanges(days = 7) {
    return request(`/settings/keywords/changes?days=${days}`);
}

export async function dismissKeywordChanges() {
    return request('/settings/keywords/dismiss-changes', { method: 'POST' });
}

// ============================================
// Product Profiles
// ============================================

export async function getProfiles(activeOnly = true) {
    return request(`/settings/profiles?active_only=${activeOnly}`);
}

export async function getProfile(id) {
    return request(`/settings/profiles/${id}`);
}

export async function createProfile(profile) {
    return request('/settings/profiles', {
        method: 'POST',
        body: profile
    });
}

export async function generateProfileFromUrl(url) {
    return request('/settings/profiles/generate', {
        method: 'POST',
        body: { url }
    });
}

export async function updateProfile(id, profile) {
    return request(`/settings/profiles/${id}`, {
        method: 'PUT',
        body: profile
    });
}

export async function deleteProfile(id) {
    return request(`/settings/profiles/${id}`, { method: 'DELETE' });
}

// ============================================
// Configuration & Credentials
// ============================================

export async function getConfigStatus() {
    return request('/settings/config-status');
}

export async function validateCredentials(type, credentials) {
    return request('/settings/validate-credentials', {
        method: 'POST',
        body: { type, credentials }
    });
}

export async function saveCredentials(type, credentials) {
    return request('/settings/save-credentials', {
        method: 'POST',
        body: { type, credentials }
    });
}

// ============================================
// Activity Log
// ============================================

export async function getActivityLogs({ limit = 100, offset = 0, type = null, sessionId = null, since = null } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (type) params.set('type', type);
    if (sessionId) params.set('sessionId', sessionId);
    if (since) params.set('since', since);

    return request(`/activity/logs?${params}`);
}

export async function getScannedTweets({ limit = 50, offset = 0, status = null, sessionId = null } = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (status) params.set('status', status);
    if (sessionId) params.set('sessionId', sessionId);

    return request(`/activity/scanned?${params}`);
}

export async function getActivityStats() {
    return request('/activity/stats');
}

export async function getLogTypes() {
    return request('/activity/log-types');
}
