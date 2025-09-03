import { describe, it, expect, beforeEach } from "vitest";
import { OrderService, Order } from "../OrderService";

describe("OrderService", () => {
  let orderService: OrderService;

  beforeEach(() => {
    orderService = new OrderService();
  });

  describe("processOrders", () => {
    it("should process valid orders correctly", () => {
      const rawOrders: Order[] = [
        {
          orderNumber: "123456",
          orderDate: "Jan 15, 2024",
          orderTotal: 99.99,
          tax: 8.99,
          deliveryCharges: 5.99,
          tip: 2.0,
          items: [
            {
              name: "Product 1",
              price: 49.99,
              quantity: 2,
              productUrl: "https://walmart.com/product1"
            }
          ]
        }
      ];

      const result = orderService.processOrders(rawOrders);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe("123456");
      expect(result.orders[0].orderTotal).toBe(99.99);
      expect(result.orders[0].items).toHaveLength(1);
    });

    it("should filter out invalid orders", () => {
      const rawOrders = [
        { orderNumber: "123", orderDate: "Jan 1, 2024" },
        { orderNumber: "", orderDate: "Jan 2, 2024" }, // Invalid - empty order number
        { orderNumber: "456", orderDate: "" }, // Invalid - empty date
        null as unknown as Order,
        undefined as unknown as Order
      ];

      const result = orderService.processOrders(rawOrders);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].orderNumber).toBe("123");
    });

    it("should handle string numbers and convert them", () => {
      const rawOrders: Order[] = [
        {
          orderNumber: "123",
          orderDate: "Jan 1, 2024",
          orderTotal: "$99.99" as unknown as number,
          tax: "8.99" as unknown as number,
          items: [
            {
              name: "Product",
              price: "$19.99" as unknown as number,
              quantity: "3" as unknown as number,
              productUrl: ""
            }
          ]
        }
      ];

      const result = orderService.processOrders(rawOrders);

      expect(result.orders[0].orderTotal).toBe(99.99);
      expect(result.orders[0].tax).toBe(8.99);
      expect(result.orders[0].items![0].price).toBe(19.99);
      expect(result.orders[0].items![0].quantity).toBe(3);
    });
  });

  describe("cleanProductName", () => {
    it("should remove quantity information", () => {
      expect(orderService.cleanProductName("Product Name Qty 5")).toBe("Product Name");
      expect(orderService.cleanProductName("Product Name ShoppedQty 3")).toBe("Product Name");
    });

    it("should remove multipack quantity", () => {
      expect(orderService.cleanProductName("Product Multipack Quantity: 175")).toBe("Product");
    });

    it("should remove price information", () => {
      expect(orderService.cleanProductName("Product $19.99")).toBe("Product");
      expect(orderService.cleanProductName("Product 99¢/oz")).toBe("Product");
    });

    it("should remove weight-adjusted text", () => {
      expect(orderService.cleanProductName("Product Weight-adjusted total")).toBe("Product");
    });

    it("should remove count information", () => {
      expect(orderService.cleanProductName("Product Count: 12")).toBe("Product");
    });

    it("should remove 'Was price' patterns", () => {
      expect(orderService.cleanProductName("Product Was $29.99")).toBe("Product");
    });

    it("should handle multiple patterns in one name", () => {
      expect(orderService.cleanProductName("Product Name Qty 2 Was $19.99 $15.99")).toBe(
        "Product Name"
      );
    });

    it("should normalize whitespace", () => {
      expect(orderService.cleanProductName("Product   Name    ")).toBe("Product Name");
    });

    it("should handle empty or invalid input", () => {
      expect(orderService.cleanProductName("")).toBe("");
      expect(orderService.cleanProductName(null as unknown as string)).toBe("");
      expect(orderService.cleanProductName(undefined as unknown as string)).toBe("");
    });
  });

  describe("isValidOrder", () => {
    it("should validate correct order objects", () => {
      expect(
        orderService.isValidOrder({
          orderNumber: "123",
          orderDate: "Jan 1, 2024"
        })
      ).toBe(true);
    });

    it("should reject invalid order objects", () => {
      expect(orderService.isValidOrder(null)).toBe(false);
      expect(orderService.isValidOrder(undefined)).toBe(false);
      expect(orderService.isValidOrder({})).toBe(false);
      expect(orderService.isValidOrder({ orderNumber: "" })).toBe(false);
      expect(orderService.isValidOrder({ orderDate: "Jan 1" })).toBe(false);
      expect(
        orderService.isValidOrder({
          orderNumber: "123",
          orderDate: ""
        })
      ).toBe(false);
    });
  });

  describe("extractPrice", () => {
    it("should extract price from text", () => {
      expect(orderService.extractPrice("Total: $99.99")).toBe(99.99);
      expect(orderService.extractPrice("Price $1,234.56")).toBe(1234.56);
      expect(orderService.extractPrice("No price here")).toBe(0);
    });
  });

  describe("extractDate", () => {
    it("should extract dates from text", () => {
      expect(orderService.extractDate("Order placed on Jan 15, 2024")).toBe("Jan 15, 2024");
      expect(orderService.extractDate("December 25, 2023 was the date")).toBe("December 25, 2023");
      expect(orderService.extractDate("No date here")).toBeNull();
    });

    it("should handle various date formats", () => {
      expect(orderService.extractDate("Feb 1 2024")).toBe("Feb 1 2024");
      expect(orderService.extractDate("September 30, 2024")).toBe("September 30, 2024");
    });
  });

  describe("extractOrderNumber", () => {
    it("should extract order numbers from text", () => {
      expect(orderService.extractOrderNumber("Order #200013724127732")).toBe("200013724127732");
      expect(orderService.extractOrderNumber("Order 123456789012")).toBe("123456789012");
      expect(orderService.extractOrderNumber("#987654321098765")).toBe("987654321098765");
      expect(orderService.extractOrderNumber("No order number")).toBeNull();
    });
  });

  describe("calculateOrderStats", () => {
    it("should calculate statistics correctly", () => {
      const orders: Order[] = [
        {
          orderNumber: "1",
          orderDate: "Jan 1",
          orderTotal: 100,
          items: [
            { name: "Item1", price: 50, quantity: 1, productUrl: "" },
            { name: "Item2", price: 50, quantity: 1, productUrl: "" }
          ]
        },
        {
          orderNumber: "2",
          orderDate: "Jan 2",
          orderTotal: 50,
          items: [{ name: "Item3", price: 50, quantity: 1, productUrl: "" }]
        }
      ];

      const stats = orderService.calculateOrderStats(orders);

      expect(stats.totalOrders).toBe(2);
      expect(stats.totalItems).toBe(3);
      expect(stats.totalAmount).toBe(150);
      expect(stats.averageOrderValue).toBe(75);
    });

    it("should handle empty orders array", () => {
      const stats = orderService.calculateOrderStats([]);

      expect(stats.totalOrders).toBe(0);
      expect(stats.totalItems).toBe(0);
      expect(stats.totalAmount).toBe(0);
      expect(stats.averageOrderValue).toBe(0);
    });

    it("should handle orders without items", () => {
      const orders: Order[] = [
        { orderNumber: "1", orderDate: "Jan 1", orderTotal: 100 },
        { orderNumber: "2", orderDate: "Jan 2" }
      ];

      const stats = orderService.calculateOrderStats(orders);

      expect(stats.totalItems).toBe(0);
      expect(stats.totalAmount).toBe(100);
    });
  });

  describe("filterNewOrders", () => {
    it("should filter out processed orders", () => {
      const orders: Order[] = [
        { orderNumber: "1", orderDate: "Jan 1" },
        { orderNumber: "2", orderDate: "Jan 2" },
        { orderNumber: "3", orderDate: "Jan 3" }
      ];
      const processed = ["1", "3"];

      const newOrders = orderService.filterNewOrders(orders, processed);

      expect(newOrders).toHaveLength(1);
      expect(newOrders[0].orderNumber).toBe("2");
    });

    it("should return all orders when none are processed", () => {
      const orders: Order[] = [
        { orderNumber: "1", orderDate: "Jan 1" },
        { orderNumber: "2", orderDate: "Jan 2" }
      ];

      const newOrders = orderService.filterNewOrders(orders, []);

      expect(newOrders).toHaveLength(2);
    });
  });

  describe("processed orders cache management", () => {
    it("should mark orders as processed", () => {
      orderService.markOrdersAsProcessed(["1", "2", "3"]);
      const processed = orderService.getProcessedOrderNumbers();

      expect(processed).toContain("1");
      expect(processed).toContain("2");
      expect(processed).toContain("3");
    });

    it("should not duplicate processed order numbers", () => {
      orderService.markOrdersAsProcessed(["1", "2"]);
      orderService.markOrdersAsProcessed(["2", "3"]);
      const processed = orderService.getProcessedOrderNumbers();

      expect(processed).toHaveLength(3);
      expect(processed).toContain("1");
      expect(processed).toContain("2");
      expect(processed).toContain("3");
    });

    it("should clear processed orders", () => {
      orderService.markOrdersAsProcessed(["1", "2", "3"]);
      orderService.clearProcessedOrders();
      const processed = orderService.getProcessedOrderNumbers();

      expect(processed).toHaveLength(0);
    });
  });
});
