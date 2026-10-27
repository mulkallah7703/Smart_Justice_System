/**
 * Qdrant Cloud HTTPS URLs use port 443. The REST client reads `URL.port`,
 * which is empty for the scheme default, then falls back to 6333. The port is
 * taken from the raw URL first so `:443` is kept.
 */
export interface QdrantEndpoint {
  url: string;
  port: number;
  /** `scheme://host:port` with no path. Readiness probes append `/readyz`. */
  restBase: string;
}

const EXPLICIT_PORT =
  /^[a-z][a-z0-9+.-]*:\/\/(?:\[[^\]]+\]|[^/?#]*?):(\d+)(?=[/?#]|$)/i;

export const parseQdrantUrl = (raw: string): QdrantEndpoint => {
  const url = raw.trim().replace(/\/+$/, '');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('AI_QDRANT_URL must be an http or https URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('AI_QDRANT_URL must start with http:// or https://');
  }

  const explicit = url.match(EXPLICIT_PORT);
  const port = explicit
    ? Number(explicit[1])
    : parsed.protocol === 'https:'
      ? 443
      : 6333;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('AI_QDRANT_URL has an invalid port');
  }

  const host = parsed.hostname.includes(':')
    ? `[${parsed.hostname}]`
    : parsed.hostname;
  return {
    url,
    port,
    restBase: `${parsed.protocol}//${host}:${port}`,
  };
};

export const qdrantClientOptions = (
  rawUrl: string,
  apiKey: string | null | undefined,
): {
  url: string;
  port: number;
  apiKey?: string;
  checkCompatibility: false;
} => {
  const endpoint = parseQdrantUrl(rawUrl);
  const key = apiKey?.trim();
  return {
    url: endpoint.url,
    port: endpoint.port,
    checkCompatibility: false,
    ...(key ? { apiKey: key } : {}),
  };
};

/** `/readyz` on the parsed host and port, with the Cloud `api-key` header. */
export const qdrantReadyRequest = (
  rawUrl: string,
  apiKey: string | null | undefined,
): { url: string; headers: Record<string, string> } => {
  const endpoint = parseQdrantUrl(rawUrl);
  const key = apiKey?.trim();
  return {
    url: `${endpoint.restBase}/readyz`,
    headers: key ? { 'api-key': key } : {},
  };
};
