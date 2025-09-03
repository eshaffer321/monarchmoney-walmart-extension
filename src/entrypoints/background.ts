// defineBackground will be available globally in WXT

// Import shared constants and utilities
import { STORAGE_KEYS, SYNC_STATUS, MESSAGE_TYPES } from "../shared/index.js";

// Cache management
async function getProcessedOrders(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROCESSED_ORDERS);
  return result[STORAGE_KEYS.PROCESSED_ORDERS] || [];
}

async function addProcessedOrders(orderNumbers: string[]): Promise<void> {
  const existing = await getProcessedOrders();
  const updated = [...new Set([...existing, ...orderNumbers])];
  await chrome.storage.local.set({ [STORAGE_KEYS.PROCESSED_ORDERS]: updated });
}

async function clearProcessedOrders(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROCESSED_ORDERS]: [] });
}

// Check Walmart authentication by fetching orders page
async function checkAuth(): Promise<any> {
  await updateSyncStatus(SYNC_STATUS.CHECKING_AUTH);

  try {
    const response = await fetch("https://www.walmart.com/orders", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    });

    let result: any = { authenticated: false, message: `HTTP ${response.status}` };
    if (response.status === 200) {
      const text = await response.text();
      if (text.includes("Sign in to your account") || text.includes("sign-in")) {
        result = { authenticated: false, message: "Not logged in to Walmart" };
      } else {
        result = { authenticated: true, message: "Authenticated" };
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATUS]: result });
    if (!result.authenticated) {
      await updateSyncStatus(SYNC_STATUS.ERROR, { message: result.message });
    }
    return result;
  } catch (error: any) {
    const result = { authenticated: false, message: error.message };
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATUS]: result });
    await updateSyncStatus(SYNC_STATUS.ERROR, { message: result.message });
    return result;
  }
}

async function sendTabMessageWithRetry<T = any>(
  tabId: number,
  message: any,
  retries = 10,
  delayMs = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message as any);
      return response as T;
    } catch (error: any) {
      lastError = error;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    `Content script not ready after ${retries} attempts: ${lastError?.message || lastError}`
  );
}

// Update sync status
async function updateSyncStatus(status: string, details: any = {}): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SYNC_STATUS]: {
      status,
      details,
      timestamp: new Date().toISOString()
    }
  });

  // Notify popup of status change
  chrome.runtime
    .sendMessage({
      type: MESSAGE_TYPES.SYNC_STATUS_UPDATE,
      payload: { status, details }
    })
    .catch(() => {
      // Popup might not be open, ignore error
    });
}

// Simplified content script extraction using modern approach
async function extractWithContentScript(options: any = {}): Promise<any> {
  const { limit = 10 } = options;

  console.log("Using content script extraction...");

  await updateSyncStatus(SYNC_STATUS.CHECKING_AUTH, {
    message: "Opening Walmart orders page..."
  });

  // Create or focus a tab with Walmart orders
  let tab: chrome.tabs.Tab;
  const existingTabs = await chrome.tabs.query({ url: "https://www.walmart.com/orders*" });

  if (existingTabs.length > 0) {
    tab = existingTabs[0];
    await chrome.tabs.update(tab.id!, { active: false }); // Keep in background
  } else {
    tab = await chrome.tabs.create({
      url: "https://www.walmart.com/orders",
      active: false // Don't interrupt user
    });
  }

  // Wait for page to load completely
  await new Promise<void>((resolve) => {
    const checkReady = setInterval(() => {
      chrome.tabs.get(tab.id!, (tab) => {
        if (tab.status === "complete") {
          clearInterval(checkReady);
          resolve();
        }
      });
    }, 100);
  });

  // Additional wait for dynamic content and content script injection
  await new Promise((resolve) => setTimeout(resolve, 3000));

  await updateSyncStatus(SYNC_STATUS.FETCHING_ORDERS, {
    message: "Extracting order data..."
  });

  // Ensure content script is injected (defensive injection)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      files: ["content-scripts/content.js"]
    });
  } catch (_) {
    // Ignore if already injected
  }

  // Get order list from the page using content script message
  let orderListResponse: any;
  try {
    orderListResponse = await sendTabMessageWithRetry(
      tab.id!,
      { type: "EXTRACT_ORDER_DATA" },
      20,
      500
    );
    console.log("Order list response:", orderListResponse);
  } catch (error) {
    console.error("Failed to communicate with content script:", error);
    throw new Error(`Content script communication failed: ${(error as Error).message}`);
  }

  if (!orderListResponse?.success) {
    console.error("Content script extraction failed:", orderListResponse?.error);
    throw new Error(orderListResponse?.error || "Content script extraction failed");
  }

  const orders = orderListResponse.data?.orders || [];
  console.log(`Found ${orders.length} orders from content script`);

  if (orders.length === 0) {
    console.log("No orders found on page. This might be a login page or empty order history.");
    await updateSyncStatus(SYNC_STATUS.COMPLETE, {
      message: "No orders found",
      orderCount: 0
    });
    return { success: true, orderCount: 0, extractionMode: "content" };
  }

  // Format data for backend
  await updateSyncStatus(SYNC_STATUS.PROCESSING, {
    message: "Processing order data..."
  });

  const formattedData = {
    orders: orders.map((order: any) => ({
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      orderTotal: order.orderTotal || 0,
      tax: order.tax || 0,
      deliveryCharges: order.deliveryCharges || 0,
      tip: order.tip || 0,
      items: (order.items || []).map((item: any) => ({
        name: item.name,
        price: item.price || 0,
        quantity: item.quantity || 1,
        productUrl: item.productUrl || ""
      }))
    }))
  };

  // Log the data
  console.log("Content script extraction complete:", formattedData);

  // Update last sync time
  await chrome.storage.local.set({
    [STORAGE_KEYS.LAST_SYNC]: new Date().toISOString()
  });

  // Update status to complete
  await updateSyncStatus(SYNC_STATUS.COMPLETE, {
    message: "Content script sync complete",
    orderCount: orders.length,
    extractionMode: "content",
    itemCount: orders.reduce(
      (sum: number, order: any) => sum + (order.items ? order.items.length : 0),
      0
    )
  });

  return {
    success: true,
    orderCount: orders.length,
    extractionMode: "content",
    data: formattedData
  };
}

export default defineBackground(() => {
  console.log("Walmart-Monarch Sync Background script initialized", {
    id: browser.runtime.id
  });

  // Initialize extension
  updateSyncStatus(SYNC_STATUS.IDLE);

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background received message:", request.type);

    switch (request.type) {
      case MESSAGE_TYPES.CHECK_AUTH:
        checkAuth().then(sendResponse);
        return true; // Will respond asynchronously

      case MESSAGE_TYPES.SYNC_ORDERS:
        extractWithContentScript(request.options || {}).then(sendResponse);
        return true; // Will respond asynchronously

      case MESSAGE_TYPES.GET_STATUS:
        chrome.storage.local
          .get([
            STORAGE_KEYS.AUTH_STATUS,
            STORAGE_KEYS.SYNC_STATUS,
            STORAGE_KEYS.LAST_SYNC,
            STORAGE_KEYS.PROCESSED_ORDERS
          ])
          .then((result) => {
            sendResponse({
              authStatus: result[STORAGE_KEYS.AUTH_STATUS],
              syncStatus: result[STORAGE_KEYS.SYNC_STATUS],
              lastSync: result[STORAGE_KEYS.LAST_SYNC],
              processedOrderCount: (result[STORAGE_KEYS.PROCESSED_ORDERS] || []).length
            });
          });
        return true; // Will respond asynchronously

      case MESSAGE_TYPES.CLEAR_CACHE:
        clearProcessedOrders().then(() => {
          sendResponse({ success: true });
        });
        return true; // Will respond asynchronously

      default:
        console.warn("Unknown message type:", request.type);
        sendResponse({ error: "Unknown message type" });
    }
  });

  // Installation handler
  chrome.runtime.onInstalled.addListener(() => {
    console.log("Walmart-Monarch Sync Extension installed");
    updateSyncStatus(SYNC_STATUS.IDLE);
  });
});
