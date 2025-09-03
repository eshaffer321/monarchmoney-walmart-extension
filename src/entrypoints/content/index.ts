/**
 * Refactored content script - Thin orchestration layer
 * Uses refactored WalmartContentExtractor with DataParser service
 */

// defineContentScript will be available globally in WXT
import { CONFIG, CONTENT_CONFIG, MESSAGE_TYPES } from "../../shared/index.js";
import { WalmartContentExtractor } from "../../shared/walmart-extractor.js";

// Type definitions for message handling
interface ContentMessage {
  type: string;
  [key: string]: unknown;
}

interface MessageSender {
  tab?: chrome.tabs.Tab;
  id?: string;
}

// Extend Window interface for Walmart-specific global properties
declare global {
  interface Window {
    __WML_REDUX_INITIAL_STATE__?: Record<string, unknown>;
    __NEXT_DATA__?: {
      props?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }
}

// Use content-specific config or fallback to shared config
const contentConfig = CONTENT_CONFIG || CONFIG;

// Logger configuration
const logger = {
  debug: (...args: unknown[]) => contentConfig.DEBUG && console.log("[Content]", ...args),
  info: (...args: unknown[]) => console.log("[Content]", ...args),
  error: (...args: unknown[]) => console.error("[Content]", ...args),
  warn: (...args: unknown[]) => console.warn("[Content]", ...args),
  group: (label: string) => contentConfig.DEBUG && console.group(`[Content] ${label}`),
  groupEnd: () => contentConfig.DEBUG && console.groupEnd()
};

export default defineContentScript({
  matches: ["https://www.walmart.com/*"],
  main() {
    // Use console.log directly to ensure we see the logs
    console.log("[Content] Walmart content script initialized");
    console.log("[Content] URL:", window.location.href);
    console.log("[Content] Page title:", document.title);

    // Create extractor instance
    const extractor = new WalmartContentExtractor(logger);

    // Setup message handler
    browser.runtime.onMessage.addListener(
      (
        request: ContentMessage,
        _sender: MessageSender,
        sendResponse: (response?: unknown) => void
      ) => {
        logger.debug("Content script received message:", request.type);

        switch (request.type) {
          case MESSAGE_TYPES.EXTRACT_ORDER_DATA:
            handleExtractOrderData(extractor, sendResponse);
            return true;

          case MESSAGE_TYPES.CHECK_PAGE_TYPE:
            handleCheckPageType(sendResponse);
            return true;

          default:
            logger.warn("Unknown message type:", request.type);
            sendResponse({ error: "Unknown message type" });
        }
      }
    );

    console.log("[Content] Walmart content script ready and listening for messages");
  }
});

/**
 * Handle order data extraction
 */
function handleExtractOrderData(
  extractor: WalmartContentExtractor,
  sendResponse: (response: unknown) => void
): void {
  try {
    console.log("[Content] handleExtractOrderData called");
    const data = extractor.extractOrderData();
    console.log("[Content] Extraction result:", data);

    if (!data) {
      console.warn("[Content] No data extracted");
      sendResponse({
        success: false,
        error: "No data found",
        data: null
      });
    } else {
      console.log("[Content] Extraction complete. Orders found:", data.orders?.length || 0);
      sendResponse({
        success: true,
        data
      });
    }
  } catch (error) {
    logger.error("Extraction error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({
      success: false,
      error: errorMessage,
      data: null
    });
  }
}

/**
 * Handle page type check
 */
function handleCheckPageType(sendResponse: (response: unknown) => void): void {
  const pageType = getPageType();
  sendResponse({
    pageType,
    url: window.location.href
  });
}

/**
 * Determine the current page type
 */
function getPageType(): string {
  if (window.location.pathname.startsWith("/orders/")) {
    return "order_detail";
  } else if (window.location.pathname === "/orders") {
    return "order_list";
  } else {
    return "other";
  }
}
