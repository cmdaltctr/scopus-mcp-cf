# Scopus MCP — Cloudflare Worker

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets you search academic papers on Scopus using AI assistants like Claude.

**No Python, no `uv`, no local installation.** Your AI assistant talks to this server over the internet.

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

| Tool                  | What it does                                                                 |
| --------------------- | ---------------------------------------------------------------------------- |
| `search_scopus`         | Search for papers using Scopus query syntax (e.g., `TITLE(AI) AND PUBYEAR > 2023`) |
| `get_abstract_details`  | Get the full abstract, authors, and metadata for a specific paper            |
| `get_author_profile`    | Look up an author's profile, citations, and affiliation                      |
| `get_citing_papers`     | Find all papers that cited a specific paper (forward citation search)        |
| `get_quota_status`      | Check how many Scopus API requests you have left                             |

**Prompts** (pre-built conversation starters):
- `research-summary` — Guides the AI to search a topic and summarize findings
- `author-analysis` — Guides the AI to pull up an author's profile and analyze their impact

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

The `OWNER_API_KEY` and `TEAM_API_KEY` are just random strings — they're how your MCP server identifies authorized users. They're separate from Scopus entirely.

> There is no shared `SCOPUS_API_KEY`. Every user (including you) passes their own Scopus API key via the `X-Scopus-Api-Key` header in their MCP client config.

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

---

## Quick Config Reference

### You (the admin) — uses your own key
```json
{
  "url": "https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp",
  "headers": {
    "Authorization": "Bearer <OWNER_API_KEY>",
    "X-Scopus-Api-Key": "<your-scopus-api-key>"
  }
}
```

### A colleague — uses their own key
```json
{
  "url": "https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp",
  "headers": {
    "Authorization": "Bearer <TEAM_API_KEY>",
    "X-Scopus-Api-Key": "<their-scopus-api-key>"
  }
}
```

### With InstToken (if outside institutional network)
```json
{
  "url": "https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp",
  "headers": {
    "Authorization": "Bearer <your-token>",
    "X-Scopus-Api-Key": "<your-scopus-api-key>",
    "X-ELS-InstToken": "<your-insttoken-from-elsevier>"
  }
}
```

---

## Changing the Team Key

```bash
openssl rand -base64 32                    # Generate new key
echo "new-key-here" | npx wrangler secret put TEAM_API_KEY   # Update instantly
```

The old key stops working immediately — no redeploy needed.

---

## Local Development

```bash
npm start            # Dev server at http://localhost:8787
```

The `.env` file has your local secrets (this file is gitignored — never commit it).

---

## Project Structure

```
src/
├── index.ts     — Entry point: auth middleware + 5 tools + 2 prompts
├── client.ts    — Makes HTTP calls to the Elsevier Scopus API
├── utils.ts     — Cleans up raw API responses into neat JSON
└── env.d.ts     — TypeScript type definitions
```

---

## Tech Stack

- **Runtime:** Cloudflare Workers
- **MCP Framework:** `@modelcontextprotocol/sdk` + `agents` (Cloudflare)
- **Validation:** `zod`
- **Auth:** Bearer token (checked on every request, no sessions)
- **Deployment:** Wrangler CLI

---

## Related

- [scopus-mcp](https://github.com/cmdaltctr/scopus-mcp) — The original Python MCP server (for local use with `uv`)
- [Elsevier Scopus API](https://dev.elsevier.com/) — Get your free API key
- [MCP Specification](https://modelcontextprotocol.io/) — Learn more about the Model Context Protocol
