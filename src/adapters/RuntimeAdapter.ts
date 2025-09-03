/**
 * RuntimeAdapter - Wrapper for Chrome runtime API
 * Provides a mockable interface for runtime operations
 */

export interface Message {
  type: string;
  payload?: unknown;
  [key: string]: unknown;
}

export interface MessageSender {
  tab?: {
    id?: number;
    url?: string;
  };
  id?: string;
}

export type MessageHandler = (
  message: Message,
  sender: MessageSender,
  sendResponse: (response: unknown) => void
) => boolean | void;

export interface RuntimeAdapter {
  sendMessage(message: Message): Promise<unknown>;
  onMessage: {
    addListener(handler: MessageHandler): void;
    removeListener(handler: MessageHandler): void;
  };
  onInstalled: {
    addListener(handler: () => void): void;
    removeListener(handler: () => void): void;
  };
  getId(): string;
}

export class ChromeRuntimeAdapter implements RuntimeAdapter {
  async sendMessage(message: Message): Promise<unknown> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          // Popup might not be open, don't reject in this case
          if (chrome.runtime.lastError.message?.includes("Could not establish connection")) {
            resolve(undefined);
          } else {
            reject(new Error(chrome.runtime.lastError.message));
          }
        } else {
          resolve(response);
        }
      });
    });
  }

  onMessage = {
    addListener: (handler: MessageHandler) => {
      chrome.runtime.onMessage.addListener(handler);
    },
    removeListener: (handler: MessageHandler) => {
      chrome.runtime.onMessage.removeListener(handler);
    }
  };

  onInstalled = {
    addListener: (handler: () => void) => {
      chrome.runtime.onInstalled.addListener(handler);
    },
    removeListener: (handler: () => void) => {
      chrome.runtime.onInstalled.removeListener(handler);
    }
  };

  getId(): string {
    return chrome.runtime.id;
  }
}

/**
 * Mock runtime adapter for testing
 */
export class MockRuntimeAdapter implements RuntimeAdapter {
  private messageHandlers: Set<MessageHandler> = new Set();
  private installedHandlers: Set<() => void> = new Set();
  private globalMessageHandler?: (message: Message) => unknown;
  private id = "mock-extension-id";

  async sendMessage(message: Message): Promise<unknown> {
    if (this.globalMessageHandler) {
      return this.globalMessageHandler(message);
    }

    // Simulate message being handled by listeners
    for (const handler of this.messageHandlers) {
      let response: unknown;
      const sendResponse = (resp: unknown) => {
        response = resp;
      };

      const shouldWait = handler(message, { id: this.id }, sendResponse);

      if (shouldWait) {
        // Simulate async response
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (response !== undefined) {
        return response;
      }
    }

    return undefined;
  }

  onMessage = {
    addListener: (handler: MessageHandler) => {
      this.messageHandlers.add(handler);
    },
    removeListener: (handler: MessageHandler) => {
      this.messageHandlers.delete(handler);
    }
  };

  onInstalled = {
    addListener: (handler: () => void) => {
      this.installedHandlers.add(handler);
    },
    removeListener: (handler: () => void) => {
      this.installedHandlers.delete(handler);
    }
  };

  getId(): string {
    return this.id;
  }

  // Test helper methods
  setGlobalMessageHandler(handler: (message: Message) => unknown): void {
    this.globalMessageHandler = handler;
  }

  simulateMessage(message: Message, sender: MessageSender = {}): Promise<unknown[]> {
    const responses: unknown[] = [];

    for (const handler of this.messageHandlers) {
      const sendResponse = (response: unknown) => {
        responses.push(response);
      };

      handler(message, sender, sendResponse);
    }

    return Promise.resolve(responses);
  }

  simulateInstall(): void {
    for (const handler of this.installedHandlers) {
      handler();
    }
  }

  setId(id: string): void {
    this.id = id;
  }

  clearHandlers(): void {
    this.messageHandlers.clear();
    this.installedHandlers.clear();
    this.globalMessageHandler = undefined;
  }
}
