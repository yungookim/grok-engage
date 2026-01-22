# First-Run Setup Wizard & Configuration Warnings

## Overview

Add a first-time configuration experience that guides users through setting up required API keys, with ongoing warnings for misconfigured or missing settings.

## Requirements

### Required API Keys
- **X API credentials**: API key, API secret, Access token, Access secret (from developer.x.com)
- **xAI API key**: For semantic scoring and reply generation (from x.ai)

### Optional
- **MASTER_KEY**: Environment variable for encrypting credentials at rest

## Design Decisions

| Decision | Choice |
|----------|--------|
| Wizard location | Full-page modal on first visit |
| Validation approach | Live API calls on save |
| Post-setup behavior | Start monitoring immediately |
| Warning style | Persistent banner until fixed |

---

## Setup Wizard Modal

### Detection Logic
- On app load, call `GET /api/settings/config-status`
- If required keys missing → show setup wizard modal
- Store `setup_completed` flag in localStorage after success

### Modal Structure

**Step 1: X API Credentials**
```
┌─────────────────────────────────────────────────────┐
│  Welcome to X Thread Monitor                        │
│                                                     │
│  Let's get you set up. You'll need API keys from:  │
│  • X Developer Portal (developer.x.com)            │
│  • xAI (x.ai)                                      │
│                                                     │
│  Step 1 of 2: X API Credentials                    │
│                                                     │
│  API Key:        [____________________]            │
│  API Secret:     [____________________]            │
│  Access Token:   [____________________]            │
│  Access Secret:  [____________________]            │
│                                                     │
│  Get these from developer.x.com →                  │
│                                                     │
│                              [Next →]              │
└─────────────────────────────────────────────────────┘
```

**Step 2: xAI API Key**
```
┌─────────────────────────────────────────────────────┐
│  Step 2 of 2: xAI API Key                          │
│                                                     │
│  API Key:  [____________________]                  │
│                                                     │
│  Get your key from x.ai →                          │
│                                                     │
│  ℹ️ Your API keys are stored locally. For          │
│    encryption at rest, set MASTER_KEY in your     │
│    .env file. Learn more →                        │
│                                                     │
│                    [← Back]  [Complete Setup]      │
└─────────────────────────────────────────────────────┘
```

### Validation Flow

1. User clicks "Next" or "Complete Setup"
2. Button shows loading state: `[Validating...]`
3. Make test API call:
   - **X API**: `GET /2/users/me` (confirms auth)
   - **xAI API**: `GET /v1/models` (confirms key works)
4. Display result inline

**Success state:**
```
✓ Connected successfully
  Authenticated as @username
```

**Failure state:**
```
✗ Connection failed
  Invalid API key or secret. Double-check your
  credentials at developer.x.com
```

### Error Messages

| Error | Message |
|-------|---------|
| Invalid credentials | "Invalid API key or secret. Double-check your credentials." |
| Rate limited | "Too many attempts. Please wait a moment and retry." |
| Network error | "Network error. Check your internet connection." |
| Insufficient permissions | "API key needs read/write permissions. Update at developer.x.com." |

---

## Warning Banner

### Placement
- Appears below the navigation bar
- Persistent until issue is resolved (no dismiss button)

### Design
```
┌──────────────────────────────────────────────────────────────────┐
│ ⚠️  X API connection failed. Monitoring is paused.  [Fix in Settings →] │
└──────────────────────────────────────────────────────────────────┘
```

### Warning Types

| Issue | Message | Severity |
|-------|---------|----------|
| X API invalid | "X API connection failed. Monitoring is paused." | Error (red) |
| xAI API invalid | "xAI API connection failed. Reply generation unavailable." | Error (red) |
| No keywords | "No keywords configured. Add keywords to start monitoring." | Warning (amber) |
| No product profile | "No product profile configured. Add one to generate replies." | Warning (amber) |

### Behavior
- Links directly to relevant settings tab
- Multiple issues stack (max 2 visible, "+N more" link)
- Yellow/amber for warnings, red for errors

---

## Backend API

### New Endpoints

**POST /api/settings/validate-credentials**

Validates API credentials without saving them.

Request:
```json
{
  "type": "x" | "xai",
  "credentials": {
    "apiKey": "...",
    "apiSecret": "...",
    "accessToken": "...",
    "accessSecret": "..."
  }
}
```

Response (success):
```json
{
  "valid": true,
  "details": { "username": "@example" }
}
```

Response (failure):
```json
{
  "valid": false,
  "error": "Invalid API key",
  "code": "INVALID_KEY"
}
```

**GET /api/settings/config-status**

Returns current configuration state.

Response:
```json
{
  "isConfigured": false,
  "missing": ["x_api", "xai_api"],
  "warnings": ["no_keywords", "no_product_profile"]
}
```

---

## Implementation Files

### New Files

| File | Purpose |
|------|---------|
| `dashboard/js/components/setup-wizard.js` | Modal UI, step navigation, form handling, validation |
| `dashboard/js/components/warning-banner.js` | Persistent warning banner component |

### Modified Files

| File | Changes |
|------|---------|
| `server/routes/settings.js` | Add `/validate-credentials` and `/config-status` endpoints |
| `server/services/x-api.js` | Add `validateCredentials()` function |
| `server/services/llm.js` | Add `validateApiKey()` function |
| `dashboard/js/app.js` | Check config status on load, show wizard or warnings |
| `dashboard/index.html` | Add container divs for wizard modal and warning banner |

---

## App Startup Flow

```
1. DOMContentLoaded fires
2. Call GET /api/settings/config-status
3. If missing.length > 0:
   → Show setup wizard modal
   → On complete: save keys, close modal, start normal load
4. Else if warnings.length > 0:
   → Show warning banner(s)
   → Continue with normal app load
5. Else:
   → Normal app load
```
