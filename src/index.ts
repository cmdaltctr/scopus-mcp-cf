import { createMcpHandler } from "agents/mcp";
import type { ScopusAuthContext } from "./types";
import { createServer } from "./server";

const CTX_PREFIX = "__scopus_";

function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const token = authHeader.slice(7);
  const validTokens = [env.OWNER_API_KEY, env.TEAM_API_KEY];

  if (!validTokens.includes(token)) {
    return new Response("Forbidden", { status: 403 });
  }

  const scopusKey = request.headers.get("X-Scopus-Api-Key");
  if (!scopusKey) {
    return new Response("X-Scopus-Api-Key header is required", { status: 400 });
  }
  (request as any)[CTX_PREFIX + "apiKey"] = scopusKey;

  const instToken = request.headers.get("X-ELS-InstToken") || null;
  (request as any)[CTX_PREFIX + "instToken"] = instToken;

  return null;
}

function getAuthContext(request: Request): ScopusAuthContext {
  return {
    apiKey: (request as any)[CTX_PREFIX + "apiKey"] ?? "",
    instToken: (request as any)[CTX_PREFIX + "instToken"] ?? null,
  };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const authError = authenticate(request, env);
      if (authError) return authError;

      const auth = getAuthContext(request);
      const server = createServer(auth);
      return createMcpHandler(server)(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
