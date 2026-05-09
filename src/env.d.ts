interface Env {
  /**
   * Default Scopus API key (fallback).
   * Users can instead send their own key via the X-Scopus-Api-Key header.
   */
  SCOPUS_API_KEY: string;
  /** Your personal bearer token for the MCP server */
  OWNER_API_KEY: string;
  /** Shared bearer token for colleagues */
  TEAM_API_KEY: string;
}
