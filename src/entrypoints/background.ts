/**
 * Refactored background script - Thin orchestration layer
 * All business logic has been extracted to services
 */

import { STORAGE_KEYS, SYNC_STATUS, MESSAGE_TYPES } from "../shared/index.js";
import {
  AuthService,
  type AuthStatus,
  type FetchResponse,
  type FetchInit
} from "../services/AuthService.js";
import { OrderService, type Order } from "../services/OrderService.js";
import { ChromeStorageAdapter } from "../adapters/StorageAdapter.js";
import { ChromeTabAdapter } from "../adapters/TabAdapter.js";
import { ChromeRuntimeAdapter } from "../adapters/RuntimeAdapter.js";

interface SyncDetails {
  message?: string;
  orderCount?: number;
  extractionMode?: string;
  itemCount?: number;
}

interface ExtractOptions {
  limit?: number;
}

interface ContentScriptResponse {
  success: boolean;
  error?: string;
  data?: {
    orders: Order[];
  };
}

/**
 * Background orchestrator - wires together services and adapters
 */
export class BackgroundOrchestrator {
  private authService: AuthService;
  private orderService: OrderService;
  private storageAdapter: ChromeStorageAdapter;
  private tabAdapter: ChromeTabAdapter;
  private runtimeAdapter: ChromeRuntimeAdapter;

  constructor() {
    // Initialize pure services
    this.authService = new AuthService();
    this.orderService = new OrderService();

    // Initialize browser adapters
    this.storageAdapter = new ChromeStorageAdapter("local");
    this.tabAdapter = new ChromeTabAdapter();
    this.runtimeAdapter = new ChromeRuntimeAdapter();
  }

  /**
   * Initialize the extension
   */
  async initialize(): Promise<void> {
    console.log("Walmart-Monarch Sync Background script initialized", {
      id: this.runtimeAdapter.getId()
    });

    await this.updateSyncStatus(SYNC_STATUS.IDLE);
    this.setupMessageHandlers();
    this.setupInstallHandler();
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.runtimeAdapter.onMessage.addListener((request, _sender, sendResponse) => {
      console.log("Background received message:", request.type);

      switch (request.type) {
        case MESSAGE_TYPES.CHECK_AUTH:
          this.handleCheckAuth().then(sendResponse);
          return true;

        case MESSAGE_TYPES.SYNC_ORDERS:
          this.handleSyncOrders(request.options || {}).then(sendResponse);
          return true;

        case MESSAGE_TYPES.GET_STATUS:
          this.handleGetStatus().then(sendResponse);
          return true;

        case MESSAGE_TYPES.CLEAR_CACHE:
          this.handleClearCache().then(sendResponse);
          return true;

        default:
          console.warn("Unknown message type:", request.type);
          sendResponse({ error: "Unknown message type" });
      }
    });
  }

  /**
   * Setup installation handler
   */
  private setupInstallHandler(): void {
    this.runtimeAdapter.onInstalled.addListener(() => {
      console.log("Walmart-Monarch Sync Extension installed");
      this.updateSyncStatus(SYNC_STATUS.IDLE);
    });
  }

  /**
   * Handle auth check
   */
  private async handleCheckAuth(): Promise<AuthStatus> {
    await this.updateSyncStatus(SYNC_STATUS.CHECKING_AUTH);

    // Use fetch directly - it's available globally in service workers
    // Cast to our FetchResponse type
    const result = await this.authService.checkAuth(
      fetch as (url: string, init?: FetchInit) => Promise<FetchResponse>
    );

    await this.storageAdapter.set({ [STORAGE_KEYS.AUTH_STATUS]: result });

    if (!result.authenticated) {
      await this.updateSyncStatus(SYNC_STATUS.ERROR, { message: result.message });
    } else {
      // Reset to IDLE after successful auth check
      await this.updateSyncStatus(SYNC_STATUS.IDLE);
    }

    return result;
  }

  /**
   * Handle order sync
   */
  private async handleSyncOrders(_options: ExtractOptions): Promise<{
    success: boolean;
    orderCount: number;
    extractionMode: string;
    data?: unknown;
  }> {
    // const { limit = 10 } = options; // Reserved for future use

    console.log("Using content script extraction...");

    await this.updateSyncStatus(SYNC_STATUS.CHECKING_AUTH, {
      message: "Opening Walmart orders page..."
    });

    // Create or focus tab
    const tab = await this.getOrCreateOrdersTab();

    // Wait for page load
    await this.waitForTabReady(tab.id!);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await this.updateSyncStatus(SYNC_STATUS.FETCHING_ORDERS, {
      message: "Extracting order data..."
    });

    // Ensure content script is injected
    await this.injectContentScript(tab.id!);

    // Extract orders
    const orderData = await this.extractOrdersFromTab(tab.id!);

    if (!orderData.success) {
      throw new Error(orderData.error || "Content script extraction failed");
    }

    const orders = orderData.data?.orders || [];
    console.log(`Found ${orders.length} orders from content script`);

    if (orders.length === 0) {
      await this.updateSyncStatus(SYNC_STATUS.COMPLETE, {
        message: "No orders found",
        orderCount: 0
      });
      return { success: true, orderCount: 0, extractionMode: "content" };
    }

    // Process orders using OrderService
    await this.updateSyncStatus(SYNC_STATUS.PROCESSING, {
      message: "Processing order data..."
    });

    const processedData = this.orderService.processOrders(orders);
    const stats = this.orderService.calculateOrderStats(processedData.orders);

    // Update storage
    await this.storageAdapter.set({
      [STORAGE_KEYS.LAST_SYNC]: new Date().toISOString()
    });

    await this.updateSyncStatus(SYNC_STATUS.COMPLETE, {
      message: "Content script sync complete",
      orderCount: stats.totalOrders,
      extractionMode: "content",
      itemCount: stats.totalItems
    });

    return {
      success: true,
      orderCount: stats.totalOrders,
      extractionMode: "content",
      data: processedData
    };
  }

  /**
   * Handle get status
   */
  private async handleGetStatus(): Promise<{
    authStatus: unknown;
    syncStatus: unknown;
    lastSync: unknown;
    processedOrderCount: number;
  }> {
    const result = await this.storageAdapter.get([
      STORAGE_KEYS.AUTH_STATUS,
      STORAGE_KEYS.SYNC_STATUS,
      STORAGE_KEYS.LAST_SYNC,
      STORAGE_KEYS.PROCESSED_ORDERS
    ]);

    const processedOrders = (result[STORAGE_KEYS.PROCESSED_ORDERS] as string[]) || [];

    return {
      authStatus: result[STORAGE_KEYS.AUTH_STATUS],
      syncStatus: result[STORAGE_KEYS.SYNC_STATUS],
      lastSync: result[STORAGE_KEYS.LAST_SYNC],
      processedOrderCount: processedOrders.length
    };
  }

  /**
   * Handle clear cache
   */
  private async handleClearCache(): Promise<{ success: boolean }> {
    await this.storageAdapter.set({ [STORAGE_KEYS.PROCESSED_ORDERS]: [] });
    this.orderService.clearProcessedOrders();
    return { success: true };
  }

  /**
   * Get or create orders tab
   */
  private async getOrCreateOrdersTab(): Promise<{ id?: number }> {
    const existingTabs = await this.tabAdapter.query({
      url: "https://www.walmart.com/orders*"
    });

    if (existingTabs.length > 0) {
      const tab = existingTabs[0];
      await this.tabAdapter.update(tab.id!, { active: false });
      return tab;
    }

    return await this.tabAdapter.create({
      url: "https://www.walmart.com/orders",
      active: false
    });
  }

  /**
   * Wait for tab to be ready
   */
  private async waitForTabReady(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = setInterval(async () => {
        try {
          const tab = await this.tabAdapter.get(tabId);
          if (tab.status === "complete") {
            clearInterval(checkReady);
            resolve();
          }
        } catch {
          // Tab might be loading
        }
      }, 100);
    });
  }

  /**
   * Inject content script
   */
  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await this.tabAdapter.executeScript(tabId, {
        file: "content-scripts/content.js"
      });
    } catch {
      // Might already be injected
    }
  }

  /**
   * Extract orders from tab
   */
  private async extractOrdersFromTab(tabId: number): Promise<ContentScriptResponse> {
    const maxRetries = 20;
    const delayMs = 500;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.tabAdapter.sendMessage<ContentScriptResponse>(tabId, {
          type: "EXTRACT_ORDER_DATA"
        });
        return response;
      } catch {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw new Error(`Content script not ready after ${maxRetries} attempts`);
  }

  /**
   * Update sync status
   */
  private async updateSyncStatus(status: string, details: SyncDetails = {}): Promise<void> {
    await this.storageAdapter.set({
      [STORAGE_KEYS.SYNC_STATUS]: {
        status,
        details,
        timestamp: new Date().toISOString()
      }
    });

    // Notify popup (ignore errors if popup not open)
    this.runtimeAdapter
      .sendMessage({
        type: MESSAGE_TYPES.SYNC_STATUS_UPDATE,
        payload: { status, details }
      })
      .catch(() => {});
  }
}

// Initialize orchestrator when background script loads
export default defineBackground(() => {
  const orchestrator = new BackgroundOrchestrator();
  orchestrator.initialize();
});
