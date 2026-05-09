/**
 * Response cleaners — transform raw Scopus API JSON into clean, structured objects.
 * Ported from the Python scopus-mcp utils.py.
 */

// ── Types ──

export interface SearchResult {
  scopus_id: string;
  title: string | null;
  creator: string | null;
  publication_name: string | null;
  cover_date: string | null;
  doi: string | null;
  cited_by_count: string | null;
  aggregation_type: string | null;
  url: string | null;
}

export interface AuthorEntry {
  auth_id: string | null;
  name: string | null;
  surname: string | null;
  initials: string | null;
}

export interface AbstractDetails {
  scopus_id: string;
  doi: string | null;
  title: string | null;
  description: string | null;
  publication_name: string | null;
  cover_date: string | null;
  cited_by_count: string | null;
  authors: AuthorEntry[];
  url: string | null;
}

export interface AuthorProfile {
  author_id: string;
  orcid: string | null;
  document_count: string | null;
  cited_by_count: string | null;
  citation_count: string | null;
  name: {
    surname: string | null;
    given_name: string | null;
    initials: string | null;
  } | null;
  current_affiliation: string | null;
  url: string | null;
}

// ── Cleaners ──

/**
 * Extract and normalize search results from the Scopus Search API response.
 */
export function cleanSearchResults(data: any): SearchResult[] {
  if (!data || !data["search-results"]) {
    return [];
  }

  const entries: any[] = data["search-results"].entry ?? [];
  return entries.map((entry: any) => ({
    scopus_id: (entry["dc:identifier"] ?? "").replace("SCOPUS_ID:", ""),
    title: entry["dc:title"] ?? null,
    creator: entry["dc:creator"] ?? null,
    publication_name: entry["prism:publicationName"] ?? null,
    cover_date: entry["prism:coverDate"] ?? null,
    doi: entry["prism:doi"] ?? null,
    cited_by_count: entry["citedby-count"] ?? null,
    aggregation_type: entry["prism:aggregationType"] ?? null,
    url:
      (entry.link as Array<{ "@ref": string; "@href": string }> | undefined)
        ?.find((l) => l["@ref"] === "scopus")?.["@href"] ?? null,
  }));
}

/**
 * Extract relevant details from the Scopus Abstract Retrieval API response.
 */
export function cleanAbstractDetails(data: any): AbstractDetails {
  const root =
    data?.["abstracts-retrieval-response"] ??
    data?.["abstract-retrieval-response"];
  if (!root) {
    return {
      scopus_id: "",
      doi: null,
      title: null,
      description: null,
      publication_name: null,
      cover_date: null,
      cited_by_count: null,
      authors: [],
      url: null,
    };
  }

  const coredata = root.coredata ?? {};
  let authorsData = root.authors?.author ?? [];
  if (!Array.isArray(authorsData)) {
    authorsData = [authorsData];
  }

  const authors: AuthorEntry[] = authorsData.map((auth: any) => ({
    auth_id: auth["@auid"] ?? null,
    name: auth["ce:indexed-name"] ?? null,
    surname: auth["ce:surname"] ?? null,
    initials: auth["ce:initials"] ?? null,
  }));

  return {
    scopus_id: (coredata["dc:identifier"] ?? "").replace("SCOPUS_ID:", ""),
    doi: coredata["prism:doi"] ?? null,
    title: coredata["dc:title"] ?? null,
    description: coredata["dc:description"] ?? null,
    publication_name: coredata["prism:publicationName"] ?? null,
    cover_date: coredata["prism:coverDate"] ?? null,
    cited_by_count: coredata["citedby-count"] ?? null,
    authors,
    url:
      (coredata.link as Array<{ "@ref": string; "@href": string }> | undefined)
        ?.find((l) => l["@ref"] === "scopus")?.["@href"] ?? null,
  };
}

/**
 * Extract details from the Scopus Author Retrieval API response.
 */
export function cleanAuthorProfile(data: any): AuthorProfile {
  if (!data || !data["author-retrieval-response"]) {
    return {
      author_id: "",
      orcid: null,
      document_count: null,
      cited_by_count: null,
      citation_count: null,
      name: null,
      current_affiliation: null,
      url: null,
    };
  }

  const root = data["author-retrieval-response"];
  const coredata = root.coredata ?? {};
  const profile = root["author-profile"] ?? {};
  const nameVariant = profile["preferred-name"] ?? {};

  return {
    author_id: (coredata["dc:identifier"] ?? "").replace("AUTHOR_ID:", ""),
    orcid: coredata.orcid ?? null,
    document_count: coredata["document-count"] ?? null,
    cited_by_count: coredata["cited-by-count"] ?? null,
    citation_count: coredata["citation-count"] ?? null,
    name: {
      surname: nameVariant.surname ?? null,
      given_name: nameVariant["given-name"] ?? null,
      initials: nameVariant.initials ?? null,
    },
    current_affiliation: extractAffiliation(profile),
    url:
      (coredata.link as Array<{ "@ref": string; "@href": string }> | undefined)
        ?.find((l) => l["@ref"] === "scopus-author")?.["@href"] ?? null,
  };
}

/**
 * Extract the current affiliation name from the author profile.
 */
function extractAffiliation(profile: any): string | null {
  const affil = profile["affiliation-current"]?.affiliation ?? {};
  // If it's an array, take the first one
  const affilObj = Array.isArray(affil) ? (affil[0] ?? {}) : affil;
  return affilObj["ip-doc"]?.afdispname ?? null;
}
