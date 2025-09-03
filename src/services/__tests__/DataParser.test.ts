import { describe, it, expect, beforeEach } from "vitest";
import { DataParser } from "../DataParser";

describe("DataParser", () => {
  let parser: DataParser;

  beforeEach(() => {
    parser = new DataParser();
  });

  describe("parseReduxState", () => {
    it("should parse orders from Redux state", () => {
      const state = {
        orders: {
          data: [
            {
              orderNumber: "123",
              orderDate: "Jan 1, 2024",
              orderTotal: 99.99,
              items: [{ name: "Product 1", price: 49.99, quantity: 1 }]
            }
          ]
        }
      };

      const result = parser.parseReduxState(state);

      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("123");
      expect(result![0].items).toHaveLength(1);
    });

    it("should try multiple paths to find orders", () => {
      const state = {
        account: {
          orders: [{ orderNumber: "456", orderDate: "Feb 1, 2024" }]
        }
      };

      const result = parser.parseReduxState(state);

      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("456");
    });

    it("should return null when no orders found", () => {
      const state = { someOtherData: {} };
      const result = parser.parseReduxState(state);
      expect(result).toBeNull();
    });

    it("should handle invalid state gracefully", () => {
      expect(parser.parseReduxState(null as unknown as Record<string, unknown>)).toBeNull();
      expect(parser.parseReduxState(undefined as unknown as Record<string, unknown>)).toBeNull();
      expect(parser.parseReduxState({} as Record<string, unknown>)).toBeNull();
    });
  });

  describe("parseNextData", () => {
    it("should parse orders from Next.js data", () => {
      const nextData = {
        props: {
          pageProps: {
            orders: [
              {
                orderId: "789",
                date: "Mar 1, 2024",
                total: 150.0
              }
            ]
          }
        }
      };

      const result = parser.parseNextData(nextData);

      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("789");
      expect(result![0].orderDate).toBe("Mar 1, 2024");
      expect(result![0].orderTotal).toBe(150.0);
    });

    it("should handle orderHistory path", () => {
      const nextData = {
        props: {
          pageProps: {
            orderHistory: [
              {
                confirmationNumber: "CONF-456",
                purchaseDate: "Apr 1, 2024",
                paymentTotal: 200.0
              }
            ]
          }
        }
      };

      const result = parser.parseNextData(nextData);
      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("CONF-456");
      expect(result![0].orderDate).toBe("Apr 1, 2024");
      expect(result![0].orderTotal).toBe(200.0);
    });

    it("should handle nested data.orders structure", () => {
      const nextData = {
        props: {
          pageProps: {
            initialData: {
              data: {
                orders: [
                  {
                    transactionId: "TXN-789",
                    transactionDate: "May 1, 2024",
                    finalTotal: 75.5
                  }
                ]
              }
            }
          }
        }
      };

      const result = parser.parseNextData(nextData);
      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("TXN-789");
      expect(result![0].orderDate).toBe("May 1, 2024");
      expect(result![0].orderTotal).toBe(75.5);
    });

    it("should extract from object with nested orders array", () => {
      const nextData = {
        props: {
          pageProps: {
            orderList: {
              data: [
                {
                  orderIdentifier: "ORD-999",
                  submittedDate: "Jun 1, 2024",
                  totalPrice: 125.0
                }
              ]
            }
          }
        }
      };

      const result = parser.parseNextData(nextData);
      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("ORD-999");
    });

    it("should handle missing props", () => {
      const nextData = { otherData: {} };
      const result = parser.parseNextData(nextData);
      expect(result).toBeNull();
    });

    it("should filter out invalid orders", () => {
      const nextData = {
        props: {
          pageProps: {
            orders: [
              { orderNumber: "123" }, // Missing date
              { orderDate: "Jan 1, 2024" }, // Missing number
              { orderNumber: "456", orderDate: "Jan 2, 2024" } // Valid
            ]
          }
        }
      };

      const result = parser.parseNextData(nextData);
      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("456");
    });
  });

  describe("parseTextContent", () => {
    it("should extract order information from text", () => {
      const text = `
        Order #200013724127732
        Placed on January 15, 2024
        Order Total: $99.99
        Product 1 $49.99
        Product 2 $50.00
      `;

      const result = parser.parseTextContent(text);

      expect(result.orderNumber).toBe("200013724127732");
      expect(result.orderDate).toBe("January 15, 2024");
      expect(result.orderTotal).toBe(99.99);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe("Product 1");
      expect(result.items[0].price).toBe(49.99);
    });

    it("should handle text without order information", () => {
      const text = "Some random text without order data";
      const result = parser.parseTextContent(text);

      expect(result.orderNumber).toBeUndefined();
      expect(result.orderDate).toBeUndefined();
      expect(result.orderTotal).toBeUndefined();
      expect(result.items).toHaveLength(0);
    });
  });

  describe("extractOrderNumberFromText", () => {
    it("should extract order numbers", () => {
      expect(parser.extractOrderNumberFromText("Order #200013724127732")).toBe("200013724127732");
      expect(parser.extractOrderNumberFromText("Order 123456789012")).toBe("123456789012");
      expect(parser.extractOrderNumberFromText("#987654321098765")).toBe("987654321098765");
      expect(parser.extractOrderNumberFromText("no order")).toBeUndefined();
    });
  });

  describe("extractDateFromText", () => {
    it("should extract dates", () => {
      expect(parser.extractDateFromText("Jan 15, 2024")).toBe("Jan 15, 2024");
      expect(parser.extractDateFromText("Order placed December 25, 2023")).toBe(
        "December 25, 2023"
      );
      expect(parser.extractDateFromText("no date")).toBeUndefined();
    });
  });

  describe("extractTotalFromText", () => {
    it("should extract order totals", () => {
      expect(parser.extractTotalFromText("Total: $99.99")).toBe(99.99);
      expect(parser.extractTotalFromText("Order Total $1,234.56")).toBe(1234.56);
      expect(parser.extractTotalFromText("no total")).toBeUndefined();
    });
  });

  describe("extractPriceFromText", () => {
    it("should extract the largest price", () => {
      const text = "Unit price: $5.99, Total: $59.90";
      expect(parser.extractPriceFromText(text)).toBe(59.9);
    });

    it("should return 0 when no price found", () => {
      expect(parser.extractPriceFromText("no price")).toBe(0);
    });
  });

  describe("extractQuantityFromText", () => {
    it("should extract quantity from various formats", () => {
      expect(parser.extractQuantityFromText("Qty: 5")).toBe(5);
      expect(parser.extractQuantityFromText("Quantity: 3")).toBe(3);
      expect(parser.extractQuantityFromText("2 x Product")).toBe(2);
      expect(parser.extractQuantityFromText("Product (4)")).toBe(4);
    });

    it("should return 1 as default", () => {
      expect(parser.extractQuantityFromText("no quantity")).toBe(1);
    });

    it("should ignore unreasonable quantities", () => {
      expect(parser.extractQuantityFromText("Qty: 999")).toBe(1);
      expect(parser.extractQuantityFromText("Multipack Quantity: 175")).toBe(1);
    });
  });

  describe("parseElementText", () => {
    it("should parse product information from element text", () => {
      const text = "Great Product Qty 2 $19.99";
      const result = parser.parseElementText(text);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Great Product");
      expect(result!.price).toBe(19.99);
      expect(result!.quantity).toBe(2);
    });

    it("should clean up product names", () => {
      const text = "Product Name ShoppedQty 3 Was $29.99 $19.99";
      const result = parser.parseElementText(text);

      expect(result!.name).toBe("Product Name");
    });

    it("should handle multipack quantity text", () => {
      const text = "Product Multipack Quantity: 175 $99.99";
      const result = parser.parseElementText(text);

      expect(result!.name).toBe("Product");
      expect(result!.quantity).toBe(1); // Multipack quantity ignored
    });

    it("should return null for invalid text", () => {
      expect(parser.parseElementText("")).toBeNull();
      expect(parser.parseElementText("123")).toBeNull();
      expect(parser.parseElementText("ab")).toBeNull();
      expect(parser.parseElementText("short")).toBeNull();
    });

    it("should handle weight-adjusted and count info", () => {
      const text = "Bananas Weight-adjusted total Count: 6 $3.99";
      const result = parser.parseElementText(text);

      expect(result!.name).toBe("Bananas");
      expect(result!.price).toBe(3.99);
    });

    it("should normalize whitespace", () => {
      const text = "Product   Name    with   spaces  $10.00";
      const result = parser.parseElementText(text);

      expect(result!.name).toBe("Product Name with spaces");
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle nested null values in Redux state", () => {
      const state = {
        orders: {
          data: null
        }
      };
      expect(parser.parseReduxState(state)).toBeNull();
    });

    it("should skip invalid order objects", () => {
      const state = {
        orders: {
          data: [
            { invalid: "object" },
            { orderNumber: "123", orderDate: "Jan 1, 2024" },
            null,
            undefined
          ]
        }
      };

      const result = parser.parseReduxState(state);
      expect(result).toHaveLength(1);
      expect(result![0].orderNumber).toBe("123");
    });

    it("should handle various item field names", () => {
      const state = {
        orders: {
          data: [
            {
              orderId: "123",
              placedDate: "Jan 1, 2024",
              grandTotal: 99.99,
              lineItems: [{ productName: "Item 1", unitPrice: 49.99, qty: 2 }]
            }
          ]
        }
      };

      const result = parser.parseReduxState(state);
      expect(result![0].orderNumber).toBe("123");
      expect(result![0].orderDate).toBe("Jan 1, 2024");
      expect(result![0].orderTotal).toBe(99.99);
      expect(result![0].items![0].name).toBe("Item 1");
      expect(result![0].items![0].price).toBe(49.99);
      expect(result![0].items![0].quantity).toBe(2);
    });

    it("should handle alternative order number fields", () => {
      const variations = [
        { orderNum: "ON-123", orderPlacedDate: "Jul 1, 2024" },
        { purchaseOrderId: "PO-456", created: "Aug 1, 2024" },
        { transactionId: "TX-789", submittedDate: "Sep 1, 2024" },
        { confirmationNumber: "CN-012", purchaseDate: "Oct 1, 2024" }
      ];

      variations.forEach((order) => {
        const state = {
          orders: { data: [order] }
        };
        const result = parser.parseReduxState(state);
        expect(result).toHaveLength(1);
        expect(result![0].orderNumber).toBeDefined();
        expect(result![0].orderDate).toBeDefined();
      });
    });

    it("should handle alternative total amount fields", () => {
      const variations = [
        { orderNumber: "123", orderDate: "Jan 1, 2024", totalAmount: 100 },
        { orderNumber: "456", orderDate: "Jan 2, 2024", orderAmount: 200 },
        { orderNumber: "789", orderDate: "Jan 3, 2024", finalTotal: 300 },
        { orderNumber: "012", orderDate: "Jan 4, 2024", totalPrice: 400 },
        { orderNumber: "345", orderDate: "Jan 5, 2024", paymentTotal: 500 }
      ];

      variations.forEach((order) => {
        const state = {
          orders: { data: [order] }
        };
        const result = parser.parseReduxState(state);
        expect(result).toHaveLength(1);
        expect(result![0].orderTotal).toBeGreaterThan(0);
      });
    });

    it("should handle alternative item field names", () => {
      const orderWithProducts = {
        orderNumber: "123",
        orderDate: "Jan 1, 2024",
        products: [{ title: "Product 1", itemPrice: 25.0, count: 3 }]
      };

      const orderWithOrderItems = {
        orderNumber: "456",
        orderDate: "Jan 2, 2024",
        orderItems: [{ description: "Item 1", amount: 30.0 }]
      };

      [orderWithProducts, orderWithOrderItems].forEach((order) => {
        const state = { orders: { data: [order] } };
        const result = parser.parseReduxState(state);
        expect(result![0].items).toHaveLength(1);
        expect(result![0].items![0].name).toBeDefined();
      });
    });
  });
});
