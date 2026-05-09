import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ScopusAuthContext } from "./types";
import { ScopusClient } from "./client";
import {
  cleanSearchResults,
  cleanAbstractDetails,
  cleanAuthorProfile,
} from "./utils";

type ToolResult = {
  content: { type: "text"; text: string }[];
};

function withErrorHandling<T extends Record<string, any>>(
  fn: (args: T) => Promise<ToolResult>,
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { error: err.message ?? "Unknown error" },
              null,
              2,
            ),
          },
        ],
      };
    }
  };
}

export function createServer(auth: ScopusAuthContext): McpServer {
  const client = new ScopusClient(auth.apiKey, auth.instToken);
  const server = new McpServer({
    name: "Scopus MCP",
    version: "0.1.0",
  });

  // ── Tool: search_scopus ──
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
    withErrorHandling(async ({ query, count, sort }) => {
      const raw = await client.searchScopus(query, count, sort);
      const results = cleanSearchResults(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }),
  );

  // ── Tool: get_abstract_details ──
  server.tool(
    "get_abstract_details",
    "Retrieve full details for a specific document by Scopus ID.",
    {
      scopus_id: z.string().describe("The Scopus ID of the document."),
    },
    withErrorHandling(async ({ scopus_id }) => {
      const raw = await client.getAbstract(scopus_id);
      const details = cleanAbstractDetails(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
      };
    }),
  );

  // ── Tool: get_author_profile ──
  server.tool(
    "get_author_profile",
    "Retrieve an author's profile by Author ID.",
    {
      author_id: z.string().describe("The Scopus Author ID."),
    },
    withErrorHandling(async ({ author_id }) => {
      const raw = await client.getAuthor(author_id);
      const profile = cleanAuthorProfile(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      };
    }),
  );

  // ── Tool: get_citing_papers ──
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
    withErrorHandling(async ({ scopus_id, count, sort }) => {
      const cleanId = scopus_id.replace("SCOPUS_ID:", "");
      const query = `REFEID(${cleanId})`;
      const raw = await client.searchScopus(query, count, sort);
      const results = cleanSearchResults(raw);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }),
  );

  // ── Tool: get_quota_status ──
  server.tool(
    "get_quota_status",
    "Get the current API quota status (remaining/limit). Note: Values are updated only after making a request.",
    {},
    withErrorHandling(async () => {
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
    }),
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
