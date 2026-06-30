# Scopus MCP — Cloudflare Worker

A **remote MCP server** for searching academic papers on Scopus, deployed on Cloudflare Workers. Also works locally via stdio.

Ported from [cmdaltctr/scopus-mcp](https://github.com/cmdaltctr/scopus-mcp).

---

## How It Works

```
You ask Claude (or any AI)    ──►    This Cloudflare Worker    ──►    Scopus API
to find papers on a topic            searches Scopus for you          returns results
```

The worker runs on Cloudflare's edge network. Anyone with the server URL, their own Scopus API key, and an access token can use it from any MCP client (Claude Desktop, Cursor, etc.).

---

## Who Is This For?

- **Researchers** who want to search Scopus through their AI assistant
- **Fellows and students** who need quick access to academic literature
- **Teams** that want a shared Scopus search tool without installing anything

---

## Features

### Tools (5 tools)

| Tool                  | What it does                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `search_scopus`         | Search for papers using Scopus query syntax (e.g., `TITLE(AI) AND PUBYEAR > 2023`) |
| `get_abstract_details`  | Get the full abstract, authors, and metadata for a specific paper            |
| `get_author_profile`    | Look up an author's profile, citations, and affiliation                      |
| `get_citing_papers`     | Find all papers that cited a specific paper (forward citation search)        |
| `get_quota_status`      | Check how many Scopus API requests you have left                             |

### Prompts (2 prompts)

| Prompt             | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `research-summary`  | Guides the AI to search a topic and summarize findings     |
| `author-analysis`   | Guides the AI to pull up an author's profile and analyze their impact |

---

## Security — Two Keys, Two Purposes

This server uses **two separate keys** for two different security layers:

| What                    | Purpose                                              | Who provides it               |
| ----------------------- | ---------------------------------------------------- | ----------------------------- |
| **Bearer token** (access) | Proves you're allowed to use this MCP server        | The **admin** gives this to you |
| **Scopus API key** (usage) | Authenticates each search with Elsevier's API       | **You** bring your own key     |

**The bearer token unlocks the door. Your Scopus API key runs the search.**

If a colleague leaves or a token is compromised, the admin generates a new one and the old one stops working instantly — no redeploy needed.

You get your own Scopus API key free from [Elsevier Developer Portal](https://dev.elsevier.com/).

---

## Quick Start (for users)

You need three things from the person who deployed this server:
1. The **server URL**
2. A **bearer token** (your access key)
3. Your own **Scopus API key** (get it from [Elsevier](https://dev.elsevier.com/))

### Configure Claude Desktop

Open Settings → Developer → Edit Config and add:

```json
{
  "mcpServers": {
    "scopus": {
      "url": "https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer <bearer-token-from-admin>",
        "X-Scopus-Api-Key": "<your-own-scopus-api-key>"
      }
    }
  }
}
```

Restart Claude Desktop, then try:
> *"Search for papers on machine learning in healthcare from 2024"*

### What each header does

| Header               | Required? | Value                                         |
| -------------------- | --------- | --------------------------------------------- |
| `Authorization`        | ✅ Yes      | `Bearer <token>` — proves you're allowed to use this MCP server |
| `X-Scopus-Api-Key`     | ✅ Yes      | Your personal Elsevier Scopus API key — authenticates searches |
| `X-ELS-InstToken`      | ⬜ No       | Your institutional token for remote IP access (see below) |

### If you're outside your institution's network

Elsevier's Scopus API identifies your institutional affiliation by your **IP address**. If your API key was created through your university, direct requests from a deployed Cloudflare Worker may fail because the Worker's IP isn't recognized.

**Solution:** Add your **InstToken** (Institutional Token) as an extra header. Get one by emailing **integrationsupport@elsevier.com** with your API key and institution name, or ask your institution's library. Once you have it:

```json
{
  "headers": {
    "Authorization": "Bearer <your-token>",
    "X-Scopus-Api-Key": "<your-scopus-key>",
    "X-ELS-InstToken": "<your-insttoken>"
  }
}
```

---

## 🚀 Running on Cloudflare (Remote)

### Authentication

#### Layer 1 — Bearer Token (Server Gate)

Set these as Cloudflare Worker secrets:

```bash
wrangler secret put OWNER_API_KEY   # Your personal token
wrangler secret put TEAM_API_KEY    # Shared token for colleagues
```

Generate keys with `openssl rand -base64 32`.

#### Layer 2 — Per-User Scopus API Key

Every user (including you) passes their own Scopus API key via the `X-Scopus-Api-Key` header. There is **no shared server-side Scopus key**.

### Client Configuration

**You (owner):**
```json
{
  "scopus": {
    "command": "npx",
    "args": [
      "mcp-remote",
      "https://scopus-mcp-cf.<your-account>.workers.dev/mcp",
      "--header",
      "Authorization:Bearer <YOUR_OWNER_API_KEY>",
      "--header",
      "X-Scopus-Api-Key:<your-scopus-key>"
    ]
  }
}
```

**Colleagues (team):**
```json
{
  "scopus": {
    "command": "npx",
    "args": [
      "mcp-remote",
      "https://scopus-mcp-cf.<your-account>.workers.dev/mcp",
      "--header",
      "Authorization:Bearer <SHARED_TEAM_API_KEY>",
      "--header",
      "X-Scopus-Api-Key:<their-own-scopus-key>"
    ]
  }
}
```

### With InstToken
```json
{
  "scopus": {
    "command": "npx",
    "args": [
      "mcp-remote",
      "https://scopus-mcp-cf.<your-account>.workers.dev/mcp",
      "--header",
      "Authorization:Bearer <your-token>",
      "--header",
      "X-Scopus-Api-Key:<your-scopus-key>",
      "--header",
      "X-ELS-InstToken:<your-insttoken>"
    ]
  }
}
```

### Deploy

```bash
# 1. Set secrets
wrangler secret put OWNER_API_KEY
wrangler secret put TEAM_API_KEY

# 2. Deploy
npm run deploy
```

---

## 💻 Running Locally (Stdio)

No Cloudflare account needed. Runs on any machine with Node.js.

```bash
# 1. Clone
git clone https://github.com/cmdaltctr/scopus-mcp-cf.git
cd scopus-mcp-cf

# 2. Install
npm install

# 3. Run
SCOPUS_API_KEY=your-key npm run local
```

The `SCOPUS_API_KEY` is required (your Elsevier Scopus API key). Optionally set `SCOPUS_INST_TOKEN` if you need institutional IP bypass.

### MCP Client Configuration

After cloning, configure your MCP client using the **absolute path** to the repo (replace `/path/to/scopus-mcp-cf` below):

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "scopus": {
      "command": "npx",
      "args": ["tsx", "/path/to/scopus-mcp-cf/src/local.ts"],
      "env": {
        "SCOPUS_API_KEY": "your-scopus-api-key"
      }
    }
  }
}
```

#### Claude Code (CLI)

Add to your project or global config:

```bash
# Project-level
claude mcp add scopus -- npx tsx /path/to/scopus-mcp-cf/src/local.ts
claude mcp set scopus --env SCOPUS_API_KEY=your-scopus-api-key

# Or global (user-level)
claude mcp add --scope user scopus -- npx tsx /path/to/scopus-mcp-cf/src/local.ts
claude mcp set --scope user scopus --env SCOPUS_API_KEY=your-scopus-api-key
```

Or add directly to `.claude/settings.json` or `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "scopus": {
      "command": "npx",
      "args": ["tsx", "/path/to/scopus-mcp-cf/src/local.ts"],
      "env": {
        "SCOPUS_API_KEY": "your-scopus-api-key"
      }
    }
  }
}
```

#### OpenCode

Add to `~/.config/opencode/opencode.json` or project-level `opencode.json`:

```json
{
  "mcp": {
    "scopus": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "/path/to/scopus-mcp-cf/src/local.ts"],
      "env": {
        "SCOPUS_API_KEY": "your-scopus-api-key"
      }
    }
  }
}
```

#### Cursor / Other MCP Clients

Use the same stdio pattern:

```json
{
  "scopus": {
    "command": "npx",
    "args": ["tsx", "/path/to/scopus-mcp-cf/src/local.ts"],
    "env": {
      "SCOPUS_API_KEY": "your-scopus-api-key"
    }
  }
}
```

#### Adding Institutional IP Bypass (Optional)

If your Scopus API key is tied to a university or research institution, Elsevier identifies your entitlements by IP address. Requests from outside your institution's network (home wifi, cloud VMs) may be rejected or return partial results.

The fix is an **InstToken** (Institutional Token) — request one from **integrationsupport@elsevier.com** with your API key and institution name.

Add `SCOPUS_INST_TOKEN` to the `env` block of any local config above:

```json
"env": {
  "SCOPUS_API_KEY": "your-scopus-api-key",
  "SCOPUS_INST_TOKEN": "your-insttoken-from-elsevier"
}
```

The token is attached to every outbound Scopus request as the `X-ELS-InstToken` header. It never leaves your machine — local stdio is server-side from Elsevier's perspective, and the only network hop is HTTPS to `api.elsevier.com`. Don't commit the token to git.

---

## For Your AI - One-Click Setup Prompt

Copy the entire block below and paste it to your AI coding agent (Claude, OpenCode, Cursor, etc.). The AI will handle everything automatically.

> **Instructions**: Replace `<path-to-project>` with the folder where you want it installed (e.g., `~/projects` or `C:\Users\You\projects`).

---

```
You are installing the scopus-mcp-cf project. This is an MCP server that searches academic papers on Scopus (Elsevier's research database) using 5 tools.

INSTALLATION DIRECTORY: <path-to-project>/scopus-mcp-cf

STEPS:
1. Clone the repo: git clone https://github.com/cmdaltctr/scopus-mcp-cf.git <path-to-project>/scopus-mcp-cf
2. cd into the directory
3. Run: npm install
4. Run: npx tsc --noEmit  (verify type check passes)
5. Run: SCOPUS_API_KEY=demo npm run local
   (kill it after 3 seconds to confirm it starts)

After installation, configure the MCP client. Use the ABSOLUTE path to src/local.ts:

For Claude Desktop (edit claude_desktop_config.json):
{
  "mcpServers": {
    "scopus": {
      "command": "npx",
      "args": ["tsx", "ABSOLUTE_PATH/src/local.ts"],
      "env": { "SCOPUS_API_KEY": "<your-scopus-api-key>" }
    }
  }
}

For Claude Code (run in terminal):
claude mcp add scopus -- npx tsx ABSOLUTE_PATH/src/local.ts
claude mcp set scopus --env SCOPUS_API_KEY=<your-scopus-api-key>

For OpenCode (edit opencode.json):
{
  "mcp": {
    "scopus": {
      "type": "stdio",
      "command": "npx",
      "args": ["tsx", "ABSOLUTE_PATH/src/local.ts"],
      "env": { "SCOPUS_API_KEY": "<your-scopus-api-key>" }
    }
  }
}

To test it works, ask the user to try: "search for papers about machine learning in healthcare using the search_scopus tool"

NOTES:
- No Cloudflare account needed for local setup
- SCOPUS_API_KEY is required (get one free at https://dev.elsevier.com/)
- Optionally set SCOPUS_INST_TOKEN if your institution requires it
- All 5 tools + 2 prompts will be available after restarting the MCP client
```

---

## Deployment Guide (for admins)

### Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- An [Elsevier Scopus API key](https://dev.elsevier.com/) (free with institutional access)
- Node.js installed on your computer

### Step 1 — Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser — log in to your Cloudflare account and grant access.

### Step 2 — Set your secrets

```bash
# Your personal bearer token (generate with openssl)
openssl rand -base64 32 | npx wrangler secret put OWNER_API_KEY

# Shared bearer token for colleagues
openssl rand -base64 32 | npx wrangler secret put TEAM_API_KEY
```

### Step 3 — Deploy

```bash
npm run deploy
```

Your server will be live at `https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp`

### Step 4 — Test it

```bash
npx @modelcontextprotocol/inspector@latest
```

In the inspector, enter your deployed URL and set these headers:
- `Authorization: Bearer <your-owner-token>`
- `X-Scopus-Api-Key: <your-scopus-api-key>`

Click **Connect**, then **List Tools** — you should see all 5 tools.

### Changing the Team Key

```bash
openssl rand -base64 32                    # Generate new key
echo "new-key-here" | npx wrangler secret put TEAM_API_KEY   # Update instantly
```

The old key stops working immediately — no redeploy needed.

---

## Development

```bash
# Install dependencies
npm install

# Start local stdio server (standalone, no Cloudflare)
SCOPUS_API_KEY=your-key npm run local

# Start Cloudflare dev server (requires .env with OWNER_API_KEY and TEAM_API_KEY)
npm run dev

# Deploy to Cloudflare
npm run deploy

# Type check
npm run type-check

# Test with MCP Inspector
npx @modelcontextprotocol/inspector
```

## Project Structure

```
src/
├── index.ts     — Entry point: auth middleware + creates MCP handler
├── server.ts    — MCP server factory: all 5 tools + 2 prompts (zero CF deps)
├── local.ts     — Stdio entry point for local running
├── client.ts    — Makes HTTP calls to the Elsevier Scopus API
├── utils.ts     — Cleans up raw API responses into neat JSON
├── types.ts     — Shared types (ScopusAuthContext)
└── env.d.ts     — Cloudflare Worker environment types
```

## Tech Stack

- **Runtime:** Cloudflare Workers (remote) / Node.js (local)
- **MCP Framework:** `@modelcontextprotocol/sdk` + `agents` (Cloudflare)
- **Validation:** `zod`
- **Auth:** Bearer token (checked on every request, no sessions)
- **Deployment:** Wrangler CLI

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  MCP Client     │────▶│  Cloudflare      │────▶│  Scopus API     │
│  (Claude, etc.) │     │  Worker          │     │  (Elsevier)     │
│  Bearer + Key   │     │  createMcpHandler │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                         ┌────┴────┐
                         │  Auth   │
                         │ Bearer  │
                         │ Check   │
                         └─────────┘

Or locally via stdio:

┌─────────────────┐     ┌──────────────────┐
│  MCP Client     │────▶│  StdioServer      │
│  (stdio config) │     │  Transport       │
│                 │     │  src/local.ts    │
└─────────────────┘     └──────────────────┘
```

## Related

- [scopus-mcp](https://github.com/cmdaltctr/scopus-mcp) — The original Python MCP server (for local use with `uv`)
- [Elsevier Scopus API](https://dev.elsevier.com/) — Get your free API key
- [MCP Specification](https://modelcontextprotocol.io/) — Learn more about the Model Context Protocol
