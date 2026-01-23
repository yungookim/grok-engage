import cron from 'node-cron';
import { runDiscoveryCycle } from './discovery.js';
import { fetchPendingMetrics } from './metrics.js';
import { runKeywordRefinement, runKeywordExperimentation } from './keyword-generator.js';
import { getSetting } from '../db/db.js';

let discoveryJob = null;
let metricsJob = null;
let keywordRefinementJob = null;
let experimentationJob = null;
let isDiscoveryRunning = false;
let isMetricsRunning = false;
let isKeywordRefinementRunning = false;
let isExperimentationRunning = false;
let lastDiscoveryResult = null;
let lastDiscoveryTime = null;
let lastExperimentationResult = null;
let lastExperimentationTime = null;

// Discovery history - keeps last 20 runs for activity log
const MAX_HISTORY_SIZE = 20;
let discoveryHistory = [];

/**
 * Start the scheduler with configured intervals
 */
export async function startScheduler() {
    const monitoringEnabled = getSetting('monitoring.enabled');

    if (!monitoringEnabled) {
        console.log('[Scheduler] Monitoring is disabled in settings');
        return;
    }

    const intervalMinutes = getSetting('monitoring.interval_minutes') || 5;

    // Thread discovery - runs every N minutes
    // Cron: */N * * * * means "every N minutes"
    discoveryJob = cron.schedule(`*/${intervalMinutes} * * * *`, async () => {
        if (isDiscoveryRunning) {
            console.log('[Scheduler] Discovery already running, skipping this cycle');
            return;
        }

        isDiscoveryRunning = true;
        console.log(`[Scheduler] ${new Date().toISOString()} - Starting discovery cycle`);

        try {
            const results = await runDiscoveryCycle();
            lastDiscoveryResult = results;
            lastDiscoveryTime = new Date().toISOString();

            // Add to history
            addToHistory({
                time: lastDiscoveryTime,
                trigger: 'scheduled',
                ...results
            });

            console.log(`[Scheduler] Discovery complete: ${results.threadsAdded} new threads, ${results.staleSkipped} stale skipped`);

            if (results.errors.length > 0) {
                console.warn('[Scheduler] Discovery had errors:', results.errors);
            }
        } catch (error) {
            lastDiscoveryResult = { errors: [error.message], threadsAdded: 0 };
            lastDiscoveryTime = new Date().toISOString();

            // Add failure to history
            addToHistory({
                time: lastDiscoveryTime,
                trigger: 'scheduled',
                threadsAdded: 0,
                errors: [error.message]
            });

            console.error('[Scheduler] Discovery failed:', error);
        } finally {
            isDiscoveryRunning = false;
        }
    });

    // Metrics fetching - runs every hour at minute 30
    // This staggers it from discovery to avoid API rate limit conflicts
    metricsJob = cron.schedule('30 * * * *', async () => {
        if (isMetricsRunning) {
            console.log('[Scheduler] Metrics fetch already running, skipping');
            return;
        }

        isMetricsRunning = true;
        console.log(`[Scheduler] ${new Date().toISOString()} - Starting metrics fetch`);

        try {
            const count = await fetchPendingMetrics();
            console.log(`[Scheduler] Metrics fetch complete: ${count} replies updated`);
        } catch (error) {
            console.error('[Scheduler] Metrics fetch failed:', error);
        } finally {
            isMetricsRunning = false;
        }
    });

    // Keyword refinement - runs daily at 2:00 AM
    // Analyzes engagement data to improve keywords
    keywordRefinementJob = cron.schedule('0 2 * * *', async () => {
        if (isKeywordRefinementRunning) {
            console.log('[Scheduler] Keyword refinement already running, skipping');
            return;
        }

        isKeywordRefinementRunning = true;
        console.log(`[Scheduler] ${new Date().toISOString()} - Starting keyword refinement`);

        try {
            const results = await runKeywordRefinement();
            console.log(`[Scheduler] Keyword refinement complete: ${results.disabled.length} disabled, ${results.discovered.length} discovered`);
        } catch (error) {
            console.error('[Scheduler] Keyword refinement failed:', error);
        } finally {
            isKeywordRefinementRunning = false;
        }
    });

    // Keyword experimentation - runs every 5 minutes, triggers when discovery is dry
    experimentationJob = cron.schedule('*/5 * * * *', async () => {
        // Skip if experimentation is disabled
        const experimentationEnabled = getSetting('experimentation.enabled');
        if (!experimentationEnabled) {
            return;
        }

        // Skip if already running (overlap prevention)
        if (isExperimentationRunning) {
            console.log('[Scheduler] Experimentation already running, skipping');
            return;
        }

        // Check if dry threshold has been reached
        const dryCount = getSetting('discovery.dry_cycle_count') || 0;
        const dryThreshold = getSetting('experimentation.dry_threshold') || 3;

        if (dryCount < dryThreshold) {
            return; // Not enough dry cycles yet
        }

        isExperimentationRunning = true;
        console.log(`[Scheduler] ${new Date().toISOString()} - Starting keyword experimentation (${dryCount} dry cycles)`);

        try {
            const results = await runKeywordExperimentation();
            lastExperimentationResult = results;
            lastExperimentationTime = new Date().toISOString();
            console.log(`[Scheduler] Experimentation complete: ${results.generated.length} keywords generated (${results.strategy})`);
        } catch (error) {
            lastExperimentationResult = { errors: [error.message], generated: [] };
            lastExperimentationTime = new Date().toISOString();
            console.error('[Scheduler] Experimentation failed:', error);
        } finally {
            isExperimentationRunning = false;
        }
    });

    console.log(`[Scheduler] Started: discovery every ${intervalMinutes}m, metrics at :30, keyword refinement at 2:00 AM, experimentation every 5m`);
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler() {
    if (discoveryJob) {
        discoveryJob.stop();
        discoveryJob = null;
    }

    if (metricsJob) {
        metricsJob.stop();
        metricsJob = null;
    }

    if (keywordRefinementJob) {
        keywordRefinementJob.stop();
        keywordRefinementJob = null;
    }

    if (experimentationJob) {
        experimentationJob.stop();
        experimentationJob = null;
    }

    console.log('[Scheduler] Stopped');
}

/**
 * Restart the scheduler (after settings change)
 */
export async function restartScheduler() {
    stopScheduler();
    await startScheduler();
}

/**
 * Add a discovery run to history
 */
function addToHistory(entry) {
    discoveryHistory.unshift(entry);
    if (discoveryHistory.length > MAX_HISTORY_SIZE) {
        discoveryHistory = discoveryHistory.slice(0, MAX_HISTORY_SIZE);
    }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
    const dryCount = getSetting('discovery.dry_cycle_count') || 0;
    const dryThreshold = getSetting('experimentation.dry_threshold') || 3;
    const experimentationEnabled = getSetting('experimentation.enabled') !== false;

    return {
        discoveryRunning: discoveryJob !== null,
        metricsRunning: metricsJob !== null,
        keywordRefinementRunning: keywordRefinementJob !== null,
        experimentationRunning: experimentationJob !== null,
        isDiscoveryActive: isDiscoveryRunning,
        isMetricsActive: isMetricsRunning,
        isKeywordRefinementActive: isKeywordRefinementRunning,
        isExperimentationActive: isExperimentationRunning,
        experimentation: {
            enabled: experimentationEnabled,
            dryCount,
            dryThreshold,
            willTrigger: experimentationEnabled && dryCount >= dryThreshold
        },
        lastDiscovery: lastDiscoveryResult ? {
            time: lastDiscoveryTime,
            threadsAdded: lastDiscoveryResult.threadsAdded || 0,
            keywordsSearched: lastDiscoveryResult.keywordsSearched || 0,
            tweetsFound: lastDiscoveryResult.tweetsFound || 0,
            errors: lastDiscoveryResult.errors || []
        } : null,
        lastExperimentation: lastExperimentationResult ? {
            time: lastExperimentationTime,
            generated: lastExperimentationResult.generated?.length || 0,
            strategy: lastExperimentationResult.strategy || null,
            errors: lastExperimentationResult.errors || []
        } : null,
        history: discoveryHistory
    };
}

/**
 * Manually trigger a discovery cycle (for testing or on-demand)
 */
export async function triggerDiscovery() {
    if (isDiscoveryRunning) {
        return { success: false, message: 'Discovery already running' };
    }

    isDiscoveryRunning = true;
    try {
        const results = await runDiscoveryCycle('manual');
        lastDiscoveryResult = results;
        lastDiscoveryTime = new Date().toISOString();

        // Add to history with manual trigger
        addToHistory({
            time: lastDiscoveryTime,
            trigger: 'manual',
            ...results
        });

        return { success: true, results };
    } catch (error) {
        lastDiscoveryResult = { errors: [error.message], threadsAdded: 0 };
        lastDiscoveryTime = new Date().toISOString();

        // Add failure to history
        addToHistory({
            time: lastDiscoveryTime,
            trigger: 'manual',
            threadsAdded: 0,
            errors: [error.message]
        });

        return { success: false, message: error.message };
    } finally {
        isDiscoveryRunning = false;
    }
}

/**
 * Manually trigger metrics fetch
 */
export async function triggerMetricsFetch() {
    if (isMetricsRunning) {
        return { success: false, message: 'Metrics fetch already running' };
    }

    isMetricsRunning = true;
    try {
        const count = await fetchPendingMetrics();
        return { success: true, count };
    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        isMetricsRunning = false;
    }
}

/**
 * Manually trigger keyword refinement
 */
export async function triggerKeywordRefinement() {
    if (isKeywordRefinementRunning) {
        return { success: false, message: 'Keyword refinement already running' };
    }

    isKeywordRefinementRunning = true;
    try {
        const results = await runKeywordRefinement();
        return { success: true, results };
    } catch (error) {
        return { success: false, message: error.message };
    } finally {
        isKeywordRefinementRunning = false;
    }
}

/**
 * Manually trigger keyword experimentation
 */
export async function triggerExperimentation() {
    if (isExperimentationRunning) {
        return { success: false, message: 'Experimentation already running' };
    }

    isExperimentationRunning = true;
    try {
        const results = await runKeywordExperimentation();
        lastExperimentationResult = results;
        lastExperimentationTime = new Date().toISOString();
        return { success: true, results };
    } catch (error) {
        lastExperimentationResult = { errors: [error.message], generated: [] };
        lastExperimentationTime = new Date().toISOString();
        return { success: false, message: error.message };
    } finally {
        isExperimentationRunning = false;
    }
}
