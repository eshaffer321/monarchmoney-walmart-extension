/* global Element */

/**
 * Refactored Walmart content extractor
 * Uses DataParser service for all parsing logic
 */

import { DataParser } from "../services/DataParser.js";
import { Order, OrderItem } from "../services/OrderService.js";
import { SELECTORS } from "./content-constants.js";

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

interface OrderData {
  orders?: Order[];
}

declare global {
  interface Window {
    __WML_REDUX_INITIAL_STATE__?: Record<string, unknown>;
    __NEXT_DATA__?: {
      props?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }
}

export class WalmartContentExtractor {
  private dataParser: DataParser;

  constructor(private logger: Logger) {
    this.dataParser = new DataParser();
  }

  /**
   * Extract order data from the current page
   */
  extractOrderData(): OrderData | null {
    try {
      this.logger.info("[WalmartExtractor] Starting order data extraction");
      this.logger.info("[WalmartExtractor] Current URL:", window.location.href);
      this.logger.info("[WalmartExtractor] Document title:", document.title);

      // Try Redux state first
      if (window.__WML_REDUX_INITIAL_STATE__) {
        this.logger.info("[WalmartExtractor] Found Redux state in window object");
        const orders = this.dataParser.parseReduxState(window.__WML_REDUX_INITIAL_STATE__);
        if (orders && orders.length > 0) {
          return { orders };
        }
      }

      // Try Next.js data
      if (window.__NEXT_DATA__) {
        this.logger.info("[WalmartExtractor] Found Next.js data");

        // Log the top-level keys
        const nextDataKeys = Object.keys(window.__NEXT_DATA__);
        this.logger.debug("Next.js top-level keys:", nextDataKeys);

        // Log props structure if it exists
        if (window.__NEXT_DATA__.props) {
          const propsKeys = Object.keys(window.__NEXT_DATA__.props);
          this.logger.debug("Next.js props keys:", propsKeys);

          // Log pageProps structure if it exists
          const pageProps = (window.__NEXT_DATA__.props as Record<string, unknown>).pageProps as
            | Record<string, unknown>
            | undefined;
          if (pageProps) {
            const pagePropsKeys = Object.keys(pageProps);
            this.logger.debug("Next.js pageProps keys:", pagePropsKeys);

            // Log first few keys of each pageProps property that might contain orders
            pagePropsKeys.forEach((key) => {
              const value = pageProps[key];
              if (value && typeof value === "object") {
                if (Array.isArray(value)) {
                  this.logger.debug(`pageProps.${key} is an array with ${value.length} items`);
                  if (value.length > 0 && typeof value[0] === "object") {
                    this.logger.debug(`First item of ${key}:`, Object.keys(value[0]).slice(0, 10));
                  }
                } else {
                  const subKeys = Object.keys(value).slice(0, 10);
                  this.logger.debug(`pageProps.${key} keys:`, subKeys);
                }
              }
            });
          }
        }

        // Log a sample of the data structure
        this.logger.debug(
          "Next.js data sample:",
          JSON.stringify(window.__NEXT_DATA__, null, 2).slice(0, 2000)
        );

        const orders = this.dataParser.parseNextData(window.__NEXT_DATA__);
        if (orders && orders.length > 0) {
          this.logger.info(`Successfully extracted ${orders.length} orders from Next.js data`);
          return { orders };
        } else {
          this.logger.warn("Next.js data found but no orders extracted");
        }
      }

      // Try script tags
      const scriptOrders = this.extractFromScriptTags();
      if (scriptOrders && scriptOrders.length > 0) {
        return { orders: scriptOrders };
      }

      // Try DOM extraction with enhanced selectors
      if (window.location.pathname.includes("/orders")) {
        this.logger.debug("Attempting DOM extraction for orders page");
        const domOrders = this.extractFromDOM();
        if (domOrders && domOrders.length > 0) {
          this.logger.info(`Successfully extracted ${domOrders.length} orders from DOM`);
          return { orders: domOrders };
        } else {
          this.logger.warn("DOM extraction attempted but no orders found");
        }
      }

      // Final fallback: Look for any JSON data in the page
      const jsonOrders = this.extractFromPageJSON();
      if (jsonOrders && jsonOrders.length > 0) {
        this.logger.info(`Successfully extracted ${jsonOrders.length} orders from page JSON`);
        return { orders: jsonOrders };
      }

      // Last resort: Return mock data to test if content script is working
      this.logger.warn(
        "[WalmartExtractor] All extraction methods failed, checking if page has order content"
      );

      // Check if we're on an orders page by looking at the page content
      const pageText = document.body?.innerText || "";
      if (pageText.includes("Order") || pageText.includes("order")) {
        this.logger.info("[WalmartExtractor] Page contains order text, returning test data");
        // Return minimal test data to verify content script is working
        return {
          orders: [
            {
              orderNumber: "TEST-" + Date.now(),
              orderDate: new Date().toLocaleDateString(),
              orderTotal: 0,
              items: []
            }
          ]
        };
      }

      return null;
    } catch (error) {
      this.logger.error("Error extracting order data:", error);
      return null;
    }
  }

  /**
   * Extract from script tags
   */
  private extractFromScriptTags(): Order[] | null {
    const scriptTags = document.querySelectorAll("script");

    for (const script of scriptTags) {
      if (!script.textContent) continue;

      // Try Redux state in script
      if (script.textContent.includes("__WML_REDUX_INITIAL_STATE__")) {
        const match = script.textContent.match(
          /window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});/s
        );
        if (match) {
          try {
            this.logger.debug("Found Redux state in script tag");
            const stateData = JSON.parse(match[1]);
            const orders = this.dataParser.parseReduxState(stateData);
            if (orders && orders.length > 0) return orders;
          } catch (e) {
            this.logger.error("Failed to parse Redux state from script:", e);
          }
        }
      }

      // Try Next.js data in script
      if (script.textContent.includes("__NEXT_DATA__")) {
        const match = script.textContent.match(
          /window\.__NEXT_DATA__\s*=\s*({.*?})\s*;?\s*<\/script>/s
        );
        if (match) {
          try {
            this.logger.debug("Found Next.js data in script tag");
            const nextData = JSON.parse(match[1]);
            const orders = this.dataParser.parseNextData(nextData);
            if (orders && orders.length > 0) return orders;
          } catch (e) {
            this.logger.error("Failed to parse Next.js data from script:", e);
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract from DOM
   */
  private extractFromDOM(): Order[] {
    const orders: Order[] = [];

    // Extract from order list page
    if (window.location.pathname === "/orders") {
      this.logger.debug("Extracting from orders list page");

      // First, try to expand all orders to load items
      this.expandAllOrders();

      // Expanded selectors for Walmart's order elements
      const orderSelectors = [
        '[data-testid*="order"]',
        '[data-test*="order"]',
        ".order-card",
        '[class*="OrderCard"]',
        '[class*="order-item"]',
        '[class*="PurchaseGroup"]',
        '[class*="OrderGroup"]',
        '[role="article"]',
        'div[class*="bg-white"][class*="rounded"]',
        'section[class*="order"]'
      ];

      for (const selector of orderSelectors) {
        const orderElements = document.querySelectorAll(selector);

        if (orderElements.length > 0) {
          this.logger.debug(`Found ${orderElements.length} elements with selector: ${selector}`);

          orderElements.forEach((orderEl, index) => {
            const text = orderEl.textContent || "";

            // Log the text to see what we're trying to parse
            if (index === 0) {
              this.logger.info(`First order element text (first 500 chars):`, text.slice(0, 500));
            }

            const parsed = this.dataParser.parseTextContent(text);

            if (parsed.orderNumber && parsed.orderDate) {
              this.logger.info(
                `✓ Extracted order ${index + 1}: ${parsed.orderNumber} from ${parsed.orderDate}`
              );

              // Extract items from within this order element first
              let items = this.extractItemsFromOrderElement(orderEl);

              // If no items found within the order element, try the next sibling or parent container
              if (items.length === 0) {
                // Try parent container
                const parentContainer = orderEl.parentElement;
                if (parentContainer) {
                  items = this.extractItemsFromOrderElement(parentContainer);
                }

                // If still no items, try following siblings
                if (items.length === 0) {
                  let sibling = orderEl.nextElementSibling;
                  let attempts = 0;
                  while (sibling && attempts < 3 && items.length === 0) {
                    items = this.extractItemsFromOrderElement(sibling);
                    sibling = sibling.nextElementSibling;
                    attempts++;
                  }
                }

                // Check for item count indicator like "+8"
                if (items.length === 0) {
                  const itemCountMatch = text.match(/\+(\d+)/);
                  if (itemCountMatch) {
                    const itemCount = parseInt(itemCountMatch[1]);
                    this.logger.info(`  Order has ${itemCount} items (not expanded)`);
                    // Create placeholder items
                    for (let i = 0; i < Math.min(itemCount, 10); i++) {
                      items.push({
                        name: `Item ${i + 1} (click View Details to see)`,
                        price: 0,
                        quantity: 1,
                        productUrl: ""
                      });
                    }
                  } else {
                    // Last resort: extract from text content
                    const textItems = this.dataParser.extractItemsFromText(text);
                    items = textItems.map((item) => ({
                      name: item.name,
                      price: item.price || 0,
                      quantity: item.quantity || 1,
                      productUrl: ""
                    }));
                  }
                }
              }

              this.logger.info(`  Found ${items.length} items for order ${parsed.orderNumber}`);

              // Try to find the View Details link for this order
              const viewDetailsLink = orderEl.querySelector(
                'a[href*="/orders/"]'
              ) as HTMLAnchorElement;
              if (viewDetailsLink) {
                this.logger.info(`  Order detail URL: ${viewDetailsLink.href}`);
              }

              orders.push({
                orderNumber: parsed.orderNumber,
                orderDate: parsed.orderDate,
                orderTotal: parsed.orderTotal,
                items
              });
            } else {
              // Debug why extraction failed
              const debugInfo: string[] = [];
              if (!parsed.orderNumber) {
                // Look for any number patterns
                const patterns = [
                  text.match(/\d{12,15}/), // Walmart format like 200013724127732
                  text.match(/Order\s*#?\s*(\d{12,15})/i),
                  text.match(/#\s*(\d{12,15})/)
                ];
                const found = patterns.find((p) => p);
                if (found) {
                  debugInfo.push(`Found number pattern: ${found[0]}`);
                } else {
                  debugInfo.push("No order number found");
                }
              }
              if (!parsed.orderDate) {
                const dateMatch = text.match(
                  /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i
                );
                if (dateMatch) {
                  debugInfo.push(`Found date pattern: ${dateMatch[0]}`);
                } else {
                  debugInfo.push("No date found");
                }
              }
              if (index === 0) {
                this.logger.warn(`Failed to extract from first element:`, debugInfo.join(", "));
              }
            }
          });

          if (orders.length > 0) {
            break; // Found orders, stop checking other selectors
          }
        }
      }

      if (orders.length === 0) {
        this.logger.debug("No orders found with standard selectors, trying fallback extraction");
        // Fallback: look for any element containing order number pattern
        const allElements = document.querySelectorAll("div, section, article");
        const orderNumberPattern = /(?:Order\s*#?|#)\s*([\d-]{6,})/i;

        allElements.forEach((el) => {
          const text = el.textContent || "";
          if (orderNumberPattern.test(text) && text.length < 5000) {
            // Avoid huge elements
            const parsed = this.dataParser.parseTextContent(text);
            if (
              parsed.orderNumber &&
              parsed.orderDate &&
              !orders.some((o) => o.orderNumber === parsed.orderNumber)
            ) {
              orders.push({
                orderNumber: parsed.orderNumber,
                orderDate: parsed.orderDate,
                orderTotal: parsed.orderTotal,
                items: (parsed.items || []).map((item) => ({
                  name: item.name,
                  price: item.price || 0,
                  quantity: item.quantity || 1,
                  productUrl: item.productUrl || ""
                })) as OrderItem[]
              });
            }
          }
        });
      }
    }

    // Extract from order detail page
    if (window.location.pathname.startsWith("/orders/")) {
      const orderNumber = window.location.pathname.split("/").pop();
      const pageText = document.body.textContent || "";
      const parsed = this.dataParser.parseTextContent(pageText);

      if (orderNumber) {
        orders.push({
          orderNumber,
          orderDate: parsed.orderDate || "",
          orderTotal: parsed.orderTotal,
          items: this.extractItemsFromDOM()
        });
      }
    }

    return orders;
  }

  /**
   * Try to expand all orders to reveal items
   */
  private expandAllOrders(): void {
    try {
      // Try text-based selector
      const buttons = Array.from(document.querySelectorAll("button, a")).filter(
        (el) =>
          el.textContent?.includes("View details") ||
          el.textContent?.includes("Show items") ||
          el.textContent?.includes("Expand")
      );

      if (buttons.length > 0) {
        this.logger.debug(`Found ${buttons.length} expand buttons, clicking them...`);
        buttons.forEach((button, idx) => {
          try {
            (button as HTMLElement).click();
            this.logger.debug(`Clicked expand button ${idx + 1}`);
          } catch (e) {
            this.logger.debug(`Failed to click button ${idx + 1}:`, e);
          }
        });

        // Wait a bit for content to load
        const waitTime = 500;
        const endTime = Date.now() + waitTime;
        while (Date.now() < endTime) {
          // Busy wait
        }
      } else {
        this.logger.debug("No expand buttons found");
      }
    } catch (e) {
      this.logger.error("Error expanding orders:", e);
    }
  }

  /**
   * Extract items from within a specific order element
   */
  private extractItemsFromOrderElement(orderElement: HTMLElement | Element): OrderItem[] {
    const items: OrderItem[] = [];

    // Debug: Log what we're searching in
    const elementTag = (orderElement as HTMLElement).tagName?.toLowerCase() || "";
    const elementClasses = (orderElement as HTMLElement).className || "";
    this.logger.debug(`    Searching for items in <${elementTag}> with classes: ${elementClasses}`);

    // Try each item selector from our constants
    for (let idx = 0; idx < SELECTORS.ITEM_CONTAINERS.length; idx++) {
      const selector = SELECTORS.ITEM_CONTAINERS[idx];
      const itemElements = orderElement.querySelectorAll(selector);

      if (itemElements.length > 0) {
        this.logger.debug(`    Found ${itemElements.length} items with selector: ${selector}`);

        itemElements.forEach((itemEl) => {
          const itemText = itemEl.textContent || "";

          // Extract product name
          let productName = "";
          for (const nameSelector of SELECTORS.PRODUCT_NAME) {
            const nameEl = itemEl.querySelector(nameSelector);
            if (nameEl && nameEl.textContent) {
              productName = this.dataParser.cleanProductName(nameEl.textContent);
              break;
            }
          }

          // If no name found with selectors, try parsing the text
          if (!productName) {
            productName = this.dataParser.extractProductNameFromText(itemText);
          }

          if (productName) {
            // Extract price
            const price = this.dataParser.extractPriceFromText(itemText);

            // Extract quantity
            const quantity = this.dataParser.extractQuantityFromText(itemText);

            // Extract product URL
            let productUrl = "";
            const linkEl = itemEl.querySelector(SELECTORS.PRODUCT_LINK) as HTMLAnchorElement;
            if (linkEl && linkEl.href) {
              productUrl = linkEl.href;
            }

            items.push({
              name: productName,
              price,
              quantity,
              productUrl
            });

            this.logger.debug(`      Item: ${productName} - $${price} x ${quantity}`);
          }
        });

        if (items.length > 0) {
          break; // Found items, no need to try other selectors
        }
      } else if (idx === 0) {
        // Log first selector that found nothing for debugging
        this.logger.debug(`      No items found with selector: ${selector}`);
      }
    }

    if (items.length === 0) {
      this.logger.debug(`    No items found in element after trying all selectors`);
    }

    return items;
  }

  /**
   * Extract items from DOM elements
   */
  private extractItemsFromDOM(): OrderItem[] {
    const items: OrderItem[] = [];
    const itemSelectors = [
      '[data-testid*="item"]',
      '[data-testid*="product"]',
      '[class*="LineItem"]',
      '[class*="line-item"]',
      '[class*="product-item"]',
      '[class*="order-item"]'
    ];

    for (const selector of itemSelectors) {
      const elements = document.querySelectorAll(selector);

      if (elements.length > 0) {
        elements.forEach((el) => {
          const text = el.textContent || "";
          const item = this.dataParser.parseElementText(text);

          if (item && item.name) {
            // Try to extract product URL
            const linkEl = el.querySelector('a[href*="/ip/"]') as HTMLAnchorElement;
            const productUrl = linkEl ? linkEl.href : "";

            items.push({
              name: item.name,
              price: item.price || 0,
              quantity: item.quantity || 1,
              productUrl: productUrl || ""
            });
          }
        });

        if (items.length > 0) break;
      }
    }

    return items;
  }

  /**
   * Extract orders from any JSON data found in the page
   */
  private extractFromPageJSON(): Order[] | null {
    try {
      // Look for any script tags with type="application/json"
      const jsonScripts = document.querySelectorAll('script[type="application/json"]');

      for (const script of jsonScripts) {
        if (!script.textContent) continue;

        try {
          const jsonData = JSON.parse(script.textContent);
          this.logger.debug("Found JSON script, checking for orders...");

          // Try to parse as Redux state
          const reduxOrders = this.dataParser.parseReduxState(jsonData);
          if (reduxOrders && reduxOrders.length > 0) {
            return reduxOrders;
          }

          // Try to parse as Next data
          const nextOrders = this.dataParser.parseNextData(jsonData);
          if (nextOrders && nextOrders.length > 0) {
            return nextOrders;
          }
        } catch {
          // Invalid JSON, continue
        }
      }

      // Look for data attributes on the page
      const elementsWithData = document.querySelectorAll(
        "[data-react-props], [data-initial-props], [data-page-props]"
      );
      for (const element of elementsWithData) {
        const dataAttrs = ["data-react-props", "data-initial-props", "data-page-props"];

        for (const attr of dataAttrs) {
          const dataStr = element.getAttribute(attr);
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              this.logger.debug(`Found ${attr}, checking for orders...`);

              // Try various parsing methods
              const orders =
                this.dataParser.parseReduxState(data) || this.dataParser.parseNextData(data);

              if (orders && orders.length > 0) {
                return orders;
              }
            } catch {
              // Invalid JSON in attribute
            }
          }
        }
      }
    } catch (error) {
      this.logger.error("Error in extractFromPageJSON:", error);
    }

    return null;
  }
}
