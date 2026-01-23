import OpenAI from 'openai';
import config from '../config.js';
import { recordApiUsage, getSetting } from '../db/db.js';

let client = null;

/**
 * Get xAI credentials from config (env vars) or database settings
 */
function getXaiCredentials() {
    return {
        apiKey: config.xaiApiKey || getSetting('credentials.xai_api_key') || '',
        baseUrl: config.xaiBaseUrl || getSetting('credentials.xai_base_url') || 'https://api.x.ai/v1'
    };
}

/**
 * Check if xAI API key is configured (either env or database)
 */
export function hasApiKey() {
    const creds = getXaiCredentials();
    return !!creds.apiKey;
}

/**
 * Get or create the xAI/Grok client
 * Uses OpenAI-compatible API with xAI base URL
 */
export function getGrokClient() {
    if (client) return client;

    const creds = getXaiCredentials();

    if (!creds.apiKey) {
        throw new Error('xAI API key not configured. Set XAI_API_KEY in environment.');
    }

    client = new OpenAI({
        apiKey: creds.apiKey,
        baseURL: creds.baseUrl
    });

    return client;
}

/**
 * Send a chat completion request to Grok
 * @param {Array} messages - Array of {role, content} message objects
 * @param {object} options - Additional options
 * @returns {Promise<string>} The assistant's response content
 */
export async function chat(messages, options = {}) {
    const grok = getGrokClient();

    const requestOptions = {
        model: options.model || config.xaiModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens || 1000
    };

    // Add JSON mode if requested
    if (options.json) {
        requestOptions.response_format = { type: 'json_object' };
    }

    const response = await grok.chat.completions.create(requestOptions);

    // Record API usage
    recordApiUsage('grok', 'chat', 1);

    return response.choices[0].message.content;
}

/**
 * Send a chat request and parse the JSON response
 * @param {Array} messages - Array of {role, content} message objects
 * @param {object} options - Additional options
 * @returns {Promise<object>} Parsed JSON response
 */
export async function chatJson(messages, options = {}) {
    const content = await chat(messages, { ...options, json: true });

    try {
        return JSON.parse(content);
    } catch (error) {
        console.error('Failed to parse LLM JSON response:', content);
        throw new Error('LLM response was not valid JSON');
    }
}

/**
 * Simple prompt helper - sends a single user message
 * @param {string} prompt - The prompt text
 * @param {object} options - Additional options
 * @returns {Promise<string>} The response
 */
export async function prompt(prompt, options = {}) {
    return chat([{ role: 'user', content: prompt }], options);
}

/**
 * Simple prompt helper that returns parsed JSON
 * @param {string} prompt - The prompt text
 * @param {object} options - Additional options
 * @returns {Promise<object>} Parsed JSON response
 */
export async function promptJson(prompt, options = {}) {
    return chatJson([{ role: 'user', content: prompt }], options);
}

/**
 * Reset the client (useful after credential changes)
 */
export function resetClient() {
    client = null;
}

/**
 * Validate xAI API key without saving it
 * Creates a temporary client and tests authentication
 * @param {string} apiKey - The xAI API key to validate
 * @param {string} baseUrl - Optional base URL (defaults to config)
 * @returns {Promise<object>} { valid: boolean, details?: object, error?: string, code?: string }
 */
export async function validateApiKey(apiKey, baseUrl = null) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        return {
            valid: false,
            error: 'API key is required',
            code: 'MISSING_KEY'
        };
    }

    try {
        // Create temporary client with provided key
        const tempClient = new OpenAI({
            apiKey: apiKey.trim(),
            baseURL: baseUrl || config.xaiBaseUrl
        });

        // Test by listing models - lightweight endpoint that confirms auth
        const models = await tempClient.models.list();

        // Extract available model names
        const modelNames = models.data?.map(m => m.id) || [];

        return {
            valid: true,
            details: {
                modelsAvailable: modelNames.length,
                models: modelNames.slice(0, 5) // Return first 5 model names
            }
        };
    } catch (error) {
        // Parse OpenAI-style API errors
        if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Unauthorized')) {
            return {
                valid: false,
                error: 'Invalid API key. Check your key at x.ai.',
                code: 'INVALID_KEY'
            };
        }

        if (error.status === 403 || error.message?.includes('403')) {
            return {
                valid: false,
                error: 'Access forbidden. Your API key may not have sufficient permissions.',
                code: 'FORBIDDEN'
            };
        }

        if (error.status === 429 || error.message?.includes('429')) {
            return {
                valid: false,
                error: 'Rate limited. Please wait a moment and try again.',
                code: 'RATE_LIMITED'
            };
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return {
                valid: false,
                error: 'Network error. Check your internet connection.',
                code: 'NETWORK_ERROR'
            };
        }

        // Generic error
        return {
            valid: false,
            error: error.message || 'Failed to validate API key',
            code: 'UNKNOWN_ERROR'
        };
    }
}

/**
 * Score semantic relevance of a tweet for product engagement
 * @param {object} tweet - Tweet data
 * @param {Array} productProfiles - Active product profiles
 * @param {Array} learnedPreferences - Learned thread preferences
 * @returns {Promise<object>} Relevance score and analysis
 */
export async function scoreRelevance(tweet, productProfiles, learnedPreferences = []) {
    const profilesText = productProfiles.map(p => `
### ${p.name}
- One-liner: ${p.one_liner || 'N/A'}
- Problems solved: ${(p.problems_solved || []).join(', ') || 'N/A'}
- Target audience: ${(p.target_audience || []).join(', ') || 'N/A'}
- When to mention: ${p.when_to_mention || 'N/A'}
- When NOT to mention: ${p.when_not_to_mention || 'N/A'}
`).join('\n');

    const preferencesText = learnedPreferences.length > 0
        ? JSON.stringify(learnedPreferences, null, 2)
        : 'No learned preferences yet';

    const prompt = `
You are evaluating whether a Twitter/X thread is relevant for engagement.

## Product Profiles
${profilesText}

## Learned Preferences (from past engagement)
${preferencesText}

## Tweet to Evaluate
Author: @${tweet.author?.username || 'unknown'} (${tweet.author?.public_metrics?.followers_count || 0} followers)
Content: "${tweet.text}"
Engagement: ${tweet.public_metrics?.reply_count || 0} replies, ${tweet.public_metrics?.like_count || 0} likes

## Task
Score this thread's relevance (0-100) and analyze:

1. **Relevance Score**: How relevant is this for engaging? Consider:
   - Does it discuss problems the products solve?
   - Is the author in the target audience?
   - Would a reply add value to the conversation?
   - Based on learned preferences, would the user likely engage?

2. **Tone**: Classify as one of: casual, serious, technical, rant, question

3. **Topic**: Classify the main topic (e.g., tool-search, feature-request, venting, how-to, discussion)

4. **Reasoning**: Brief explanation of the score

Respond in JSON:
{
    "score": <0-100>,
    "tone": "<tone>",
    "topic": "<topic>",
    "reasoning": "<1-2 sentences>"
}
`;

    return promptJson(prompt);
}

/**
 * Generate a reply for a thread
 * @param {object} thread - Thread data from database
 * @param {object} productProfile - Product profile to use
 * @param {Array} existingReplies - Top existing replies for context
 * @param {Array} learnedPatterns - Learned reply style patterns
 * @param {object} options - Generation options
 * @returns {Promise<object>} Generated reply with metadata
 */
/**
 * Extract product profile data from website content
 * @param {string} websiteContent - Extracted text from website
 * @param {string} url - The source URL
 * @returns {Promise<object>} Extracted profile data
 */
/**
 * Generate keywords from a product profile
 * @param {object} profile - Product profile data
 * @returns {Promise<string[]>} Array of generated keywords
 */
export async function generateKeywordsFromProfile(profile) {
    const prompt = `
You are generating Twitter/X search keywords to find relevant conversations for a product.

## Product Profile
Name: ${profile.name}
One-liner: ${profile.one_liner || 'N/A'}
Problems solved: ${(profile.problems_solved || []).join(', ') || 'N/A'}
Target audience: ${(profile.target_audience || []).join(', ') || 'N/A'}
Relevant keywords from profile: ${(profile.relevant_keywords || []).join(', ') || 'N/A'}

## Task
Generate 10-15 simple search keywords to find Twitter conversations about problems this product solves.

## CRITICAL: Keyword Format
- MUST be 1-2 words only
- NO phrases like "looking for", "need help with", "frustrated with"
- Just core terms people mention naturally
- Mix: pain points, tools, technologies, audience terms

GOOD: "automation", "no-code", "workflow", "burnout", "productivity", "API"
BAD: "looking for automation", "need better workflow", "help with productivity"

Return ONLY JSON: {"keywords": ["word1", "word2", ...]}
`;

    const result = await promptJson(prompt);
    return result.keywords || [];
}

/**
 * Discover new keywords from engaged threads
 * @param {Array} threads - Array of threads that received engagement
 * @param {Array} existingKeywords - Current keywords to avoid duplicates
 * @returns {Promise<Array>} Array of {keyword, reason} objects
 */
export async function discoverKeywordsFromThreads(threads, existingKeywords) {
    if (!threads || threads.length === 0) return [];

    const threadSummaries = threads.slice(0, 10).map(t =>
        `- "${t.content?.slice(0, 200)}..." (tone: ${t.detected_tone}, topic: ${t.detected_topic})`
    ).join('\n');

    const existingList = existingKeywords.map(k => k.keyword).join(', ');

    const prompt = `
You are analyzing Twitter threads that received positive engagement to discover new keywords.

## Engaged Threads (user replied to or viewed these)
${threadSummaries}

## Existing Keywords (avoid duplicates)
${existingList}

## Task
Extract 1-3 new search keywords from these threads.

## CRITICAL: Keyword Format
- MUST be 1-2 words only
- Extract actual terms/concepts mentioned in the threads
- NO phrases - just the core topic words
- If no clear new terms, return empty array

GOOD: "burnout", "async", "remote work", "side project"
BAD: "dealing with burnout", "async communication tools"

Return ONLY JSON:
{"suggestions": [{"keyword": "term", "reason": "brief why"}]}
`;

    const result = await promptJson(prompt);
    return result.suggestions || [];
}

export async function extractProductProfile(websiteContent, url) {
    const prompt = `
You are extracting product information from a website to create a profile for social media engagement.

Website URL: ${url}
Website Content:
${websiteContent}

Extract the following fields as JSON:
- name: The product or company name (required)
- one_liner: A short tagline or description (max 100 characters)
- problems_solved: Array of specific problems this product solves (2-5 items)
- target_audience: Array of who this product is for (2-4 items, be specific like "indie hackers" not just "developers")
- relevant_keywords: Keywords people might use when discussing related problems (5-10 items)
- tone_keywords: Words describing the brand voice/personality (3-5 items, e.g., "friendly", "professional", "technical")
- when_to_mention: Brief guidance on good contexts to mention this product (1-2 sentences)
- when_not_to_mention: Brief guidance on contexts to avoid (1-2 sentences)

Guidelines:
- Be specific and actionable, not generic
- Use the actual language and terminology from the website
- If you cannot determine a field, use an empty string or empty array
- The name field is required - if you truly cannot find it, use the domain name

Return ONLY valid JSON with these exact field names.
`;

    return promptJson(prompt);
}

/**
 * Generate experimental keywords using a specified strategy
 * @param {string} strategy - 'semantic', 'pattern', or 'trend'
 * @param {object} context - Context data for generation
 * @param {Array} context.existingKeywords - Current keywords to avoid duplicates
 * @param {Array} context.productProfiles - Active product profiles
 * @param {Array} context.engagedThreads - Recently engaged threads
 * @returns {Promise<Array>} Array of generated keyword strings
 */
export async function generateExperimentalKeywords(strategy, context) {
    const { existingKeywords = [], productProfiles = [], engagedThreads = [] } = context;

    const existingList = existingKeywords.map(k => k.keyword || k).join(', ');

    const profilesText = productProfiles.map(p => `
- ${p.name}: ${p.one_liner || 'N/A'}
  Problems: ${(p.problems_solved || []).join(', ') || 'N/A'}
  Audience: ${(p.target_audience || []).join(', ') || 'N/A'}
`).join('');

    const threadsText = engagedThreads.slice(0, 5).map(t =>
        `- "${t.content?.slice(0, 150)}..." (tone: ${t.detected_tone || 'unknown'})`
    ).join('\n');

    // Common format instruction for all strategies
    const formatRule = `
## CRITICAL: Keyword Format
- MUST be 1-2 words only
- NO phrases or sentences
- Just core terms people mention
GOOD: "burnout", "async", "no-code", "side project"
BAD: "looking for tools", "need help with", "frustrated with"`;

    let prompt;

    switch (strategy) {
        case 'semantic':
            prompt = `
You are generating experimental search keywords by expanding semantically on existing keywords.

## Existing Keywords
${existingList || 'None yet'}

## Product Context
${profilesText || 'No product profiles configured'}

## Task
Generate 10-15 NEW keywords by finding synonyms and related terms.
${formatRule}

Return ONLY JSON: {"keywords": ["word1", "word2", ...]}
`;
            break;

        case 'pattern':
            prompt = `
You are generating keywords by extracting terms from successful thread engagement.

## Product Profiles
${profilesText || 'No product profiles configured'}

## Recently Engaged Threads
${threadsText || 'No engagement data yet'}

## Existing Keywords (avoid duplicates)
${existingList || 'None'}

## Task
Extract 10-15 NEW keywords from the thread content - terms and concepts mentioned.
${formatRule}

Return ONLY JSON: {"keywords": ["word1", "word2", ...]}
`;
            break;

        case 'trend':
            prompt = `
You are generating keywords for trending topics in a product's domain.

## Product Context
${profilesText || 'No product profiles configured'}

## Existing Keywords (avoid duplicates)
${existingList || 'None'}

## Task
Generate 10-15 NEW trending topic keywords in this space.
${formatRule}

Return ONLY JSON: {"keywords": ["word1", "word2", ...]}
`;
            break;

        default:
            throw new Error(`Unknown strategy: ${strategy}`);
    }

    const result = await promptJson(prompt);
    return result.keywords || [];
}

export async function generateReply(thread, productProfile, existingReplies = [], learnedPatterns = [], options = {}) {
    const repliesText = existingReplies.length > 0
        ? existingReplies.map((r, i) => `${i + 1}. @${r.author}: "${r.text}"`).join('\n')
        : 'No existing replies fetched';

    const patternsText = learnedPatterns.length > 0
        ? JSON.stringify(learnedPatterns, null, 2)
        : 'No learned patterns yet';

    const prompt = `
You are helping craft a reply to a Twitter/X thread. The goal is to add genuine value to the conversation. Sometimes that means mentioning a product, but often it means just being helpful.

## Thread Context
Author: @${thread.x_author_username || 'unknown'} (${thread.x_author_followers || 0} followers)
Tone: ${thread.detected_tone || 'unknown'}
Topic: ${thread.detected_topic || 'unknown'}

Original tweet:
"${thread.content}"

Top existing replies:
${repliesText}

## Product (mention only if genuinely relevant)
Name: ${productProfile.name}
What it does: ${productProfile.one_liner || 'N/A'}
Problems it solves: ${(productProfile.problems_solved || []).join(', ') || 'N/A'}
When to mention: ${productProfile.when_to_mention || 'When it genuinely helps'}
When NOT to mention: ${productProfile.when_not_to_mention || 'When it would feel forced'}

## Learned Style Preferences
${patternsText}

## User's Request
${options.instruction || 'Generate a natural, valuable reply'}

## Reply Type Guidelines
- value-add: Share experience or advice, NO product mention
- light-promo: Helpful context WITH natural product mention
- direct: Clear product recommendation (only when explicitly relevant)

## Guidelines
1. Match the thread's tone (${thread.detected_tone || 'casual'})
2. Prioritize adding value over promotion
3. If mentioning product, make it feel natural, not forced
4. Keep under 280 characters unless depth is needed
5. Don't be sycophantic or use excessive enthusiasm
6. If the thread is a rant/vent, empathize first

## Task
Generate a reply and classify it.

Respond in JSON:
{
    "reply_text": "<your reply>",
    "reply_type": "value-add" | "light-promo" | "direct",
    "confidence": <0-100>,
    "reasoning": "<why this approach for this thread>"
}
`;

    return promptJson(prompt);
}
