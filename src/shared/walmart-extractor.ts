// Walmart content extractor class - converted from original content.js
import { SELECTORS, PATTERNS } from "./content-constants.js";

// Type definitions
declare global {
  interface Window {
    __WML_REDUX_INITIAL_STATE__?: Record<string, unknown>;
    __NEXT_DATA__?: {
      props?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }
}

// Logger interface
interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

interface OrderItem {
  name: string;
  price?: number;
  quantity?: number;
  productUrl?: string;
}

interface OrderData {
  orders?: Array<{
    orderNumber: string;
    orderDate: string;
    orderTotal?: number;
    tax?: number;
    deliveryCharges?: number;
    tip?: number;
    items?: OrderItem[];
  }>;
}

export class WalmartContentExtractor {
  private extractedData: OrderData | null = null;

  constructor(private logger: Logger) {}

  // Extract order data from Redux state on Walmart pages
  extractOrderData(): OrderData | null {
    try {
      this.logger.debug("Starting order data extraction");
      this.logger.debug("Current URL:", window.location.href);

      // Method 1: Look for Redux state in window object
      if (window.__WML_REDUX_INITIAL_STATE__) {
        this.logger.debug("Found Redux state in window object");
        const result = this.parseReduxState(window.__WML_REDUX_INITIAL_STATE__);
        if (result) return result;
      }

      // Method 2: Look for Next.js data
      if (window.__NEXT_DATA__) {
        this.logger.debug("Found Next.js data");
        const result = this.parseNextData(window.__NEXT_DATA__);
        if (result) return result;
      }

      // Method 2b: Try to find React props in DOM elements
      this.logger.debug("Checking for React props in DOM elements...");
      const reactProps = this.findReactProps();
      if (reactProps) {
        return reactProps;
      }

      // Method 3: Look for Redux state in script tags
      const scriptTags = document.querySelectorAll("script");
      for (const script of scriptTags) {
        if (script.textContent) {
          if (script.textContent.includes("__WML_REDUX_INITIAL_STATE__")) {
            const match = script.textContent.match(
              /window\.__WML_REDUX_INITIAL_STATE__\s*=\s*({.*?});/s
            );
            if (match) {
              this.logger.debug("Found Redux state in script tag");
              const stateData = JSON.parse(match[1]);
              return this.parseReduxState(stateData);
            }
          }

          if (script.textContent.includes("__NEXT_DATA__")) {
            const match = script.textContent.match(
              /window\.__NEXT_DATA__\s*=\s*({.*?})\s*;?\s*<\/script>/s
            );
            if (match) {
              this.logger.debug("Found Next.js data in script tag");
              const nextData = JSON.parse(match[1]);
              return this.parseNextData(nextData);
            }
          }
        }
      }

      // Method 4: Extract from page content for order list pages
      if (window.location.pathname === "/orders") {
        return this.extractOrderList();
      }

      // Method 5: Extract from order detail page
      if (window.location.pathname.startsWith("/orders/")) {
        this.logger.debug("On order detail page, attempting DOM extraction...");
        return this.extractOrderDetail();
      }

      // Method 6: Last resort - try DOM extraction anyway
      this.logger.debug(
        "No data found in state objects, attempting DOM extraction as last resort..."
      );
      if (window.location.pathname.includes("/orders")) {
        return this.extractOrderDetail();
      }

      return null;
    } catch (error) {
      this.logger.error("Error extracting order data:", error);
      return null;
    }
  }

  private extractOrderDetail(): OrderData | null {
    this.logger.debug("Extracting order detail from DOM");

    // Extract order number from URL
    const orderNumber = window.location.pathname.split("/").pop();

    const order = {
      orderNumber,
      orderDate: null as string | null,
      orderTotal: 0,
      tax: 0,
      deliveryCharges: 0,
      tip: 0,
      items: [] as OrderItem[]
    };

    // Try to extract from page content
    const pageText = document.body.textContent || "";

    // Extract date
    const dateMatch = pageText.match(PATTERNS.DATE);
    if (dateMatch) {
      order.orderDate = dateMatch[0];
    }

    // Extract total
    const totalMatch = pageText.match(PATTERNS.ORDER_TOTAL);
    if (totalMatch) {
      order.orderTotal = parseFloat(totalMatch[1].replace(",", ""));
    }

    // Try to extract items from DOM
    this.logger.debug("Attempting DOM-based item extraction...");

    // Look for item containers using various selectors
    const itemSelectors = SELECTORS.ITEM_CONTAINERS;

    for (const selector of itemSelectors) {
      const itemElements = document.querySelectorAll(selector);
      this.logger.debug(`Selector "${selector}" found ${itemElements.length} elements`);

      if (itemElements.length > 0) {
        itemElements.forEach((el, index) => {
          const itemData = this.extractItemFromDOM(el as HTMLElement);
          if (itemData && itemData.name) {
            this.logger.debug(`Extracted item ${index} from DOM:`, itemData);
            order.items.push(itemData);
          }
        });

        if (order.items.length > 0) {
          this.logger.info(`Successfully extracted ${order.items.length} items from DOM`);
          break;
        }
      }
    }

    // If still no items, try text-based extraction
    if (order.items.length === 0) {
      this.logger.debug("Attempting text-based item extraction...");
      const items = this.extractItemsFromText(pageText);
      if (items.length > 0) {
        order.items = items;
        this.logger.debug(`Extracted ${items.length} items from text`);
      }
    }

    return { orders: [order] };
  }

  private extractItemFromDOM(element: HTMLElement): OrderItem | null {
    const text = element.textContent || "";

    // Skip non-product elements
    if (
      text.includes("ReorderListsRegistries") ||
      text.includes("Lists & Registries") ||
      text.length < 10
    ) {
      return null;
    }

    // Try to find product name
    let name = "";
    const nameEl = element.querySelector(
      '[class*="product-name"], [class*="item-name"], [class*="title"], h3, h4, a[href*="/ip/"]'
    );
    if (nameEl) {
      name = nameEl.textContent?.trim() || "";
    } else {
      // Look for the longest text that's not a price
      const texts = text
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t && !t.includes("$"));
      if (texts.length > 0) {
        // Get the longest meaningful text
        name = texts.reduce((longest, current) => {
          if (current.length > longest.length && !current.match(/^[\d.]+¢/)) {
            return current;
          }
          return longest;
        }, "");
      }
    }

    // If still no name, use the full text but clean it up
    if (!name) {
      name = text;
    }

    // Clean up the name - remove price info and multipack text
    if (name) {
      const originalName = name;

      // Remove everything after "ShoppedQty" or "Qty"
      name = name.replace(PATTERNS.CLEANUP.SHOPPED_QTY, "").trim();

      // Remove "Multipack Quantity:" and everything after
      name = name.replace(PATTERNS.CLEANUP.MULTIPACK, "").trim();

      // Remove price patterns (both dollars and cents)
      name = name.replace(PATTERNS.CLEANUP.PRICE_END, "").trim();
      name = name.replace(PATTERNS.CLEANUP.CENTS_UNIT, "").trim();

      // Remove "Weight-adjusted" and everything after
      name = name.replace(PATTERNS.CLEANUP.WEIGHT_ADJUSTED, "").trim();

      // Remove "Count:" and everything after
      name = name.replace(PATTERNS.CLEANUP.COUNT_INFO, "").trim();

      // Remove "Was $X.XX" patterns
      name = name.replace(PATTERNS.CLEANUP.WAS_PRICE, "").trim();

      // Clean up extra spaces and special characters
      name = name.replace(/\s+/g, " ").trim();
      name = name.replace(/\u200B/g, "").trim(); // Remove zero-width spaces

      this.logger.debug(
        `Name cleanup: "${originalName.substring(0, 50)}..." -> "${name.substring(0, 50)}..."`
      );
    }

    // Try to find the actual product price (not unit price)
    let price = 0;
    // Look for all price patterns
    const priceMatches = [...text.matchAll(PATTERNS.PRICE)];
    const prices = priceMatches.map((m) => parseFloat(m[1].replace(",", "")));

    if (prices.length > 0) {
      // If there's only one price, use it
      if (prices.length === 1) {
        price = prices[0];
      } else {
        // Multiple prices - try to find the item total, not the unit price
        // Usually the larger price is the total
        price = Math.max(...prices);

        // But if the max price seems like a unit price (very small), use the first price
        if (price < 1 && prices[0] > price) {
          price = prices[0];
        }
      }
    }

    // Try to find quantity
    let quantity = 1;

    // Look for explicit quantity indicators
    const qtyMatch = text.match(PATTERNS.QUANTITY);
    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1]);
      // The "Multipack Quantity: 175" is NOT the purchase quantity
      // Only accept reasonable quantities
      if (qty > 0 && qty < 20 && !text.includes("Multipack Quantity")) {
        quantity = qty;
      }
    }

    // Extract product URL if available
    let productUrl = "";
    const linkEl = element.querySelector('a[href*="/ip/"]') as HTMLAnchorElement;
    if (linkEl) {
      productUrl = linkEl.href;
    }

    // Final validation
    if (name && name.length > 3 && !name.match(/^[\d.]+$/)) {
      this.logger.debug(
        `Extracted: name="${name.substring(0, 40)}...", price=${price}, qty=${quantity}`
      );
      return { name, price, quantity, productUrl };
    }

    return null;
  }

  private extractItemsFromText(text: string): OrderItem[] {
    // Very basic text extraction as last resort
    const items = [];
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for lines that have both text and a price
      if (line.length > 10 && !line.includes("Total") && !line.includes("Subtotal")) {
        const priceMatch = line.match(PATTERNS.PRICE);
        if (priceMatch) {
          const name = line.replace(/\$\s*[\d,]+\.?\d{2}/, "").trim();
          if (name.length > 3) {
            items.push({
              name,
              price: parseFloat(priceMatch[1].replace(",", "")),
              quantity: 1,
              productUrl: ""
            });
          }
        }
      }
    }

    return items;
  }

  private extractOrderList(): OrderData | null {
    this.logger.debug("Extracting order list from DOM");
    const orders = [];

    // Look for order elements in the DOM
    const orderElements = document.querySelectorAll(
      '[data-testid*="order"], .order-card, [class*="order"]'
    );

    orderElements.forEach((orderEl) => {
      const orderNumber = this.extractOrderNumber(orderEl as HTMLElement);
      if (orderNumber) {
        orders.push({
          orderNumber,
          orderDate: this.extractOrderDate(orderEl as HTMLElement),
          orderTotal: this.extractOrderTotal(orderEl as HTMLElement)
        });
      }
    });

    this.logger.debug(`Extracted ${orders.length} orders from DOM`);
    return { orders };
  }

  private extractOrderNumber(element: HTMLElement): string | null {
    const text = element.textContent || "";
    const match = text.match(PATTERNS.ORDER_NUMBER);
    return match ? match[1] : null;
  }

  private extractOrderDate(element: HTMLElement): string | null {
    const text = element.textContent || "";
    const match = text.match(PATTERNS.DATE);
    return match ? match[0] : null;
  }

  private extractOrderTotal(element: HTMLElement): number {
    const text = element.textContent || "";
    const match = text.match(PATTERNS.PRICE);
    return match ? parseFloat(match[1].replace(",", "")) : 0;
  }

  // Placeholder methods for completeness (these would need full implementation)
  private parseReduxState(_state: Record<string, unknown>): OrderData | null {
    // This would contain the full Redux state parsing logic from the original
    // For now, returning null to focus on the module conversion
    return null;
  }

  private parseNextData(_nextData: {
    props?: Record<string, unknown>;
    [key: string]: unknown;
  }): OrderData | null {
    // This would contain the full Next.js data parsing logic from the original
    // For now, returning null to focus on the module conversion
    return null;
  }

  private findReactProps(): OrderData | null {
    // This would contain the full React props finding logic from the original
    // For now, returning null to focus on the module conversion
    return null;
  }
}
