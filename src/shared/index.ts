// Shared exports for WXT-based build

// Constants
export const CONFIG = {
  DEBUG: true,
  API_TIMEOUT: 30000,
  CONTENT_SCRIPT_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  PAGE_LOAD_WAIT: 2000,
  ITEMS_PROCESS_LIMIT: 10
};

export const URLS = {
  WALMART_BASE: "https://www.walmart.com",
  ORDERS_PAGE: "https://www.walmart.com/orders"
};

export const HEADERS = {
  API: {
    "Content-Type": "application/json",
    "X-O-Bu": "WALMART-US",
    "X-O-Mart": "B2C",
    "X-O-Platform": "rweb",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  }
};

export function buildApiHeaders(operationName: string) {
  return { ...HEADERS.API, "X-Apollo-Operation-Name": operationName } as Record<string, string>;
}

export const STORAGE_KEYS = {
  PROCESSED_ORDERS: "processedOrders",
  LAST_SYNC: "lastSync",
  AUTH_STATUS: "authStatus",
  SYNC_STATUS: "syncStatus"
};

export const SYNC_STATUS = {
  IDLE: "idle",
  CHECKING_AUTH: "checking_auth",
  FETCHING_ORDERS: "fetching_orders",
  FETCHING_DETAILS: "fetching_details",
  PROCESSING: "processing",
  COMPLETE: "complete",
  ERROR: "error"
};

export const MESSAGE_TYPES = {
  EXTRACT_ORDER_DATA: "EXTRACT_ORDER_DATA",
  CHECK_PAGE_TYPE: "CHECK_PAGE_TYPE",
  CHECK_AUTH: "CHECK_AUTH",
  SYNC_ORDERS: "SYNC_ORDERS",
  GET_STATUS: "GET_STATUS",
  CLEAR_CACHE: "CLEAR_CACHE",
  SYNC_STATUS_UPDATE: "SYNC_STATUS_UPDATE"
};

// Content constants
export { CONFIG as CONTENT_CONFIG } from "./content-constants";
export { SELECTORS, PATTERNS, FILTER_KEYWORDS } from "./content-constants";

// Utils (local stubs for now; can expand)
export function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await delay(backoffMs * (i + 1));
    }
  }
  throw lastErr;
}
export async function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Timeout")), ms))
  ]);
}
export function safeJsonParse<T = unknown>(s: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// Normalize (simple passthrough; can expand or import real schema later)
// Normalization stubs removed; add real implementations when needed
