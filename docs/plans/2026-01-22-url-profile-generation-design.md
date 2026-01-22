# URL-Based Product Profile Generation

## Overview

Add ability to auto-generate product profiles from a website URL using the existing xAI (Grok) LLM integration. URL-based creation becomes the primary flow, with manual entry as secondary.

## User Flow

### Primary Flow (URL-based)
1. User goes to Settings → Product Profiles
2. Sees input field: "Enter your product's website URL" with "Generate Profile" button
3. User pastes URL and clicks Generate
4. Loading state shows while LLM processes
5. New profile appears in the list, marked as active
6. User can click to edit any field if needed

### Secondary Flow (Manual)
- Small link below URL input: "Or create manually"
- Opens the existing form for manual entry

### Error States
- URL unreachable → "Couldn't access that website. Check the URL and try again."
- LLM extraction fails → "Couldn't extract product info. Try manual entry."
- Invalid URL format → Inline validation before submit

## Backend Architecture

### New API Endpoint
```
POST /api/settings/profiles/generate
Body: { url: "https://example.com" }
Response: { success: true, profile: { id, name, ... } }
```

### Processing Pipeline
1. **Validate URL** - Check format, add `https://` if missing
2. **Fetch Website** - GET request with timeout (10s), follow redirects, grab HTML
3. **Extract Text** - Strip HTML tags, keep meaningful content (title, meta description, headings, main body text, limited to ~4000 chars)
4. **LLM Extraction** - Send to Grok with structured prompt asking for JSON output
5. **Save to DB** - Create profile with extracted data + store source URL
6. **Return Profile** - Send back the created profile to frontend

### New Function
```javascript
// /server/services/llm.js
async function extractProductProfile(websiteContent, url) {
  // Prompts Grok to extract structured profile data
  // Returns: { name, one_liner, problems_solved, ... }
}
```

## LLM Prompt Design

```
You are extracting product information from a website to create a profile.

Website URL: {url}
Website Content:
{extracted_text}

Extract the following fields as JSON:
- name: The product/company name
- one_liner: A short tagline (max 100 chars)
- problems_solved: Array of problems this product solves
- target_audience: Array of who this product is for
- relevant_keywords: Keywords people might use when discussing related problems
- tone_keywords: Words describing the brand voice (e.g., "friendly", "professional")
- when_to_mention: Contexts where mentioning this product would be helpful
- when_not_to_mention: Contexts to avoid (e.g., competitor threads, unrelated topics)

Return ONLY valid JSON. Use empty strings/arrays for fields you cannot determine.
```

### Response Parsing
- Parse JSON from Grok response
- Validate required field (`name`) exists
- Default empty arrays for list fields if missing

## Frontend UI Changes

### New Primary Section
```
┌─────────────────────────────────────────────────┐
│  Add Product Profile                            │
│                                                 │
│  [https://yourproduct.com        ] [Generate]   │
│                                                 │
│  Or create manually →                           │
└─────────────────────────────────────────────────┘
```

### States
- **Loading**: Button shows spinner + "Analyzing website...", input disabled
- **Success**: Toast "Profile created for {name}", profile appears in list
- **Error**: Inline error message below input

### Profile List Updates
- Each card shows name, one-liner, and source URL (if generated)
- Small badge on auto-generated profiles: "Generated from URL"

### Manual Entry
- Clicking "Or create manually" reveals the existing form
- Form can be collapsed/hidden again

## File Changes

| File | Changes |
|------|---------|
| `/server/services/llm.js` | Add `extractProductProfile()` function |
| `/server/routes/settings.js` | Add `POST /profiles/generate` endpoint |
| `/dashboard/js/components/settings-view.js` | Restructure UI with URL input as primary |
| `/dashboard/js/api.js` | Add `generateProfileFromUrl()` API call |

### Files Unchanged
- `/server/db/db.js` - Existing `createProfile()` works as-is
- `/server/db/schema.sql` - `url` field already exists

### No New Dependencies Required
