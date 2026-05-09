# Scopus MCP — Cloudflare Worker

A remote [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that lets you search academic papers on Scopus using AI assistants like Claude.

**No installation needed.** Your AI assistant talks to this server over the internet — no Python, no `uv`, no local setup.

---

## How It Works

```
You ask Claude (or any AI)    ──►    This Cloudflare Worker    ──►    Scopus API
to find papers on a topic            searches Scopus for you          returns results
```

The worker runs on Cloudflare's edge network. You connect to it from Claude Desktop, Cursor, or any MCP client using a simple web address.

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

## Security

This server uses **Bearer token authentication**. You need a secret token to connect.

- **Owner key** — for you (the person who deployed this)
- **Team key** — a shared key for colleagues (can be changed at any time)

If a key is compromised or a colleague leaves, you can generate a new one and the old one stops working instantly.

---

## Quick Start (for users)

If someone has already deployed this server and given you a token:

1. Open your Claude Desktop settings → Developer → Edit Config
2. Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "scopus": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp"
      ],
      "headers": {
        "Authorization": "Bearer <your-token-here>"
      }
    }
  }
}
```

3. Restart Claude Desktop
4. Try asking: *"Search for papers on machine learning in healthcare from 2024"*

> **Note:** `npx` comes with Node.js. If you don't have Node, install it first from [nodejs.org](https://nodejs.org/).

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
# Your Elsevier Scopus API key
echo "your-scopus-api-key-here" | npx wrangler secret put SCOPUS_API_KEY

# Your personal auth token (generate one)
openssl rand -base64 32 | npx wrangler secret put OWNER_API_KEY

# Shared token for colleagues (generate another)
openssl rand -base64 32 | npx wrangler secret put TEAM_API_KEY
```

Come up with your own tokens instead of using "owner" or "team" as values. The `openssl rand -base64 32` command generates a secure random string.

### Step 3 — Deploy

```bash
npm run deploy
```

Your server will be live at:
`https://scopus-mcp-cf.YOUR_ACCOUNT.workers.dev/mcp`

Find your account name in the Cloudflare dashboard URL — it's the part after `dash.cloudflare.com/`.

### Step 4 — Test it

```bash
npx @modelcontextprotocol/inspector@latest
```

In the inspector, enter your deployed URL and set the header:
`Authorization: Bearer <your-owner-token>`

Click **Connect**, then **List Tools** — you should see all 5 tools.

---

## Local Development

```bash
# Start the dev server
npm start

# It runs at http://localhost:8787
```

The `.env` file has your local secrets (this file is gitignored — never commit it).

## Changing the Team Key

```bash
# Generate a new key
openssl rand -base64 32

# Update it instantly (no redeploy needed)
npx wrangler secret put TEAM_API_KEY
```

The old key stops working immediately — every request is checked against the current secret.

---

## Project Structure

```
src/
├── index.ts     — Entry point: auth middleware + tool definitions + prompts
├── client.ts    — Makes HTTP calls to the Elsevier Scopus API
├── utils.ts     — Cleans up raw API responses into neat JSON
└── env.d.ts     — TypeScript type definitions for environment variables
```

---

## Tech Stack

- **Runtime:** Cloudflare Workers (JavaScript/TypeScript)
- **MCP Framework:** `@modelcontextprotocol/sdk` + `agents` (Cloudflare)
- **Validation:** `zod`
- **Deployment:** Wrangler CLI
- **Auth:** Bearer token (checked on every request, no sessions)

---

## Related

- [scopus-mcp](https://github.com/cmdaltctr/scopus-mcp) — The original Python MCP server (for local use with `uv`)
- [Elsevier Scopus API](https://dev.elsevier.com/) — Get your free API key
- [MCP Specification](https://modelcontextprotocol.io/) — Learn more about the Model Context Protocol
