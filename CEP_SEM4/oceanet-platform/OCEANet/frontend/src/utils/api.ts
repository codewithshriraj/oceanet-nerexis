const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const LOCAL_FALLBACK_API_BASE_URL = 'http://localhost:8002';
const ALT_LOCALHOST_API_BASE_URL = 'http://localhost:8001';
const LOCALHOST_PORT_CANDIDATES = ['http://localhost:8000', 'http://localhost:8001'];

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_READ_TIMEOUT_MS = 30000;
const BASE_URL_CACHE_TTL_MS = 30000;
const BASE_URL_PROBE_TIMEOUT_MS = 900;

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  allowLocalFallback?: boolean;
  retryOnTimeout?: boolean;
  dedupeGetMs?: number;
};

const inFlightGetRequests = new Map<string, { startedAt: number; promise: Promise<Response> }>();
let cachedPreferredBaseUrl: string | null = null;
let cachedPreferredBaseUrlAt = 0;
let baseUrlProbeInFlight: Promise<string | null> | null = null;

const resolveApiUrl = (path: string, baseUrl: string = API_BASE_URL) => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const resolveLegacyPath = (path: string): string | null => {
  if (/^https?:\/\//i.test(path)) return null;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.startsWith('/_legacy/')) return null;

  const [pathname, query = ''] = normalized.split('?', 2);
  const supportsLegacyFallback =
    pathname.startsWith('/dashboard/') ||
    pathname.startsWith('/analytics/') ||
    pathname.startsWith('/biodiversity/') ||
    pathname.startsWith('/news/') ||
    pathname === '/datasets' ||
    pathname.startsWith('/datasets/') ||
    pathname.startsWith('/reports/sync/');

  if (!supportsLegacyFallback) return null;
  return `/_legacy${pathname}${query ? `?${query}` : ''}`;
};

const isLocalhostApi = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);

const canUseLocalFallback = () =>
  !process.env.NEXT_PUBLIC_API_BASE_URL &&
  API_BASE_URL !== LOCAL_FALLBACK_API_BASE_URL &&
  isLocalhostApi(API_BASE_URL);

const canUseAltLocalFallback = () =>
  isLocalhostApi(API_BASE_URL) &&
  API_BASE_URL !== ALT_LOCALHOST_API_BASE_URL;

const resolveLocalhostBaseCandidates = (): string[] => {
  if (!isLocalhostApi(API_BASE_URL)) return [API_BASE_URL];

  const ordered = [API_BASE_URL, ...LOCALHOST_PORT_CANDIDATES.filter((candidate) => candidate !== API_BASE_URL)];
  if (cachedPreferredBaseUrl && ordered.includes(cachedPreferredBaseUrl)) {
    return [cachedPreferredBaseUrl, ...ordered.filter((candidate) => candidate !== cachedPreferredBaseUrl)];
  }
  return ordered;
};

const probeBaseUrl = async (baseUrl: string): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BASE_URL_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

const resolvePreferredLocalBaseUrl = async (): Promise<string | null> => {
  if (!isLocalhostApi(API_BASE_URL)) return API_BASE_URL;

  const now = Date.now();
  if (cachedPreferredBaseUrl && (now - cachedPreferredBaseUrlAt) <= BASE_URL_CACHE_TTL_MS) {
    return cachedPreferredBaseUrl;
  }

  if (baseUrlProbeInFlight) {
    return await baseUrlProbeInFlight;
  }

  baseUrlProbeInFlight = (async () => {
    const candidates = resolveLocalhostBaseCandidates();
    for (const candidate of candidates) {
      const healthy = await probeBaseUrl(candidate);
      if (healthy) {
        cachedPreferredBaseUrl = candidate;
        cachedPreferredBaseUrlAt = Date.now();
        return candidate;
      }
    }
    cachedPreferredBaseUrl = null;
    cachedPreferredBaseUrlAt = Date.now();
    return null;
  })();

  try {
    return await baseUrlProbeInFlight;
  } finally {
    baseUrlProbeInFlight = null;
  }
};

const markPreferredLocalBaseUrl = (baseUrl: string) => {
  if (!isLocalhostApi(baseUrl)) return;
  cachedPreferredBaseUrl = baseUrl;
  cachedPreferredBaseUrlAt = Date.now();
};

const getOrderedLocalhostBases = (): string[] => {
  if (!isLocalhostApi(API_BASE_URL)) return [API_BASE_URL];

  const ordered = [API_BASE_URL, ...LOCALHOST_PORT_CANDIDATES.filter((candidate) => candidate !== API_BASE_URL)];
  if (cachedPreferredBaseUrl && ordered.includes(cachedPreferredBaseUrl)) {
    return [cachedPreferredBaseUrl, ...ordered.filter((candidate) => candidate !== cachedPreferredBaseUrl)];
  }

  return ordered;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, allowLocalFallback = true, retryOnTimeout = true, dedupeGetMs = 0, ...init } = options;
  const method = (init.method || 'GET').toUpperCase();
  const requestTimeoutMs = (method === 'GET' || method === 'HEAD')
    ? Math.min(timeoutMs, MAX_READ_TIMEOUT_MS)
    : timeoutMs;
  const legacyPath = resolveLegacyPath(path);

  // Always probe localhost candidates so requests stay stable when backend
  // moves between 8000/8001 in local runs, even for strict call sites.
  const preferredLocalBaseUrl = isLocalhostApi(API_BASE_URL)
    ? await resolvePreferredLocalBaseUrl()
    : null;

  const runWithTimeout = async (requestPath: string, baseUrl?: string, effectiveTimeoutMs: number = requestTimeoutMs) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    const effectiveBaseUrl = baseUrl ?? API_BASE_URL;
    try {
      const response = await fetch(resolveApiUrl(requestPath, effectiveBaseUrl), {
        ...init,
        signal: controller.signal,
      });
      if (response.ok) {
        markPreferredLocalBaseUrl(effectiveBaseUrl);
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    const runRequestWithRetry = async (requestPath: string) => {
      const dedupeWindowMs = Math.max(0, Number(dedupeGetMs || 0));
      const dedupeKey = `${method}:${resolveApiUrl(requestPath)}`;
      const localhostCandidates = isLocalhostApi(API_BASE_URL)
        ? getOrderedLocalhostBases()
        : [API_BASE_URL];
      const initialBaseUrl = preferredLocalBaseUrl && localhostCandidates.includes(preferredLocalBaseUrl)
        ? preferredLocalBaseUrl
        : localhostCandidates[0];

      if ((method === 'GET' || method === 'HEAD') && dedupeWindowMs > 0) {
        const active = inFlightGetRequests.get(dedupeKey);
        if (active && (Date.now() - active.startedAt) <= dedupeWindowMs) {
          const shared = await active.promise;
          return shared.clone();
        }
      }

      try {
        const requestPromise = runWithTimeout(requestPath, initialBaseUrl);

        if ((method === 'GET' || method === 'HEAD') && dedupeGetMs > 0) {
          inFlightGetRequests.set(dedupeKey, { startedAt: Date.now(), promise: requestPromise });
        }

        const response = await requestPromise;

        // If the primary localhost backend responds with an error,
        // try the alternate localhost backend for idempotent reads.
        if (
          !response.ok &&
          allowLocalFallback &&
          canUseAltLocalFallback() &&
          (method === 'GET' || method === 'HEAD')
        ) {
          try {
            const altResponse = await runWithTimeout(
              requestPath,
              ALT_LOCALHOST_API_BASE_URL,
              Math.min(requestTimeoutMs, 8000)
            );
            if (altResponse.ok) {
              return altResponse;
            }
          } catch {
            // Keep original response when alternate localhost is unavailable.
          }
        }

        return response;
      } catch (error) {
        const canRetryTimeout =
          retryOnTimeout &&
          error instanceof DOMException &&
          error.name === 'AbortError' &&
          (method === 'GET' || method === 'HEAD');

        if (canRetryTimeout) {
          // Fast-fail retry: one short second attempt instead of extending waits by 15s.
          try {
            for (const candidateBaseUrl of localhostCandidates) {
              if (candidateBaseUrl === initialBaseUrl) {
                continue;
              }

              try {
                return await runWithTimeout(requestPath, candidateBaseUrl, Math.min(requestTimeoutMs, 8000));
              } catch {
                continue;
              }
            }

            return await runWithTimeout(requestPath, API_BASE_URL, Math.min(requestTimeoutMs, 8000));
          } catch (retryError) {
            if (allowLocalFallback && canUseAltLocalFallback()) {
              return await runWithTimeout(requestPath, ALT_LOCALHOST_API_BASE_URL, Math.min(requestTimeoutMs, 8000));
            }
            throw retryError;
          }
        }

        if (allowLocalFallback && canUseAltLocalFallback()) {
          try {
            return await runWithTimeout(requestPath, ALT_LOCALHOST_API_BASE_URL, Math.min(requestTimeoutMs, 8000));
          } catch {
          }
        }

        if (!(error instanceof TypeError) || !allowLocalFallback || !canUseLocalFallback()) {
          throw error;
        }

        return await runWithTimeout(requestPath, LOCAL_FALLBACK_API_BASE_URL);
      } finally {
        if ((method === 'GET' || method === 'HEAD') && dedupeGetMs > 0) {
          inFlightGetRequests.delete(dedupeKey);
        }
      }
    };

    try {
      let response = await runRequestWithRetry(path);
      if (response.status === 404 && legacyPath) {
        response = await runRequestWithRetry(legacyPath);
      }
      return response;
    } catch (error) {
      throw error;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round((requestTimeoutMs + 3000) / 1000)}s. Backend may be unavailable or overloaded.`);
    }

    if (error instanceof TypeError) {
      throw new Error(`Unable to reach backend at ${API_BASE_URL}. Make sure the backend is running.`);
    }

    throw error;
  }
}

export { API_BASE_URL };