/**
 * OrderService - Pure business logic for order processing
 * This service contains no browser-specific dependencies
 */

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  productUrl: string;
}

export interface Order {
  orderNumber: string;
  orderDate: string;
  orderTotal?: number;
  tax?: number;
  deliveryCharges?: number;
  tip?: number;
  items?: OrderItem[];
}

export interface OrderData {
  orders: Order[];
}

export interface ProcessingResult {
  success: boolean;
  orderCount: number;
  itemCount: number;
  processedOrderNumbers: string[];
  errors?: string[];
}

export class OrderService {
  private processedOrderCache: Set<string>;

  constructor() {
    this.processedOrderCache = new Set();
  }

  /**
   * Process raw order data and format it
   */
  processOrders(rawOrders: Order[]): OrderData {
    const validOrders = this.validateAndCleanOrders(rawOrders);

    return {
      orders: validOrders.map((order) => this.formatOrder(order))
    };
  }

  /**
   * Format a single order
   */
  private formatOrder(order: Order): Order {
    return {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      orderTotal: this.parseNumber(order.orderTotal),
      tax: this.parseNumber(order.tax),
      deliveryCharges: this.parseNumber(order.deliveryCharges),
      tip: this.parseNumber(order.tip),
      items: this.formatItems(order.items || [])
    };
  }

  /**
   * Format order items
   */
  private formatItems(items: OrderItem[]): OrderItem[] {
    return items
      .filter((item) => this.isValidItem(item))
      .map((item) => ({
        name: this.cleanProductName(item.name),
        price: this.parseNumber(item.price),
        quantity: this.parseNumber(item.quantity) || 1,
        productUrl: item.productUrl || ""
      }));
  }

  /**
   * Clean product name from extra information
   */
  cleanProductName(name: string): string {
    if (!name) return "";

    let cleaned = name.trim();

    // Remove common suffixes and patterns
    const patterns = [
      /\s*(Shopped)?Qty\s+\d+.*$/i,
      /Multipack Quantity:.*$/gi,
      /Was\s+\$[\d.,]+/gi, // Process "Was" pattern before general price pattern
      /\$[\d.,]+.*$/i,
      /[\d.]+¢\/[a-z\s]+.*$/i,
      /Weight-adjusted.*$/i,
      /Count:.*$/i
    ];

    for (const pattern of patterns) {
      cleaned = cleaned.replace(pattern, "").trim();
    }

    // Remove zero-width spaces and normalize whitespace
    cleaned = cleaned
      .replace(/\u200B/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return cleaned;
  }

  /**
   * Validate and clean orders array
   */
  private validateAndCleanOrders(orders: Order[]): Order[] {
    if (!Array.isArray(orders)) {
      return [];
    }

    return orders.filter((order) => this.isValidOrder(order));
  }

  /**
   * Check if an order is valid
   */
  isValidOrder(order: unknown): order is Order {
    if (!order || typeof order !== "object") {
      return false;
    }

    const o = order as Record<string, unknown>;

    return (
      typeof o.orderNumber === "string" &&
      o.orderNumber.length > 0 &&
      typeof o.orderDate === "string" &&
      o.orderDate.length > 0
    );
  }

  /**
   * Check if an item is valid
   */
  private isValidItem(item: unknown): item is OrderItem {
    if (!item || typeof item !== "object") {
      return false;
    }

    const i = item as Record<string, unknown>;

    return (
      typeof i.name === "string" &&
      i.name.length > 3 &&
      !this.isFilteredProductName(i.name as string)
    );
  }

  /**
   * Check if product name should be filtered out
   */
  private isFilteredProductName(name: string): boolean {
    const filterKeywords = [
      "ReorderListsRegistries",
      "Lists & Registries",
      "Sign in",
      "Create account"
    ];

    return filterKeywords.some((keyword) => name.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Parse a number value safely
   */
  private parseNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }

    if (typeof value === "string") {
      const cleaned = value.replace(/[^0-9.-]/g, "");
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
  }

  /**
   * Extract price from text
   */
  extractPrice(text: string): number {
    const priceMatch = text.match(/\$\s*([\d,]+\.?\d{2})/);
    if (priceMatch) {
      return this.parseNumber(priceMatch[1]);
    }
    return 0;
  }

  /**
   * Extract date from text
   */
  extractDate(text: string): string | null {
    const dateMatch = text.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i
    );
    return dateMatch ? dateMatch[0] : null;
  }

  /**
   * Extract order number from text
   */
  extractOrderNumber(text: string): string | null {
    const orderMatch = text.match(/(?:Order\s*#?|#)\s*([\d-]+)/i);
    return orderMatch ? orderMatch[1] : null;
  }

  /**
   * Calculate order statistics
   */
  calculateOrderStats(orders: Order[]): {
    totalOrders: number;
    totalItems: number;
    totalAmount: number;
    averageOrderValue: number;
  } {
    const totalOrders = orders.length;
    const totalItems = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
    const totalAmount = orders.reduce((sum, order) => sum + (order.orderTotal || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    return {
      totalOrders,
      totalItems,
      totalAmount,
      averageOrderValue
    };
  }

  /**
   * Filter orders that haven't been processed
   */
  filterNewOrders(orders: Order[], processedOrderNumbers: string[]): Order[] {
    const processedSet = new Set(processedOrderNumbers);
    return orders.filter((order) => !processedSet.has(order.orderNumber));
  }

  /**
   * Mark orders as processed
   */
  markOrdersAsProcessed(orderNumbers: string[]): void {
    orderNumbers.forEach((num) => this.processedOrderCache.add(num));
  }

  /**
   * Get processed order numbers
   */
  getProcessedOrderNumbers(): string[] {
    return Array.from(this.processedOrderCache);
  }

  /**
   * Clear processed orders cache
   */
  clearProcessedOrders(): void {
    this.processedOrderCache.clear();
  }
}
