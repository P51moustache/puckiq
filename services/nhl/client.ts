/**
 * One fetch path for every public NHL endpoint the app reads.
 *
 * - Memory cache with a per-call TTL, optional write-through to AsyncStorage.
 * - Identical in-flight requests share one network call (tabs mount together).
 * - Timeout + one retry on network / 5xx.
 * - If the network fails and we have any cached copy, serve it (stale beats blank).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DISK_PREFIX = 'nhlcache:';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_DISK_BYTES = 400_000;
const DISK_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

interface CacheEntry {
  data: unknown;
  fetchedAt: number;
}

export interface FetchJsonOptions {
  /** How long a cached copy counts as fresh. */
  ttlMs: number;
  /** Also keep the response in AsyncStorage so a cold start is instant. */
  persist?: boolean;
  /** Skip fresh cache (pull-to-refresh). Stale copies are still a fallback on failure. */
  force?: boolean;
  timeoutMs?: number;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Be polite to the NHL: a few requests per host at a time (the stats API rate-limits bursts). */
const MAX_CONCURRENT_PER_HOST = 4;
/** api.nhle.com/stats is the host that 429s under bursts; keep it to two at a time. */
const HOST_CONCURRENCY: Record<string, number> = { 'api.nhle.com': 2 };
const RATE_LIMIT_BACKOFF_MS = [2_000, 6_000];
const active = new Map<string, number>();
const waiting = new Map<string, Array<() => void>>();

function hostOf(url: string): string {
  const match = /^https?:\/\/([^/]+)/i.exec(url);
  return match ? match[1] : url;
}

async function acquire(host: string): Promise<void> {
  if ((active.get(host) ?? 0) < (HOST_CONCURRENCY[host] ?? MAX_CONCURRENT_PER_HOST)) {
    active.set(host, (active.get(host) ?? 0) + 1);
    return;
  }
  await new Promise<void>((resolve) => {
    const queue = waiting.get(host) ?? [];
    queue.push(resolve);
    waiting.set(host, queue);
  });
}

function release(host: string): void {
  const next = waiting.get(host)?.shift();
  if (next) {
    next(); // hand the slot straight to the next request
    return;
  }
  active.set(host, Math.max(0, (active.get(host) ?? 1) - 1));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class NhlFetchError extends Error {
  constructor(public readonly url: string, public readonly status: number | null, message: string) {
    super(message);
    this.name = 'NhlFetchError';
  }
}

function isFresh(entry: CacheEntry | undefined, ttlMs: number, now: number): entry is CacheEntry {
  return !!entry && now - entry.fetchedAt < ttlMs;
}

async function readDisk(url: string): Promise<CacheEntry | undefined> {
  try {
    const raw = await AsyncStorage.getItem(DISK_PREFIX + url);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (typeof parsed?.fetchedAt !== 'number') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

async function writeDisk(url: string, entry: CacheEntry): Promise<void> {
  try {
    const raw = JSON.stringify(entry);
    if (raw.length > MAX_DISK_BYTES) return;
    await AsyncStorage.setItem(DISK_PREFIX + url, raw);
  } catch {
    // Disk cache is an optimization only.
  }
}

async function fetchOnce(url: string, timeoutMs: number): Promise<unknown> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!res.ok) {
      throw new NhlFetchError(url, res.status, `NHL request failed (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    if (error instanceof NhlFetchError) throw error;
    throw new NhlFetchError(url, null, error instanceof Error ? error.message : 'Network error');
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithRetry(url: string, timeoutMs: number): Promise<unknown> {
  const host = hostOf(url);
  await acquire(host);
  try {
    let rateLimitRetries = 0;
    let serverRetried = false;
    for (;;) {
      try {
        return await fetchOnce(url, timeoutMs);
      } catch (error) {
        if (!(error instanceof NhlFetchError)) throw error;
        if (error.status === 429 && rateLimitRetries < RATE_LIMIT_BACKOFF_MS.length) {
          await sleep(RATE_LIMIT_BACKOFF_MS[rateLimitRetries]);
          rateLimitRetries += 1;
          continue;
        }
        if ((error.status === null || error.status >= 500) && !serverRetried) {
          serverRetried = true;
          continue;
        }
        throw error;
      }
    }
  } finally {
    release(host);
  }
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const now = Date.now();
  const cached = memory.get(url);
  if (!options.force && isFresh(cached, options.ttlMs, now)) {
    return cached.data as T;
  }

  let diskCopy: CacheEntry | undefined;
  if (options.persist && !cached) {
    diskCopy = await readDisk(url);
    if (diskCopy) memory.set(url, diskCopy);
    if (!options.force && isFresh(diskCopy, options.ttlMs, Date.now())) {
      return diskCopy.data as T;
    }
  }

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    try {
      const data = await fetchWithRetry(url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const entry = { data, fetchedAt: Date.now() };
      memory.set(url, entry);
      if (options.persist) void writeDisk(url, entry);
      return data;
    } catch (error) {
      const fallback = memory.get(url) ?? diskCopy;
      if (fallback) return fallback.data;
      throw error;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, request);
  return request as Promise<T>;
}

/** Build a query string; values are URI-encoded. */
export function withQuery(base: string, params: Record<string, string | number | boolean>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${base}?${query}` : base;
}

export function clearNhlMemoryCache(): void {
  memory.clear();
  inflight.clear();
  active.clear();
  waiting.clear();
}

/** Drop disk entries older than a few days so AsyncStorage does not grow all season. */
export async function pruneNhlDiskCache(now: number = Date.now()): Promise<number> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(DISK_PREFIX));
    if (keys.length === 0) return 0;
    const rows = await AsyncStorage.multiGet(keys);
    const stale = rows
      .filter(([, raw]) => {
        if (!raw) return true;
        try {
          const parsed = JSON.parse(raw) as CacheEntry;
          return typeof parsed.fetchedAt !== 'number' || now - parsed.fetchedAt > DISK_MAX_AGE_MS;
        } catch {
          return true;
        }
      })
      .map(([key]) => key);
    if (stale.length > 0) await AsyncStorage.multiRemove(stale);
    return stale.length;
  } catch {
    return 0;
  }
}
