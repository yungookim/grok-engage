/**
 * Keyword Generator Service
 * Handles automatic keyword generation from profiles and refinement based on engagement
 */

import {
    addKeyword,
    keywordExists,
    getKeywords,
    toggleKeyword,
    getUnderperformingKeywords,
    logKeywordChange,
    logKeywordExperiment,
    updateExperimentOutcome,
    cleanupFailedExperiments,
    getActiveProductProfiles,
    getSetting,
    setSetting,
    getDb
} from '../db/db.js';
import { generateKeywordsFromProfile, discoverKeywordsFromThreads, generateExperimentalKeywords } from './llm.js';

const STRATEGIES = ['semantic', 'pattern', 'trend'];

const MAX_KEYWORDS_PER_DAY = 5;

/**
 * Generate keywords from a newly created product profile
 * @param {object} profile - The product profile
 * @param {number} profileId - The profile ID
 * @returns {Promise<object>} Results of keyword generation
 */
export async function generateKeywordsForProfile(profile, profileId) {
    const results = {
        generated: [],
        skipped: [],
        errors: []
    };

    try {
        // Generate keywords using LLM
        const keywords = await generateKeywordsFromProfile(profile);

        for (const keyword of keywords) {
            const trimmed = keyword.trim().toLowerCase();

            // Skip if too short or already exists
            if (trimmed.length < 3) {
                results.skipped.push({ keyword: trimmed, reason: 'too short' });
                continue;
            }

            if (keywordExists(trimmed)) {
                results.skipped.push({ keyword: trimmed, reason: 'already exists' });
                continue;
            }

            try {
                // Add the keyword
                const result = addKeyword(trimmed, 'auto-generated', profileId);
                const keywordId = result.lastInsertRowid;

                // Log the change
                logKeywordChange(keywordId, trimmed, 'added', `auto-generated from profile: ${profile.name}`);

                results.generated.push(trimmed);
            } catch (error) {
                results.errors.push({ keyword: trimmed, error: error.message });
            }
        }

        console.log(`[KeywordGenerator] Generated ${results.generated.length} keywords for profile "${profile.name}"`);

    } catch (error) {
        console.error('[KeywordGenerator] Failed to generate keywords:', error);
        results.errors.push({ error: error.message });
    }

    return results;
}

/**
 * Run daily keyword refinement
 * - Disable underperforming keywords
 * - Discover new keywords from engaged threads
 * @returns {Promise<object>} Results of refinement
 */
export async function runKeywordRefinement() {
    const results = {
        disabled: [],
        discovered: [],
        errors: []
    };

    // 1. Disable underperforming keywords
    try {
        const underperforming = getUnderperformingKeywords(10, 20);

        for (const kw of underperforming) {
            try {
                toggleKeyword(kw.id, false);
                logKeywordChange(kw.id, kw.keyword, 'disabled', 'low engagement score');
                results.disabled.push(kw.keyword);

                // Mark experimental keywords as failed in experiment log
                if (kw.category === 'auto-experiment') {
                    markExperimentFailed(kw.keyword, kw.performance_score, kw.threads_matched);
                }
            } catch (error) {
                results.errors.push({ keyword: kw.keyword, error: error.message });
            }
        }

        console.log(`[KeywordGenerator] Disabled ${results.disabled.length} underperforming keywords`);
    } catch (error) {
        console.error('[KeywordGenerator] Failed to process underperforming keywords:', error);
        results.errors.push({ phase: 'disable', error: error.message });
    }

    // 2. Discover new keywords from engaged threads
    try {
        const engagedThreads = getEngagedThreadsForDiscovery();

        if (engagedThreads.length >= 3) {
            const existingKeywords = getKeywords(false); // Get all, including inactive
            const suggestions = await discoverKeywordsFromThreads(engagedThreads, existingKeywords);

            let addedCount = 0;
            for (const suggestion of suggestions) {
                if (addedCount >= MAX_KEYWORDS_PER_DAY) break;

                const trimmed = suggestion.keyword.trim().toLowerCase();

                if (trimmed.length < 3 || keywordExists(trimmed)) {
                    continue;
                }

                try {
                    const result = addKeyword(trimmed, 'auto-discovered', null);
                    const keywordId = result.lastInsertRowid;
                    logKeywordChange(keywordId, trimmed, 'added', `discovered from engaged threads: ${suggestion.reason}`);
                    results.discovered.push({ keyword: trimmed, reason: suggestion.reason });
                    addedCount++;
                } catch (error) {
                    results.errors.push({ keyword: trimmed, error: error.message });
                }
            }

            console.log(`[KeywordGenerator] Discovered ${results.discovered.length} new keywords`);
        } else {
            console.log('[KeywordGenerator] Not enough engaged threads for discovery (need 3+)');
        }
    } catch (error) {
        console.error('[KeywordGenerator] Failed to discover keywords:', error);
        results.errors.push({ phase: 'discover', error: error.message });
    }

    // 3. Cleanup old failed experiments (older than 7 days)
    try {
        const cleanup = cleanupFailedExperiments();
        if (cleanup.changes > 0) {
            console.log(`[KeywordGenerator] Cleaned up ${cleanup.changes} old failed experiments`);
        }
    } catch (error) {
        console.error('[KeywordGenerator] Failed to cleanup experiments:', error);
    }

    return results;
}

/**
 * Get threads that received engagement in the last 7 days
 * for keyword discovery analysis
 */
function getEngagedThreadsForDiscovery() {
    return getDb().prepare(`
        SELECT t.* FROM threads t
        WHERE t.status IN ('viewed', 'replied')
        AND t.updated_at >= datetime('now', '-7 days')
        ORDER BY t.updated_at DESC
        LIMIT 20
    `).all();
}

/**
 * Run keyword experimentation
 * Generates new experimental keywords when discovery runs dry
 * @returns {Promise<object>} Results of experimentation
 */
export async function runKeywordExperimentation() {
    const results = {
        generated: [],
        skipped: [],
        errors: [],
        strategy: null
    };

    try {
        // Get and rotate strategy
        const lastIndex = getSetting('experimentation.last_strategy_index') || 0;
        const strategyIndex = (lastIndex + 1) % STRATEGIES.length;
        const strategy = STRATEGIES[strategyIndex];
        results.strategy = strategy;

        // Update strategy index for next time
        setSetting('experimentation.last_strategy_index', strategyIndex);

        // Gather context
        const existingKeywords = getKeywords(false); // All keywords
        const productProfiles = getActiveProductProfiles();
        const engagedThreads = getEngagedThreadsForDiscovery();

        const batchSize = getSetting('experimentation.batch_size') || 7;

        // Generate keywords using LLM
        console.log(`[KeywordExperimentation] Generating keywords with strategy: ${strategy}`);
        const keywords = await generateExperimentalKeywords(strategy, {
            existingKeywords,
            productProfiles,
            engagedThreads
        });

        let addedCount = 0;
        for (const keyword of keywords) {
            if (addedCount >= batchSize) break;

            const trimmed = keyword.trim().toLowerCase();

            // Validate: skip too short
            if (trimmed.length < 3) {
                results.skipped.push({ keyword: trimmed, reason: 'too short' });
                continue;
            }

            // Validate: skip duplicates
            if (keywordExists(trimmed)) {
                results.skipped.push({ keyword: trimmed, reason: 'already exists' });
                continue;
            }

            try {
                // Insert with auto-experiment category and neutral score
                const insertResult = addKeyword(trimmed, 'auto-experiment', null);
                const keywordId = insertResult.lastInsertRowid;

                // Log the change
                logKeywordChange(keywordId, trimmed, 'added', `experimental (${strategy})`);

                // Log to experiment table
                logKeywordExperiment(trimmed, strategy);

                results.generated.push(trimmed);
                addedCount++;
            } catch (error) {
                results.errors.push({ keyword: trimmed, error: error.message });
            }
        }

        console.log(`[KeywordExperimentation] Generated ${results.generated.length} experimental keywords (${strategy})`);

        // Reset dry cycle count after generating
        setSetting('discovery.dry_cycle_count', 0);

    } catch (error) {
        console.error('[KeywordExperimentation] Failed:', error);
        results.errors.push({ error: error.message });
    }

    return results;
}

/**
 * Mark experimental keywords as failed and clean up
 * Called by the refinement job when auto-experiment keywords underperform
 */
export function markExperimentFailed(keyword, finalScore, threadsMatched) {
    try {
        updateExperimentOutcome(keyword, 'failed', finalScore, threadsMatched);
    } catch (error) {
        console.error(`[KeywordExperimentation] Failed to mark experiment as failed:`, error);
    }
}

/**
 * Update keyword scores based on thread engagement
 * Called when a thread is viewed or skipped
 * @param {number} threadId - The thread ID
 * @param {string} action - 'view', 'skip', or 'stale'
 */
export function updateKeywordScoresForThread(threadId, action) {
    const db = getDb();

    // Get the thread's matched keywords
    const thread = db.prepare('SELECT keyword_matches FROM threads WHERE id = ?').get(threadId);
    if (!thread || !thread.keyword_matches) return;

    let matchedKeywords;
    try {
        matchedKeywords = JSON.parse(thread.keyword_matches);
    } catch {
        return;
    }

    if (!Array.isArray(matchedKeywords) || matchedKeywords.length === 0) return;

    // Determine score adjustment
    let scoreDelta;
    switch (action) {
        case 'view':
        case 'reply':
            scoreDelta = 5;
            break;
        case 'skip':
            scoreDelta = -2;
            break;
        case 'stale':
            scoreDelta = -1;
            break;
        default:
            return;
    }

    // Update each matched keyword
    for (const keywordText of matchedKeywords) {
        const keyword = db.prepare('SELECT id FROM keywords WHERE keyword = ?').get(keywordText);
        if (!keyword) continue;

        // Update performance score
        db.prepare(`
            UPDATE keywords SET
                performance_score = MIN(100, MAX(0, performance_score + ?)),
                threads_matched = threads_matched + 1
                ${action === 'view' || action === 'reply' ? ', threads_engaged = threads_engaged + 1' : ''}
            WHERE id = ?
        `).run(scoreDelta, keyword.id);
    }
}
