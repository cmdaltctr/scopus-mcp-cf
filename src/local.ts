#!/usr/bin/env node
/// <reference types="node" />
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

async function main() {
  const apiKey = process.env.SCOPUS_API_KEY;
  if (!apiKey) {
    console.error("SCOPUS_API_KEY environment variable is required");
    process.exit(1);
  }

  const auth = {
    apiKey,
    instToken: process.env.SCOPUS_INST_TOKEN ?? null,
  };

  const server = createServer(auth);
  const transport = new StdioServerTransport();

  console.error("scopus-mcp-cf starting via stdio...");
  await server.connect(transport);
}

main().catch((err) => {
  // S-004: log only the message — full Error objects may pick up sensitive
  // context as the code evolves, and stderr is captured by MCP clients.
  console.error("Fatal error:", (err as Error).message ?? String(err));
  process.exit(1);
});
