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
  console.error("Fatal error:", err);
  process.exit(1);
});
