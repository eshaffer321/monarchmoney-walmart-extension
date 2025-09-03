/**
 * DataParser - Pure business logic for parsing order data from various sources
 * This service contains no browser/DOM dependencies - works with plain objects
 */

import { Order } from "./OrderService";
import { PATTERNS, FILTER_KEYWORDS } from "../shared/content-constants";

export interface ParsedItem {
  name: string;
  price?: number;
  quantity?: number;
  productUrl?: string;
}

export interface ParsedOrder {
  orderNumber?: string;
  orderDate?: string;
  orderTotal?: number;
  tax?: number;
  deliveryCharges?: number;
  tip?: number;
  items?: ParsedItem[];
}

export class DataParser {
  /**
   * Parse Redux state data structure
   */
  parseReduxState(state: Record<string, unknown>): Order[] | null {
    try {
      // Look for order data in various possible locations
      const possiblePaths = [
        ["orders", "data"],
        ["account", "orders"],
        ["orderHistory", "orders"],
        ["data", "orders"],
        ["props", "pageProps", "initialData", "orders"]
      ];

      for (const path of possiblePaths) {
        const data = this.getNestedValue(state, path);
        if (data && Array.isArray(data)) {
          return this.parseOrderArray(data);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse Next.js data structure
   */
  parseNextData(nextData: Record<string, unknown>): Order[] | null {
    try {
      console.log("[DataParser] Parsing Next.js data, top-level keys:", Object.keys(nextData));

      const props = nextData.props as Record<string, unknown> | undefined;
      if (!props) {
        console.log("[DataParser] No props found in Next.js data");
        return null;
      }

      console.log("[DataParser] Props keys:", Object.keys(props));

      // Look for order data in Next.js props - expanded search
      const possiblePaths = [
        ["pageProps", "orders"],
        ["pageProps", "initialData", "orders"],
        ["pageProps", "data", "orders"],
        ["pageProps", "initialData", "data", "orders"],
        ["pageProps", "orderList"],
        ["pageProps", "orderHistory"],
        ["pageProps", "purchaseHistory"],
        ["pageProps", "initialReduxState", "orders"],
        ["pageProps", "initialReduxState", "orderHistory"],
        ["pageProps", "__APOLLO_STATE__"],
        ["pageProps", "initialProps", "orders"]
      ];

      for (const path of possiblePaths) {
        console.log("[DataParser] Checking path:", path.join("."));
        const data = this.getNestedValue(props, path);
        if (data) {
          console.log(
            "[DataParser] Found data at path, type:",
            typeof data,
            "is array?",
            Array.isArray(data)
          );

          if (Array.isArray(data)) {
            console.log("[DataParser] Found array with length:", data.length);
            if (data.length > 0) {
              console.log(
                "[DataParser] First item sample:",
                JSON.stringify(data[0], null, 2).slice(0, 500)
              );
            }
            const orders = this.parseOrderArray(data);
            if (orders && orders.length > 0) {
              return orders;
            }
          } else if (typeof data === "object") {
            // Sometimes orders are in an object with a data or orders property
            console.log(
              "[DataParser] Found object, keys:",
              Object.keys(data as Record<string, unknown>).slice(0, 10)
            );
            const objData = data as Record<string, unknown>;

            // Check nested properties
            const nestedArrayFields = ["orders", "data", "items", "results", "list"];
            for (const field of nestedArrayFields) {
              const nestedData = objData[field];
              if (Array.isArray(nestedData)) {
                console.log(
                  `[DataParser] Found nested array at ${field} with length:`,
                  nestedData.length
                );
                const orders = this.parseOrderArray(nestedData);
                if (orders && orders.length > 0) {
                  return orders;
                }
              }
            }
          }
        }
      }

      // Deep search in pageProps for any order-like data
      const pageProps = props.pageProps as Record<string, unknown> | undefined;
      if (pageProps) {
        console.log("[DataParser] All pageProps keys:", Object.keys(pageProps));

        // Search for order-related keys
        const orderKeys = Object.keys(pageProps).filter(
          (key) =>
            key.toLowerCase().includes("order") ||
            key.toLowerCase().includes("purchase") ||
            key.toLowerCase().includes("history")
        );

        if (orderKeys.length > 0) {
          console.log("[DataParser] Found order-related keys:", orderKeys);
          for (const key of orderKeys) {
            const value = pageProps[key];
            console.log(`[DataParser] Checking ${key}, type:`, typeof value);
            if (Array.isArray(value)) {
              console.log(`[DataParser] ${key} is array with length:`, value.length);
              if (value.length > 0) {
                console.log(`[DataParser] First item keys:`, Object.keys(value[0] || {}));
              }
              const orders = this.parseOrderArray(value);
              if (orders && orders.length > 0) {
                return orders;
              }
            } else if (value && typeof value === "object") {
              const objKeys = Object.keys(value as Record<string, unknown>);
              console.log(`[DataParser] ${key} object keys:`, objKeys);
              // Check if it has nested arrays
              for (const subKey of objKeys) {
                const subValue = (value as Record<string, unknown>)[subKey];
                if (Array.isArray(subValue)) {
                  console.log(
                    `[DataParser] Found array at ${key}.${subKey} with length:`,
                    subValue.length
                  );
                  const orders = this.parseOrderArray(subValue);
                  if (orders && orders.length > 0) {
                    return orders;
                  }
                }
              }
            }
          }
        }

        // Check if there's initialData
        const initialData = pageProps.initialData as Record<string, unknown> | undefined;
        if (initialData) {
          console.log("[DataParser] initialData keys:", Object.keys(initialData));

          // Deep search in initialData
          const dataOrderKeys = Object.keys(initialData).filter(
            (key) =>
              key.toLowerCase().includes("order") ||
              key.toLowerCase().includes("purchase") ||
              key.toLowerCase().includes("history")
          );

          if (dataOrderKeys.length > 0) {
            console.log("[DataParser] Found order keys in initialData:", dataOrderKeys);
            for (const key of dataOrderKeys) {
              const value = initialData[key];
              if (Array.isArray(value)) {
                const orders = this.parseOrderArray(value);
                if (orders && orders.length > 0) {
                  return orders;
                }
              }
            }
          }
        }
      }

      console.log("[DataParser] No orders found in Next.js data after extensive search");
      return null;
    } catch (error) {
      console.error("[DataParser] Error parsing Next.js data:", error);
      return null;
    }
  }

  /**
   * Parse an array of order objects
   */
  private parseOrderArray(orders: unknown[]): Order[] {
    const parsed: Order[] = [];

    console.log(`[DataParser] Parsing array of ${orders.length} potential orders`);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (typeof order === "object" && order !== null) {
        const parsedOrder = this.parseOrderObject(order as Record<string, unknown>);
        if (parsedOrder && parsedOrder.orderNumber && parsedOrder.orderDate) {
          console.log(`[DataParser] Successfully parsed order ${i + 1}:`, parsedOrder.orderNumber);
          parsed.push(parsedOrder as Order);
        } else {
          console.log(`[DataParser] Failed to parse order ${i + 1}, missing required fields`);
          if (i === 0) {
            // Log the first failed order for debugging
            console.log(
              "[DataParser] First failed order structure:",
              JSON.stringify(order, null, 2).slice(0, 500)
            );
          }
        }
      }
    }

    console.log(
      `[DataParser] Successfully parsed ${parsed.length} orders out of ${orders.length} items`
    );
    return parsed;
  }

  /**
   * Parse a single order object
   */
  private parseOrderObject(obj: Record<string, unknown>): ParsedOrder {
    // Expanded field names to check based on Walmart's possible structures
    const orderNumber = this.extractStringField(obj, [
      "orderNumber",
      "orderId",
      "id",
      "number",
      "orderNum",
      "purchaseOrderId",
      "transactionId",
      "orderIdentifier",
      "confirmationNumber"
    ]);

    const orderDate = this.extractStringField(obj, [
      "orderDate",
      "date",
      "createdAt",
      "placedDate",
      "purchaseDate",
      "orderPlacedDate",
      "submittedDate",
      "transactionDate",
      "created"
    ]);

    const orderTotal = this.extractNumberField(obj, [
      "orderTotal",
      "total",
      "grandTotal",
      "amount",
      "totalAmount",
      "orderAmount",
      "finalTotal",
      "totalPrice",
      "paymentTotal"
    ]);

    // Log if we're missing critical fields
    if (!orderNumber || !orderDate) {
      const availableKeys = Object.keys(obj).slice(0, 20);
      console.log("[DataParser] Order missing required fields. Available keys:", availableKeys);
    }

    return {
      orderNumber,
      orderDate,
      orderTotal,
      tax: this.extractNumberField(obj, ["tax", "taxAmount", "taxes", "totalTax"]),
      deliveryCharges: this.extractNumberField(obj, [
        "deliveryCharges",
        "shipping",
        "shippingCost",
        "shippingAmount",
        "deliveryFee"
      ]),
      tip: this.extractNumberField(obj, ["tip", "tipAmount", "gratuity"]),
      items: this.extractItems(obj)
    };
  }

  /**
   * Extract items from order object
   */
  private extractItems(obj: Record<string, unknown>): ParsedItem[] {
    const itemFields = ["items", "lineItems", "products", "orderItems"];

    for (const field of itemFields) {
      const items = obj[field];
      if (Array.isArray(items)) {
        return items
          .map((item) => this.parseItemObject(item))
          .filter((item): item is ParsedItem => item !== null);
      }
    }

    return [];
  }

  /**
   * Parse a single item object
   */
  private parseItemObject(item: unknown): ParsedItem | null {
    if (typeof item !== "object" || item === null) {
      return null;
    }

    const obj = item as Record<string, unknown>;
    const name = this.extractStringField(obj, ["name", "productName", "title", "description"]);

    if (!name || name.length < 3) {
      return null;
    }

    return {
      name,
      price: this.extractNumberField(obj, ["price", "unitPrice", "itemPrice", "amount"]),
      quantity: this.extractNumberField(obj, ["quantity", "qty", "count"]) || 1,
      productUrl: this.extractStringField(obj, ["productUrl", "url", "link", "href"])
    };
  }

  /**
   * Parse text content to extract order information
   */
  parseTextContent(text: string): {
    orderNumber?: string;
    orderDate?: string;
    orderTotal?: number;
    items: ParsedItem[];
  } {
    return {
      orderNumber: this.extractOrderNumberFromText(text),
      orderDate: this.extractDateFromText(text),
      orderTotal: this.extractTotalFromText(text),
      items: this.extractItemsFromText(text)
    };
  }

  /**
   * Extract order number from text
   */
  extractOrderNumberFromText(text: string): string | undefined {
    const match = text.match(PATTERNS.ORDER_NUMBER);
    return match ? match[1] : undefined;
  }

  /**
   * Extract date from text
   */
  extractDateFromText(text: string): string | undefined {
    const match = text.match(PATTERNS.DATE);
    if (!match) return undefined;

    let dateStr = match[0];
    // Remove "Delivered on" or similar prefixes
    dateStr = dateStr.replace(/^(?:Delivered|Placed|Order(?:ed)?)\s+on\s+/i, "");

    // If no year is present, add current year
    if (!dateStr.match(/\d{4}/)) {
      const currentYear = new Date().getFullYear();
      dateStr = `${dateStr}, ${currentYear}`;
    }

    return dateStr;
  }

  /**
   * Extract total from text
   */
  extractTotalFromText(text: string): number | undefined {
    // First try the explicit total pattern
    const match = text.match(PATTERNS.ORDER_TOTAL);
    if (match) {
      return this.parsePrice(match[1]);
    }

    // Try other total patterns
    const totalPatterns = [
      /\$\s*([\d,]+\.?\d{2})\s*(?:total|Total)/i,
      /(?:total|Total)\s*:\s*\$\s*([\d,]+\.?\d{2})/i,
      /(?:Grand\s+)?Total\s+\$\s*([\d,]+\.?\d{2})/i
    ];

    for (const pattern of totalPatterns) {
      const totalMatch = text.match(pattern);
      if (totalMatch) {
        return this.parsePrice(totalMatch[1]);
      }
    }

    // Fallback: look for the largest price in the text (likely the total)
    PATTERNS.PRICE.lastIndex = 0;
    const matches = [...text.matchAll(PATTERNS.PRICE)];

    if (matches.length > 0) {
      const prices = matches.map((m) => this.parsePrice(m[1]));
      // Return the largest price as it's likely the total
      return Math.max(...prices);
    }

    return undefined;
  }

  /**
   * Extract price from text
   */
  extractPriceFromText(text: string): number {
    // Reset the global regex
    PATTERNS.PRICE.lastIndex = 0;
    const matches = [...text.matchAll(PATTERNS.PRICE)];

    if (matches.length === 0) return 0;

    // Return the largest price (usually the total, not unit price)
    const prices = matches.map((m) => this.parsePrice(m[1]));
    return Math.max(...prices);
  }

  /**
   * Extract quantity from text
   */
  extractQuantityFromText(text: string): number {
    // Try different quantity patterns
    let match = text.match(PATTERNS.QUANTITY);
    if (match) {
      const qty = parseInt(match[1]);
      if (qty > 0 && qty < 100) return qty;
    }

    match = text.match(PATTERNS.QUANTITY_X);
    if (match) {
      const qty = parseInt(match[1]);
      if (qty > 0 && qty < 100) return qty;
    }

    match = text.match(PATTERNS.QUANTITY_PARENS);
    if (match) {
      const qty = parseInt(match[1]);
      if (qty > 0 && qty < 100) return qty;
    }

    return 1;
  }

  /**
   * Extract items from text (basic extraction)
   */
  extractItemsFromText(text: string): ParsedItem[] {
    const items: ParsedItem[] = [];
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    // Skip known non-item patterns
    const skipPatterns = [
      /^Order\s*#/i,
      /^Delivered/i,
      /^Start a return/i,
      /^View details/i,
      /^Delivery from/i,
      /^Total/i,
      /^Subtotal/i,
      /^Tax/i,
      /^Shipping/i,
      /^\+\d+$/ // Skip the "+8" type indicators
    ];

    for (const line of lines) {
      // Skip short lines or known patterns
      if (line.length < 3 || skipPatterns.some((pattern) => pattern.test(line))) {
        continue;
      }

      // Look for lines that might be product names
      // Clean common patterns
      let potentialName = line;

      // Remove price if present
      potentialName = potentialName.replace(/\$\s*[\d,]+\.?\d{0,2}/, "").trim();

      // Remove quantity patterns
      potentialName = potentialName.replace(/(?:Qty|Quantity)[\s:]*\d+/i, "").trim();
      potentialName = potentialName.replace(/^\d+\s*x\s+/i, "").trim();

      // Clean with our cleanup patterns
      const cleaned = this.cleanProductName(potentialName);

      if (cleaned && cleaned.length > 3 && !this.isLikelyNotProduct(cleaned)) {
        // Extract price from original line if present
        const priceMatch = line.match(/\$\s*([\d,]+\.?\d{2})/);
        const price = priceMatch ? this.parsePrice(priceMatch[1]) : 0;

        // Extract quantity if present
        const quantity = this.extractQuantityFromText(line);

        items.push({
          name: cleaned,
          price,
          quantity
        });
      }
    }

    return items;
  }

  /**
   * Check if text is likely not a product name
   */
  private isLikelyNotProduct(text: string): boolean {
    const nonProductPatterns = [
      /^(view|start|cancel|return|track|details|delivery)/i,
      /^(from store|pickup|shipping)/i,
      /^(order|purchase|transaction)/i,
      /^[\d\s\-+]+$/, // Just numbers and symbols
      /^[A-Z]{2,}$/ // All caps abbreviations
    ];

    return nonProductPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Clean product name by removing common patterns
   */
  cleanProductName(text: string): string {
    if (!text) return "";

    let cleaned = text.trim();

    // Apply all cleanup patterns from our constants
    for (const pattern of Object.values(PATTERNS.CLEANUP)) {
      cleaned = cleaned.replace(pattern, "").trim();
    }

    // Remove filter keywords
    for (const keyword of FILTER_KEYWORDS) {
      if (cleaned.includes(keyword)) {
        return "";
      }
    }

    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  /**
   * Extract product name from text
   */
  extractProductNameFromText(text: string): string {
    if (!text) return "";

    // Split into lines and find the most likely product name
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);

    for (const line of lines) {
      // Skip lines that are too short or contain only numbers/prices
      if (line.length < 3 || /^\$?[\d.,]+$/.test(line)) {
        continue;
      }

      // Skip lines with filter keywords
      const skipLine = FILTER_KEYWORDS.some((keyword) =>
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      if (skipLine) continue;

      // Clean the potential product name
      const cleaned = this.cleanProductName(line);
      if (cleaned && cleaned.length > 3) {
        return cleaned;
      }
    }

    // Fallback: clean the entire text
    return this.cleanProductName(text);
  }

  /**
   * Parse DOM element text (for refactored extractor)
   */
  parseElementText(elementText: string): ParsedItem | null {
    if (!elementText || elementText.length < 10) {
      return null;
    }

    // Check if this is a filtered keyword
    for (const keyword of FILTER_KEYWORDS) {
      if (elementText.includes(keyword)) {
        return null;
      }
    }

    // Extract product name (remove price and quantity info)
    let name = elementText;

    // Clean up the name using shared patterns
    const cleanupPatterns = Object.values(PATTERNS.CLEANUP);

    for (const pattern of cleanupPatterns) {
      name = name.replace(pattern, "").trim();
    }

    // Remove extra whitespace
    name = name
      .replace(/\s+/g, " ")
      .replace(/\u200B/g, "")
      .trim();

    if (name.length < 3 || /^[\d.]+$/.test(name)) {
      return null;
    }

    return {
      name,
      price: this.extractPriceFromText(elementText),
      quantity: this.extractQuantityFromText(elementText)
    };
  }

  /**
   * Helper: Parse price string to number
   */
  private parsePrice(priceStr: string): number {
    const cleaned = priceStr.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Helper: Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;

    for (const key of path) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * Helper: Extract string field from object
   */
  private extractStringField(
    obj: Record<string, unknown>,
    fieldNames: string[]
  ): string | undefined {
    for (const field of fieldNames) {
      const value = obj[field];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Helper: Extract number field from object
   */
  private extractNumberField(
    obj: Record<string, unknown>,
    fieldNames: string[]
  ): number | undefined {
    for (const field of fieldNames) {
      const value = obj[field];
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string") {
        const parsed = this.parsePrice(value);
        if (parsed > 0) return parsed;
      }
    }
    return undefined;
  }
}
