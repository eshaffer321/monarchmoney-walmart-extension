/**
 * TabAdapter - Wrapper for Chrome tabs API
 * Provides a mockable interface for tab operations
 */

export interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
}

export interface TabAdapter {
  create(properties: chrome.tabs.CreateProperties): Promise<Tab>;
  update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<Tab>;
  query(queryInfo: chrome.tabs.QueryInfo): Promise<Tab[]>;
  get(tabId: number): Promise<Tab>;
  sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
  executeScript(tabId: number, details: { file?: string; code?: string }): Promise<unknown[]>;
  remove(tabId: number): Promise<void>;
}

export class ChromeTabAdapter implements TabAdapter {
  async create(properties: chrome.tabs.CreateProperties): Promise<Tab> {
    return new Promise((resolve, reject) => {
      chrome.tabs.create(properties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(this.convertTab(tab));
        }
      });
    });
  }

  async update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<Tab> {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, updateProperties, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (tab) {
          resolve(this.convertTab(tab));
        } else {
          reject(new Error("Tab update failed"));
        }
      });
    });
  }

  async query(queryInfo: chrome.tabs.QueryInfo): Promise<Tab[]> {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tabs.map((tab) => this.convertTab(tab)));
        }
      });
    });
  }

  async get(tabId: number): Promise<Tab> {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(this.convertTab(tab));
        }
      });
    });
  }

  async sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response as T);
        }
      });
    });
  }

  async executeScript(
    tabId: number,
    details: { file?: string; code?: string }
  ): Promise<unknown[]> {
    if (chrome.scripting) {
      // Manifest V3
      return new Promise((resolve, reject) => {
        if (details.file) {
          // File injection
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: [details.file]
            },
            (results) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(results?.map((r) => r.result) || []);
              }
            }
          );
        } else if (details.code) {
          // Function injection
          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: () => {
                // Execute the code in the content script context
                return eval(details.code || "");
              },
              args: []
            },
            (results) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(results?.map((r) => r.result) || []);
              }
            }
          );
        } else {
          resolve([]);
        }
      });
    } else {
      // Manifest V2 fallback
      return new Promise((resolve, reject) => {
        chrome.tabs.executeScript(tabId, details, (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(results || []);
          }
        });
      });
    }
  }

  async remove(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  private convertTab(chromeTab: chrome.tabs.Tab): Tab {
    return {
      id: chromeTab.id,
      url: chromeTab.url,
      title: chromeTab.title,
      active: chromeTab.active,
      status: chromeTab.status
    };
  }
}

/**
 * Mock tab adapter for testing
 */
export class MockTabAdapter implements TabAdapter {
  private tabs: Map<number, Tab> = new Map();
  private messageHandlers: Map<number, (message: unknown) => unknown> = new Map();
  private nextId = 1;

  async create(properties: chrome.tabs.CreateProperties): Promise<Tab> {
    const tab: Tab = {
      id: this.nextId++,
      url: properties.url,
      active: properties.active ?? false,
      status: "complete"
    };
    this.tabs.set(tab.id!, tab);
    return tab;
  }

  async update(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<Tab> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    if (updateProperties.url !== undefined) tab.url = updateProperties.url;
    if (updateProperties.active !== undefined) tab.active = updateProperties.active;

    return tab;
  }

  async query(queryInfo: chrome.tabs.QueryInfo): Promise<Tab[]> {
    const tabs = Array.from(this.tabs.values());

    return tabs.filter((tab) => {
      const urlPattern = typeof queryInfo.url === "string" ? queryInfo.url : queryInfo.url?.[0];
      if (urlPattern && !tab.url?.includes(urlPattern)) return false;
      if (queryInfo.active !== undefined && tab.active !== queryInfo.active) return false;
      return true;
    });
  }

  async get(tabId: number): Promise<Tab> {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }
    return tab;
  }

  async sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T> {
    const handler = this.messageHandlers.get(tabId);
    if (handler) {
      return handler(message) as T;
    }
    throw new Error(`No message handler for tab ${tabId}`);
  }

  async executeScript(
    _tabId: number,
    _details: { file?: string; code?: string }
  ): Promise<unknown[]> {
    // Mock implementation - return empty array
    return [];
  }

  async remove(tabId: number): Promise<void> {
    this.tabs.delete(tabId);
    this.messageHandlers.delete(tabId);
  }

  // Test helper methods
  setMessageHandler(tabId: number, handler: (message: unknown) => unknown): void {
    this.messageHandlers.set(tabId, handler);
  }

  getAllTabs(): Tab[] {
    return Array.from(this.tabs.values());
  }
}
