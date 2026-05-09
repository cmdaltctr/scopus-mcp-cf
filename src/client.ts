/**
 * ScopusClient — makes HTTP requests to the Elsevier Scopus API.
 *
 * Runs inside a Cloudflare Worker using the built-in `fetch()`.
 * No external HTTP libraries needed.
 */
export class ScopusClient {
  private apiKey: string;
  private instToken: string | null;
  private baseUrl = "https://api.elsevier.com";
  private quotaInfo: Record<string, unknown> = {};

  constructor(apiKey: string, instToken?: string | null) {
    this.apiKey = apiKey;
    this.instToken = instToken ?? null;
  }

  /**
   * Internal method for all Scopus API requests.
   * Handles auth headers, error mapping, and quota tracking.
   */
  private async request(
    endpoint: string,
    params?: Record<string, string | number>,
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      "X-ELS-APIKey": this.apiKey,
      Accept: "application/json",
    };
    // Forward InstToken if provided — allows access from non-institutional IPs
    if (this.instToken) {
      headers["X-ELS-InstToken"] = this.instToken;
    }

    const response = await fetch(url.toString(), { headers });

    // Track rate-limit headers for getQuotaStatus
    this.quotaInfo = {
      limit: response.headers.get("X-RateLimit-Limit") ?? "unknown",
      remaining: response.headers.get("X-RateLimit-Remaining") ?? "unknown",
      reset: response.headers.get("X-RateLimit-Reset") ?? "unknown",
      status: "OK",
    };

    if (!response.ok) {
      // Read the response body for debugging
      let body = "";
      try { body = await response.text(); } catch {}
      switch (response.status) {
        case 401:
          throw new Error("Authentication failed: Invalid Scopus API Key");
        case 404:
          return {};
        case 429:
          throw new Error("Rate limit exceeded. Please wait and try again.");
        default:
          throw new Error(`Scopus API error: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
      }
    }

    return response.json();
  }

  /**
   * Search Scopus using the standard query syntax.
   * Endpoint: GET /content/search/scopus
   */
  async searchScopus(
    query: string,
    count: number = 25,
    sort: string = "coverDate",
  ): Promise<any> {
    return this.request("/content/search/scopus", {
      query,
      count,
      start: 0,
      sort,
      view: "STANDARD",
    });
  }

  /**
   * Retrieve abstract details for a specific Scopus ID.
   * Endpoint: GET /content/abstract/scopus_id/{id}
   */
  async getAbstract(scopusId: string): Promise<any> {
    const cleanId = scopusId.replace("SCOPUS_ID:", "");
    return this.request(`/content/abstract/scopus_id/${cleanId}`);
  }

  /**
   * Retrieve author profile by Author ID.
   * Endpoint: GET /content/author/author_id/{id}
   */
  async getAuthor(authorId: string): Promise<any> {
    const cleanId = authorId.replace("AUTHOR_ID:", "");
    return this.request(`/content/author/author_id/${cleanId}`);
  }

  /**
   * Return the latest known quota status from response headers.
   */
  async getQuotaStatus(): Promise<Record<string, unknown>> {
    return this.quotaInfo;
  }
}
