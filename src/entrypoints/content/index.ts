// defineContentScript will be available globally in WXT

// Import constants for content script
import { CONFIG, CONTENT_CONFIG, SELECTORS, PATTERNS, MESSAGE_TYPES } from "../../shared/index.js";
import { WalmartContentExtractor } from "../../shared/walmart-extractor.js";

// Use content-specific config for content script, fallback to shared config
const contentConfig = CONTENT_CONFIG || CONFIG;

// Logger that uses CONFIG.DEBUG from constants
const logger = {
  debug: (...args: any[]) => contentConfig.DEBUG && console.log("[Content]", ...args),
  info: (...args: any[]) => console.log("[Content]", ...args),
  error: (...args: any[]) => console.error("[Content]", ...args),
  warn: (...args: any[]) => console.warn("[Content]", ...args),
  group: (label: string) => contentConfig.DEBUG && console.group(`[Content] ${label}`),
  groupEnd: () => contentConfig.DEBUG && console.groupEnd()
};

export default defineContentScript({
  matches: ["https://www.walmart.com/*"],
  main() {
    // Immediately log that the script is loaded
    logger.debug("Walmart content script loading");
    logger.debug("URL:", window.location.href);
    logger.debug("Page title:", document.title);
    logger.debug("Ready state:", document.readyState);

    // Test that constants are loaded
    logger.debug("CONFIG loaded:", !!CONFIG);
    logger.debug("CONTENT_CONFIG loaded:", !!CONTENT_CONFIG);
    logger.debug("PATTERNS loaded:", !!PATTERNS);
    logger.debug("SELECTORS loaded:", !!SELECTORS);
    logger.debug("PATTERNS.DATE:", PATTERNS.DATE);
    logger.debug("SELECTORS.ITEM_CONTAINERS length:", SELECTORS.ITEM_CONTAINERS?.length);

    // Message handler for communication with background script
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      logger.debug("Content script received message:", request.type);

      if (request.type === MESSAGE_TYPES.EXTRACT_ORDER_DATA) {
        try {
          logger.debug("Starting order extraction...");
          const extractor = new WalmartContentExtractor(logger);
          const data = extractor.extractOrderData();
          logger.debug("Extraction complete. Data:", data);

          if (!data) {
            logger.warn("No data extracted");
            sendResponse({ success: false, error: "No data found", data: null });
          } else {
            sendResponse({ success: true, data });
          }
        } catch (error: any) {
          logger.error("Extraction error:", error);
          sendResponse({ success: false, error: error.message, data: null });
        }
        return true;
      }

      if (request.type === MESSAGE_TYPES.CHECK_PAGE_TYPE) {
        const pageType = window.location.pathname.startsWith("/orders/")
          ? "order_detail"
          : window.location.pathname === "/orders"
            ? "order_list"
            : "other";
        sendResponse({ pageType, url: window.location.href });
        return true;
      }
    });

    // Log available global objects
    logger.debug(
      "Window.__WML_REDUX_INITIAL_STATE__ exists:",
      !!(window as any).__WML_REDUX_INITIAL_STATE__
    );
    logger.debug("Window.__NEXT_DATA__ exists:", !!(window as any).__NEXT_DATA__);

    // If Redux state exists, log its top-level keys
    if ((window as any).__WML_REDUX_INITIAL_STATE__) {
      logger.debug(
        "Redux state top-level keys:",
        Object.keys((window as any).__WML_REDUX_INITIAL_STATE__)
      );
    }

    // If Next.js data exists, log its structure
    if ((window as any).__NEXT_DATA__) {
      logger.debug("Next.js data keys:", Object.keys((window as any).__NEXT_DATA__));
      if ((window as any).__NEXT_DATA__.props) {
        logger.debug("Next.js props keys:", Object.keys((window as any).__NEXT_DATA__.props));
      }
    }

    logger.info("Walmart content script loaded successfully with ES modules");
  }
});
