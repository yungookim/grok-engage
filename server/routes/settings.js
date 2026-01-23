import { Router } from 'express';
import {
    getSettings,
    getSetting,
    setSetting,
    getKeywords,
    addKeyword,
    deleteKeyword,
    toggleKeyword,
    getKeywordStats,
    getRecentKeywordChanges,
    logKeywordChange,
    getProductProfiles,
    getProductProfile,
    createProductProfile,
    updateProductProfile,
    deleteProductProfile
} from '../db/db.js';
import config from '../config.js';
import { getUsageStats, validateCredentials as validateXCredentials, resetClient as resetXClient, hasCredentials as hasXCredentials } from '../services/x-api.js';
import { validateApiKey as validateXaiKey, resetClient as resetLlmClient, hasApiKey as hasXaiKey, extractProductProfile } from '../services/llm.js';
import { generateKeywordsForProfile } from '../services/keyword-generator.js';
import { getSchedulerStatus, triggerDiscovery, triggerExperimentation, restartScheduler } from '../services/scheduler.js';
import { processBrowserTweets } from '../services/browser-discovery.js';

const router = Router();

// ============================================
// Settings Routes
// ============================================

/**
 * GET /api/settings
 * Get all application settings
 */
router.get('/', (req, res) => {
    try {
        const settings = getSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * PUT /api/settings
 * Update settings (bulk update)
 *
 * Body: { key: value, ... }
 */
router.put('/', async (req, res) => {
    try {
        const updates = req.body;

        if (!updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Request body must be an object with settings' });
        }

        // Validate and update each setting
        for (const [key, value] of Object.entries(updates)) {
            // Basic validation - skip if key is empty
            if (!key || typeof key !== 'string') continue;

            setSetting(key, value);
        }

        // If monitoring settings changed, restart scheduler
        if ('monitoring.enabled' in updates ||
            'monitoring.interval_minutes' in updates) {
            await restartScheduler();
        }

        res.json({
            success: true,
            settings: getSettings()
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * GET /api/settings/status
 * Get system status (scheduler, API usage)
 */
router.get('/status', (req, res) => {
    try {
        res.json({
            scheduler: getSchedulerStatus(),
            apiUsage: getUsageStats()
        });
    } catch (error) {
        console.error('Error fetching status:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

/**
 * POST /api/settings/trigger-discovery
 * Manually trigger a discovery cycle
 */
router.post('/trigger-discovery', async (req, res) => {
    try {
        const result = await triggerDiscovery();
        res.json(result);
    } catch (error) {
        console.error('Error triggering discovery:', error);
        res.status(500).json({ error: 'Failed to trigger discovery' });
    }
});

/**
 * POST /api/settings/trigger-experimentation
 * Manually trigger keyword experimentation
 */
router.post('/trigger-experimentation', async (req, res) => {
    try {
        const result = await triggerExperimentation();
        res.json(result);
    } catch (error) {
        console.error('Error triggering experimentation:', error);
        res.status(500).json({ error: 'Failed to trigger experimentation' });
    }
});

/**
 * POST /api/settings/browser-discovery
 * Process tweets scraped via browser automation
 * This bypasses X API rate limits by accepting data from Claude-in-Chrome
 *
 * Body:
 * - tweets: array of scraped tweet objects
 * - keyword: string - the keyword that was searched
 */
router.post('/browser-discovery', async (req, res) => {
    try {
        const { tweets, keyword } = req.body;

        if (!tweets || !Array.isArray(tweets)) {
            return res.status(400).json({ error: 'tweets array is required' });
        }

        if (!keyword || typeof keyword !== 'string') {
            return res.status(400).json({ error: 'keyword string is required' });
        }

        console.log(`[BrowserDiscovery] Received ${tweets.length} tweets for keyword "${keyword}"`);

        const results = await processBrowserTweets(tweets, keyword);

        res.json({
            success: true,
            ...results
        });
    } catch (error) {
        console.error('Error processing browser discovery:', error);
        res.status(500).json({ error: 'Failed to process browser discovery' });
    }
});

/**
 * GET /api/settings/config-status
 * Check if the app is properly configured
 * Returns what's missing and any warnings
 */
router.get('/config-status', (req, res) => {
    try {
        const missing = [];
        const warnings = [];

        // Check X API credentials (checks both env vars and database)
        if (!hasXCredentials()) {
            missing.push('x_api');
        }

        // Check xAI API key (checks both env vars and database)
        if (!hasXaiKey()) {
            missing.push('xai_api');
        }

        // Check for keywords (warning, not required for setup)
        const keywords = getKeywords(true);
        if (keywords.length === 0) {
            warnings.push('no_keywords');
        }

        // Check for product profiles (warning, not required for setup)
        const profiles = getProductProfiles(true);
        if (profiles.length === 0) {
            warnings.push('no_product_profile');
        }

        res.json({
            isConfigured: missing.length === 0,
            missing,
            warnings
        });
    } catch (error) {
        console.error('Error checking config status:', error);
        res.status(500).json({ error: 'Failed to check config status' });
    }
});

/**
 * POST /api/settings/validate-credentials
 * Validate API credentials without saving them
 *
 * Body:
 * - type: 'x' | 'xai'
 * - credentials: object with appropriate keys
 */
router.post('/validate-credentials', async (req, res) => {
    try {
        const { type, credentials } = req.body;

        if (!type || !['x', 'xai'].includes(type)) {
            return res.status(400).json({
                error: 'type must be "x" or "xai"'
            });
        }

        if (!credentials || typeof credentials !== 'object') {
            return res.status(400).json({
                error: 'credentials object is required'
            });
        }

        let result;

        if (type === 'x') {
            result = await validateXCredentials(credentials);
        } else {
            result = await validateXaiKey(credentials.apiKey, credentials.baseUrl);
        }

        res.json(result);
    } catch (error) {
        console.error('Error validating credentials:', error);
        res.status(500).json({
            valid: false,
            error: 'Failed to validate credentials',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/settings/save-credentials
 * Save validated API credentials
 * This updates the settings and resets the API clients
 *
 * Body:
 * - type: 'x' | 'xai'
 * - credentials: object with appropriate keys
 */
router.post('/save-credentials', async (req, res) => {
    try {
        const { type, credentials } = req.body;

        if (!type || !['x', 'xai'].includes(type)) {
            return res.status(400).json({ error: 'type must be "x" or "xai"' });
        }

        if (type === 'x') {
            const { apiKey, apiSecret, accessToken, accessSecret } = credentials;

            if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
                return res.status(400).json({ error: 'All four X API credentials are required' });
            }

            // Save to settings (these will be read by config on next restart)
            // For now, we store them in the settings table
            setSetting('credentials.x_api_key', apiKey);
            setSetting('credentials.x_api_secret', apiSecret);
            setSetting('credentials.x_access_token', accessToken);
            setSetting('credentials.x_access_secret', accessSecret);

            // Reset the X API client so it picks up new credentials
            resetXClient();

        } else {
            const { apiKey, baseUrl } = credentials;

            if (!apiKey) {
                return res.status(400).json({ error: 'xAI API key is required' });
            }

            setSetting('credentials.xai_api_key', apiKey);
            if (baseUrl) {
                setSetting('credentials.xai_base_url', baseUrl);
            }

            // Reset the LLM client
            resetLlmClient();
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving credentials:', error);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

// ============================================
// Keywords Routes
// ============================================

/**
 * GET /api/settings/keywords
 * List all keywords
 *
 * Query params:
 * - active_only: boolean (default true)
 */
router.get('/keywords', (req, res) => {
    try {
        const activeOnly = req.query.active_only !== 'false';
        const keywords = getKeywords(activeOnly);
        res.json({ keywords });
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: 'Failed to fetch keywords' });
    }
});

/**
 * POST /api/settings/keywords
 * Add a new keyword
 *
 * Body:
 * - keyword: string (required)
 * - category: string (optional) - one of: pain-point, tool-discovery, building-in-public, custom
 */
router.post('/keywords', (req, res) => {
    try {
        const { keyword, category = 'custom' } = req.body;

        // Validate keyword
        if (!keyword || typeof keyword !== 'string') {
            return res.status(400).json({ error: 'keyword is required and must be a string' });
        }

        const trimmedKeyword = keyword.trim();
        if (trimmedKeyword.length < 2) {
            return res.status(400).json({ error: 'keyword must be at least 2 characters' });
        }

        // Validate category
        const validCategories = ['pain-point', 'tool-discovery', 'building-in-public', 'custom'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                error: 'Invalid category',
                valid_categories: validCategories
            });
        }

        const result = addKeyword(trimmedKeyword, category);

        res.status(201).json({
            id: result.lastInsertRowid,
            keyword: trimmedKeyword,
            category,
            is_active: true
        });
    } catch (error) {
        console.error('Error adding keyword:', error);

        if (error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Keyword already exists' });
        }

        res.status(500).json({ error: 'Failed to add keyword' });
    }
});

/**
 * PUT /api/settings/keywords/:id
 * Toggle keyword active status
 *
 * Body:
 * - is_active: boolean (required)
 */
router.put('/keywords/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid keyword ID' });
        }

        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active must be a boolean' });
        }

        toggleKeyword(id, is_active);
        res.json({ success: true, id, is_active });
    } catch (error) {
        console.error('Error updating keyword:', error);
        res.status(500).json({ error: 'Failed to update keyword' });
    }
});

/**
 * DELETE /api/settings/keywords/:id
 * Delete a keyword
 */
router.delete('/keywords/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid keyword ID' });
        }

        deleteKeyword(id);
        res.json({ success: true, message: 'Keyword deleted' });
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).json({ error: 'Failed to delete keyword' });
    }
});

/**
 * GET /api/settings/keywords/stats
 * Get keyword performance statistics
 */
router.get('/keywords/stats', (req, res) => {
    try {
        const stats = getKeywordStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching keyword stats:', error);
        res.status(500).json({ error: 'Failed to fetch keyword stats' });
    }
});

/**
 * GET /api/settings/keywords/changes
 * Get recent keyword changes for notifications
 *
 * Query params:
 * - days: number (default 7)
 */
router.get('/keywords/changes', (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 7;
        const changes = getRecentKeywordChanges(days);
        res.json({ changes });
    } catch (error) {
        console.error('Error fetching keyword changes:', error);
        res.status(500).json({ error: 'Failed to fetch keyword changes' });
    }
});

/**
 * POST /api/settings/keywords/dismiss-changes
 * Dismiss keyword change notifications
 */
router.post('/keywords/dismiss-changes', (req, res) => {
    try {
        setSetting('keywords.last_dismissed', new Date().toISOString());
        res.json({ success: true });
    } catch (error) {
        console.error('Error dismissing changes:', error);
        res.status(500).json({ error: 'Failed to dismiss changes' });
    }
});

// ============================================
// Product Profiles Routes
// ============================================

/**
 * POST /api/settings/profiles/generate
 * Generate a product profile from a website URL
 *
 * Body:
 * - url: string (required) - The website URL to extract profile from
 */
router.post('/profiles/generate', async (req, res) => {
    try {
        let { url } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'url is required' });
        }

        // Clean and validate URL
        url = url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        // Validate URL format
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        // Fetch website content
        let html;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ProductProfileBot/1.0)'
                }
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return res.status(400).json({
                    error: `Couldn't access website (HTTP ${response.status})`
                });
            }

            html = await response.text();
        } catch (fetchError) {
            if (fetchError.name === 'AbortError') {
                return res.status(400).json({ error: 'Website took too long to respond' });
            }
            return res.status(400).json({
                error: 'Couldn\'t access that website. Check the URL and try again.'
            });
        }

        // Extract text content from HTML
        const textContent = extractTextFromHtml(html, url);

        if (textContent.length < 50) {
            return res.status(400).json({
                error: 'Couldn\'t extract enough content from the website'
            });
        }

        // Use LLM to extract profile data
        let profileData;
        try {
            profileData = await extractProductProfile(textContent, url);
        } catch (llmError) {
            console.error('LLM extraction failed:', llmError);
            return res.status(500).json({
                error: 'Couldn\'t extract product info. Try manual entry.'
            });
        }

        // Validate required field
        if (!profileData.name) {
            // Fallback to domain name
            const urlObj = new URL(url);
            profileData.name = urlObj.hostname.replace('www.', '');
        }

        // Ensure arrays are arrays
        profileData.problems_solved = Array.isArray(profileData.problems_solved) ? profileData.problems_solved : [];
        profileData.target_audience = Array.isArray(profileData.target_audience) ? profileData.target_audience : [];
        profileData.relevant_keywords = Array.isArray(profileData.relevant_keywords) ? profileData.relevant_keywords : [];
        profileData.tone_keywords = Array.isArray(profileData.tone_keywords) ? profileData.tone_keywords : [];

        // Add the source URL
        profileData.url = url;

        // Create the profile in database
        const result = createProductProfile(profileData);
        const profileId = result.lastInsertRowid;

        // Generate keywords from the profile (async, don't block response)
        generateKeywordsForProfile({ ...profileData, id: profileId }, profileId)
            .catch(err => console.error('Background keyword generation failed:', err));

        res.status(201).json({
            success: true,
            profile: {
                id: profileId,
                ...profileData,
                is_active: true
            }
        });

    } catch (error) {
        console.error('Error generating profile:', error);
        res.status(500).json({ error: 'Failed to generate profile' });
    }
});

/**
 * Extract meaningful text content from HTML
 */
function extractTextFromHtml(html, url) {
    // Remove scripts, styles, and comments
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

    // Extract title
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract meta description
    const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
        || text.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDesc = metaDescMatch ? metaDescMatch[1].trim() : '';

    // Extract og:description as fallback
    const ogDescMatch = text.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
        || text.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : '';

    // Remove all HTML tags and decode entities
    text = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    // Combine with priority content at the start
    const priorityContent = [title, metaDesc || ogDesc].filter(Boolean).join('. ');
    const combined = priorityContent + '\n\n' + text;

    // Limit to ~4000 characters to stay within token limits
    return combined.slice(0, 4000);
}

/**
 * GET /api/settings/profiles
 * List all product profiles
 *
 * Query params:
 * - active_only: boolean (default true)
 */
router.get('/profiles', (req, res) => {
    try {
        const activeOnly = req.query.active_only !== 'false';
        const profiles = getProductProfiles(activeOnly);
        res.json({ profiles });
    } catch (error) {
        console.error('Error fetching profiles:', error);
        res.status(500).json({ error: 'Failed to fetch profiles' });
    }
});

/**
 * GET /api/settings/profiles/:id
 * Get a single product profile
 */
router.get('/profiles/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid profile ID' });
        }

        const profile = getProductProfile(id);
        if (!profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * POST /api/settings/profiles
 * Create a new product profile
 *
 * Body:
 * - name: string (required)
 * - one_liner: string
 * - problems_solved: string[]
 * - target_audience: string[]
 * - relevant_keywords: string[]
 * - tone_keywords: string[]
 * - when_to_mention: string
 * - when_not_to_mention: string
 * - url: string
 */
router.post('/profiles', async (req, res) => {
    try {
        const profile = req.body;

        // Validate name
        if (!profile.name || typeof profile.name !== 'string') {
            return res.status(400).json({ error: 'name is required and must be a string' });
        }

        const result = createProductProfile(profile);
        const profileId = result.lastInsertRowid;

        // Generate keywords from the profile (async, don't block response)
        generateKeywordsForProfile({ ...profile, id: profileId }, profileId)
            .catch(err => console.error('Background keyword generation failed:', err));

        res.status(201).json({
            id: profileId,
            ...profile,
            is_active: true
        });
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ error: 'Failed to create profile' });
    }
});

/**
 * PUT /api/settings/profiles/:id
 * Update a product profile
 */
router.put('/profiles/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid profile ID' });
        }

        const existing = getProductProfile(id);
        if (!existing) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const profile = req.body;

        // Validate name if provided
        if (profile.name !== undefined && (!profile.name || typeof profile.name !== 'string')) {
            return res.status(400).json({ error: 'name must be a non-empty string' });
        }

        updateProductProfile(id, { ...existing, ...profile });

        res.json({
            id,
            ...getProductProfile(id)
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * DELETE /api/settings/profiles/:id
 * Delete a product profile
 */
router.delete('/profiles/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id) || id < 1) {
            return res.status(400).json({ error: 'Invalid profile ID' });
        }

        const existing = getProductProfile(id);
        if (!existing) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        deleteProductProfile(id);
        res.json({ success: true, message: 'Profile deleted' });
    } catch (error) {
        console.error('Error deleting profile:', error);
        res.status(500).json({ error: 'Failed to delete profile' });
    }
});

export default router;
