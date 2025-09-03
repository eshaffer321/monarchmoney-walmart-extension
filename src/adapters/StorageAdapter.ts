/**
 * StorageAdapter - Wrapper for Chrome storage API
 * Provides a mockable interface for storage operations
 */

export interface StorageAdapter {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  private storage: chrome.storage.StorageArea;

  constructor(area: "local" | "sync" = "local") {
    this.storage = chrome.storage[area];
  }

  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this.storage.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
  }

  async set(items: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async remove(keys: string | string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * In-memory storage adapter for testing
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private store: Map<string, unknown>;

  constructor(initialData?: Record<string, unknown>) {
    this.store = new Map(Object.entries(initialData || {}));
  }

  async get(keys: string | string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];

    for (const key of keyArray) {
      if (this.store.has(key)) {
        result[key] = this.store.get(key);
      }
    }

    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.store.set(key, value);
    }
  }

  async remove(keys: string | string[]): Promise<void> {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    for (const key of keyArray) {
      this.store.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  // Helper method for tests
  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.store.entries());
  }
}
