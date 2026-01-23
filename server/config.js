import 'dotenv/config';

// Default settings that can be overridden via database
export const DEFAULT_SETTINGS = {
    // Monitoring
    'monitoring.enabled': true,
    'monitoring.interval_minutes': 5,
    'monitoring.min_replies': 15,
    'monitoring.semantic_threshold': 50,  // 0-100

    // Reply generation
    'replies.default_type': 'value-add',
    'replies.max_length': 280,
    'replies.include_product_mention': 'auto',  // 'auto', 'always', 'never'

    // Outcome tracking
    'tracking.check_intervals': [1, 6, 24],  // hours after posting
    'tracking.max_checks': 3,

    // UI
    'ui.threads_per_page': 20,
    'ui.auto_refresh': true,
    'ui.refresh_interval_seconds': 60,

    // Keyword experimentation
    'experimentation.enabled': true,
    'experimentation.dry_threshold': 3,      // consecutive dry cycles before experimenting
    'experimentation.batch_size': 7,         // keywords to generate per experiment
    'experimentation.last_strategy_index': 0, // cycles through 0→1→2→0...

    // Discovery tracking
    'discovery.dry_cycle_count': 0
};

// Application configuration from environment
const config = {
    // Server
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    openBrowser: process.env.OPEN_BROWSER !== 'false',

    // Database
    dbPath: process.env.DB_PATH || './data/monitor.db',

    // X API credentials (can also be stored encrypted in DB)
    xApiKey: process.env.X_API_KEY || '',
    xApiSecret: process.env.X_API_SECRET || '',
    xAccessToken: process.env.X_ACCESS_TOKEN || '',
    xAccessSecret: process.env.X_ACCESS_SECRET || '',

    // xAI API
    xaiApiKey: process.env.XAI_API_KEY || '',
    xaiBaseUrl: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
    xaiModel: process.env.XAI_MODEL || 'grok-3-latest',

    // Encryption (for storing credentials in DB)
    masterKey: process.env.MASTER_KEY || '',

    // Rate limits (X API Basic tier)
    // Can override via env: X_API_MONTHLY_READ_LIMIT, X_API_MONTHLY_WRITE_LIMIT
    xApiMonthlyReadLimit: parseInt(process.env.X_API_MONTHLY_READ_LIMIT || '15000', 10),
    xApiMonthlyWriteLimit: parseInt(process.env.X_API_MONTHLY_WRITE_LIMIT || '500', 10)
};

// Freeze to prevent accidental modification
export default Object.freeze(config);
