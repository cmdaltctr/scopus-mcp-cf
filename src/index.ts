import { createMcpHandler } from "agents/mcp";
import type { ScopusAuthContext } from "./types";
import { createServer } from "./server";

/**
 * Authenticate the incoming request and extract the Scopus credentials.
 *
 * Returns a `Response` (error) or a `ScopusAuthContext` (success). The caller
 * distinguishes the two with `instanceof Response`. No request mutation.
 *
 * Credentials are per-user, supplied via headers — same shape as local mode:
 *   - `X-Scopus-Api-Key`  — required, the caller's own Elsevier API key
 *   - `X-ELS-InstToken`   — optional, only set when institutional IP bypass is needed
 */
function authenticate(request: Request, env: Env): Response | ScopusAuthContext {
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

  const apiKey = request.headers.get("X-Scopus-Api-Key");
  if (!apiKey) {
    return new Response("X-Scopus-Api-Key header is required", { status: 400 });
  }

  const instToken = request.headers.get("X-ELS-InstToken") || null;
  return { apiKey, instToken };
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const result = authenticate(request, env);
      if (result instanceof Response) return result;

      const server = createServer(result);
      return createMcpHandler(server)(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
