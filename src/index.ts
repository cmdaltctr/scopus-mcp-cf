import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ScopusClient } from "./client";
import {
  cleanSearchResults,
  cleanAbstractDetails,
  cleanAuthorProfile,
} from "./utils";

// ─── Auth Middleware ────────────────────────────────────────────────

/**
 * Validates the Bearer token from the Authorization header.
 * Accepts either OWNER_API_KEY or TEAM_API_KEY.
 * Also requires the user's Scopus API key via X-Scopus-Api-Key header.
 * Returns a Response (error) or null (OK) + attaches key to request context.
 */
const SCOPUS_KEY_CTX = "__scopusApiKey";

function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer "
  const validTokens = [env.OWNER_API_KEY, env.TEAM_API_KEY];

  if (!validTokens.includes(token)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Require the user's own Scopus API key via header (no fallback)
  const scopusKey = request.headers.get("X-Scopus-Api-Key");
  if (!scopusKey) {
    return new Response("X-Scopus-Api-Key header is required", { status: 400 });
  }
  (request as any)[SCOPUS_KEY_CTX] = scopusKey;

  return null; // Auth OK
}

// ─── MCP Server Factory ────────────────────────────────────────────

function createServer(scopusKey: string): McpServer {
  const client = new ScopusClient(scopusKey);
  const server = new McpServer({
    name: "Scopus MCP",
    version: "0.1.0",
  });

  // ── Tool 1: search_scopus ──
  server.tool(
    "search_scopus",
    "Search for documents in Scopus using a query string.",
    {
      query: z.string().describe(
        "The Scopus search query (e.g., 'TITLE(AI) AND PUBYEAR > 2020').",
      ),
      count: z
        .number()
        .min(1)
        .max(25)
        .default(5)
        .describe("Number of results to return (default 5, max 25)."),
      sort: z
        .string()
        .default("coverDate")
        .describe("Sort order (e.g., 'coverDate', 'relevancy')."),
    },
    async ({ query, count, sort }) => {
      const raw = await client.searchScopus(query, count, sort);
      const results = cleanSearchResults(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ── Tool 2: get_abstract_details ──
  server.tool(
    "get_abstract_details",
    "Retrieve full details for a specific document by Scopus ID.",
    {
      scopus_id: z.string().describe("The Scopus ID of the document."),
    },
    async ({ scopus_id }) => {
      const raw = await client.getAbstract(scopus_id);
      const details = cleanAbstractDetails(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
      };
    },
  );

  // ── Tool 3: get_author_profile ──
  server.tool(
    "get_author_profile",
    "Retrieve an author's profile by Author ID.",
    {
      author_id: z.string().describe("The Scopus Author ID."),
    },
    async ({ author_id }) => {
      const raw = await client.getAuthor(author_id);
      const profile = cleanAuthorProfile(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      };
    },
  );

  // ── Tool 4: get_citing_papers ──
  server.tool(
    "get_citing_papers",
    "Retrieve a list of papers that have cited the specified document (Forward Citations).",
    {
      scopus_id: z
        .string()
        .describe("The Scopus ID of the document to find citations for."),
      count: z
        .number()
        .min(1)
        .max(25)
        .default(5)
        .describe("Number of results to return (default 5, max 25)."),
      sort: z
        .string()
        .default("coverDate")
        .describe("Sort order (e.g., 'coverDate', 'relevancy')."),
    },
    async ({ scopus_id, count, sort }) => {
      const cleanId = scopus_id.replace("SCOPUS_ID:", "");
      const query = `REFEID(${cleanId})`;
      const raw = await client.searchScopus(query, count, sort);
      const results = cleanSearchResults(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ── Tool 5: get_quota_status ──
  server.tool(
    "get_quota_status",
    "Get the current API quota status (remaining/limit). Note: Values are updated only after making a request.",
    {},
    async () => {
      const quota = await client.getQuotaStatus();
      if (!quota || Object.keys(quota).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No quota information available yet. Please make a request first.",
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(quota, null, 2) }],
      };
    },
  );

  // ── Prompt: research-summary ──
  server.prompt(
    "research-summary",
    "Search for papers on a topic and generate a research summary",
    {
      topic: z
        .string()
        .describe("The research topic (e.g., 'machine learning healthcare')."),
    },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please search specifically for high-cited papers related to '${topic}' published in the last 5 years using the search_scopus tool. Sort by cited references if possible. After retrieving the results, please summarize the key trends and findings in this field.`,
          },
        },
      ],
    }),
  );

  // ── Prompt: author-analysis ──
  server.prompt(
    "author-analysis",
    "Analyze an author's research impact and recent work",
    {
      author_id: z.string().describe("The Scopus Author ID."),
    },
    ({ author_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please call the get_author_profile tool for Author ID '${author_id}'. Based on the returned data, analyze their research impact (citations, h-index if available), identify their main affiliation, and summarize their academic standing.`,
          },
        },
      ],
    }),
  );

  return server;
}

// ─── Worker Entry Point ────────────────────────────────────────────

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Only handle the /mcp path
    if (url.pathname === "/mcp") {
      // Authenticate before routing to MCP
      const authError = authenticate(request, env);
      if (authError) return authError;

      const scopusKey = (request as any)[SCOPUS_KEY_CTX];
      const server = createServer(scopusKey);
      return createMcpHandler(server)(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
