# grok-engage

**Find high-engagement X conversations. Get AI replies. Post in one click.**

For founders who'd rather ship than scroll.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## See It In Action

<p align="center">
  <video src="https://github.com/user-attachments/assets/94658c5f-0ba7-475a-b9ef-20afa9b5f55e" width="100%" autoplay loop muted playsinline></video>
</p>

---

## Quick Start

```bash
git clone https://github.com/yungookim/grok-engage.git
cd grok-engage
npm install
npm start
```

Open http://localhost:3001 → The setup wizard walks you through configuration → Start finding threads.

**Requirements:** Node.js 18+, [xAI API key](https://x.ai) for reply generation. That's it — no X API needed for discovery.

---

## What You Get

| Before                              | After                                         |
| ----------------------------------- | --------------------------------------------- |
| Scroll X for 45 min hunting threads | Curated feed of relevant conversations        |
| Stare at reply box, give up         | 3 AI-drafted replies, ready to post           |
| No idea what's working              | Analytics show which replies drive engagement |

---

## The Problem

You know the drill:

1. Open X to "engage with your audience"
2. Scroll past 47 irrelevant threads
3. Finally find something relevant
4. Stare at the reply box for 10 minutes
5. Give up. Ship nothing. Feel bad.

Repeat daily. Wonder why growth is slow.

**grok-engage does the boring part** — finding threads and drafting replies — so you can focus on adding value and shipping your product.

---

## Features

### Thread Discovery

Find conversations worth joining — automatically.

- **Browser-based discovery** — scrapes X directly, no API limits
- Smart filtering (15+ replies only — no dead threads)
- Relevance scoring (0-100) and tone detection
- Works with Claude Code for hands-free discovery

### Reply Generation

Three styles: **Value-add** (pure help), **Light promo** (subtle mention), **Direct** (explicit recommendation).

- One-click regeneration (funnier, shorter, more technical)
- Edit before posting — always in control

### Learning System

The more you use it, the smarter it gets:

| What It Learns     | Example                          |
| ------------------ | -------------------------------- |
| Thread preferences | Topics, author follower ranges   |
| Your voice         | Tone, length, emoji usage        |
| What works         | Reply performance at 1h, 6h, 24h |

### Self-Improving Keywords

Keywords evolve from "what you _think_ your audience talks about" to "what they _actually_ talk about."

The system tracks which keywords lead to threads you engage with. Performers get promoted. Duds get disabled. New keywords emerge from successful threads. After a few weeks: 3-4x more relevant threads, zero manual tuning.

---

## Requirements

| Requirement | Cost                | Purpose                                    |
| ----------- | ------------------- | ------------------------------------------ |
| Node.js 18+ | Free                | Runtime                                    |
| xAI API Key | ~$5-20/mo           | Reply generation ([x.ai](https://x.ai))    |
| X API Key   | Optional            | Only for one-click posting                 |

**No X API needed for discovery!** Browser-based scraping finds threads without hitting API rate limits. You can run discovery all day long.

**X API is optional** — only required if you want to post replies directly from the app. Otherwise, copy the generated reply and post manually.

---

## Configuration

### Environment Variables (Optional)

You can configure via the dashboard UI or `.env` file:

```bash
cp .env.example .env
```

```env
# xAI API Key (required for reply generation - get from x.ai)
XAI_API_KEY=your_grok_api_key

# X API Credentials (optional - only for one-click posting)
# Get from developer.x.com if you want to post directly
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_SECRET=your_access_secret

# Server Config (optional)
PORT=3001
```

### Product Profile

Tell the tool about your product so it knows when (and how) to mention it:

```json
{
  "name": "YourProduct",
  "oneLiner": "The thing that does the thing",
  "problemsSolved": ["Problem A", "Problem B"],
  "targetAudience": "Indie hackers building SaaS",
  "mentionWhen": "User is asking for tool recommendations"
}
```

---

## Tech Stack

| Component     | Technology                          |
| ------------- | ----------------------------------- |
| Backend       | Node.js, Express                    |
| Database      | SQLite (local, no setup)            |
| Frontend      | Vanilla JS, Tailwind CSS            |
| AI            | Grok via xAI API                    |
| Discovery     | Browser scraping (Claude-in-Chrome) |
| Posting       | twitter-api-v2 (optional)           |

**Why these choices?**

- **SQLite**: Zero config, runs anywhere, easy to backup (just copy the file)
- **Vanilla JS**: No build step, inspect and modify easily
- **Local-first**: Your credentials, your data, your machine

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Your Machine                            │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐       │
│  │   Dashboard  │◄──►│    Server    │◄──►│  SQLite   │       │
│  │  (Browser)   │    │  (Express)   │    │    DB     │       │
│  └──────────────┘    └──────┬───────┘    └───────────┘       │
│                             │                                 │
│  ┌──────────────────────────┼──────────────────────────────┐ │
│  │  Browser Discovery       │                              │ │
│  │  (Claude-in-Chrome)      │                              │ │
│  │  - Scrapes X search      ▼                              │ │
│  │  - No API limits    ┌─────────┐   ┌─────────┐           │ │
│  │  - Runs all day     │ xAI API │   │ X API   │ (optional)│ │
│  └─────────────────────└─────────┘   └─────────┘───────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Two discovery modes:**
- **Browser Discovery** — Scrapes X directly via Claude-in-Chrome. No rate limits.
- **API Discovery** — Uses X API (optional, has rate limits)

---

## Discovery Modes

### Browser Discovery (Recommended)

Uses Claude-in-Chrome to scrape X search results directly:
- **No API rate limits** — run discovery all day
- Works with your active keywords
- Ask Claude: "Run browser discovery for my keywords"

### API Discovery (Optional)

If you have X API credentials configured:
- Displays remaining reads/writes for the month
- Calculates daily budget based on days remaining
- Warns before operations that exceed capacity
- Pauses monitoring when approaching limits

---

## Security

- **Encrypted credentials**: API keys stored with AES-256-GCM
- **Local only**: Nothing leaves your machine except X/xAI API calls
- **XSS prevention**: All DOM construction uses safe methods
- **No tracking**: Zero analytics, zero telemetry

---

## Roadmap

- [ ] Multi-account support
- [ ] Scheduled posting
- [ ] Thread templates
- [ ] Browser extension for quick replies
- [ ] Export learning data
- [ ] DM monitoring (when X API supports it)

---

## Contributing

Found a bug? Have an idea? PRs welcome.

```bash
# Run in dev mode (auto-reload)
npm run dev
```

### Project Structure

```
├── server/
│   ├── index.js          # Express server + routes
│   ├── db.js             # SQLite database setup
│   ├── scheduler.js      # Background thread discovery
│   ├── x-client.js       # X API integration
│   ├── grok-client.js    # xAI/Grok integration
│   └── learning.js       # Learning engine
├── dashboard/
│   ├── index.html        # SPA entry point
│   ├── app.js            # Frontend logic
│   └── styles.css        # Tailwind overrides
└── data/                 # SQLite DB (gitignored)
```

---

## FAQ

**Do I need an X API key?**
No! Browser-based discovery scrapes X directly — no API needed. X API is only required if you want one-click posting from the app.

**How much does it cost to run?**
Just xAI API costs (~$5-20/month for reply generation). Browser discovery is free with no rate limits.

**Can I use it for multiple products?**
Yes! Configure multiple product profiles and switch between them.

**What if I don't want AI replies?**
Use it purely for thread discovery. Skip the reply suggestions entirely.

**Is my data safe?**
Everything stays on your machine. Credentials are encrypted. No cloud, no accounts, no data sharing.

---

## License

MIT — do whatever you want with it.

---

## Built for Founders Who Ship

I spent 2+ hours daily "engaging on X" to boost my accounts content distribution. This tool does the boring part so you can focus on adding value.

**v1 was one-shot built with [Ralph](https://github.com/frankbria/ralph-claude-code)** — from spec to working app in a single session.

**If this saves you time:**

- [Star this repo](https://github.com/yungookim/grok-engage) so other founders can find it
- [Follow @dygk_0x1](https://x.com/dygk_0x1) for updates and more indie maker tools
