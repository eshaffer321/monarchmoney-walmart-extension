import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../AuthService";

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe("checkAuth", () => {
    it("should return authenticated when response is 200 with order content", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        url: "https://www.walmart.com/orders",
        text: async () => '<meta name="pageContext" content="yourOrders"/><h1>Your Orders</h1>'
      });

      const result = await authService.checkAuth(mockFetch);

      expect(result.authenticated).toBe(true);
      expect(result.message).toBe("Authenticated");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://www.walmart.com/orders",
        expect.objectContaining({
          method: "GET",
          credentials: "include"
        })
      );
    });

    it("should return not authenticated when response contains sign-in text", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        url: "https://www.walmart.com/orders",
        text: async () =>
          "<h1>Sign in to your Walmart account</h1><input type='password' name='password'/>"
      });

      const result = await authService.checkAuth(mockFetch);

      expect(result.authenticated).toBe(false);
      expect(result.message).toBe("Not logged in to Walmart");
    });

    it("should return not authenticated for non-200 status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 401,
        text: async () => "Unauthorized"
      });

      const result = await authService.checkAuth(mockFetch);

      expect(result.authenticated).toBe(false);
      expect(result.message).toBe("HTTP 401");
    });

    it("should handle fetch errors gracefully", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await authService.checkAuth(mockFetch);

      expect(result.authenticated).toBe(false);
      expect(result.message).toBe("Network error");
    });

    it("should use custom URL and headers when provided", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => "Order history"
      });

      const customUrl = "https://walmart.com/custom-orders";
      const customHeaders = { "X-Custom": "header" };

      await authService.checkAuth(mockFetch, {
        url: customUrl,
        headers: customHeaders
      });

      expect(mockFetch).toHaveBeenCalledWith(
        customUrl,
        expect.objectContaining({
          headers: expect.objectContaining(customHeaders)
        })
      );
    });
  });

  describe("analyzeAuthStatus", () => {
    it("should detect authenticated state from pageContext meta tag", () => {
      const authenticatedContent = `
        <meta name="pageContext" content="yourOrders"/>
        <h1>Purchase History</h1>
      `;

      expect(authService.analyzeAuthStatus(authenticatedContent)).toBe(true);
    });

    it("should detect authenticated state from order page content", () => {
      const authenticatedContent = `
        <h1>Your Orders</h1>
        <div>View your order history and track packages</div>
      `;

      expect(authService.analyzeAuthStatus(authenticatedContent)).toBe(true);
    });

    it("should detect not authenticated from password input field", () => {
      const signInContent = `
        <h1>Sign in</h1>
        <input type="password" name="password" />
        <button>Sign In</button>
      `;

      expect(authService.analyzeAuthStatus(signInContent)).toBe(false);
    });

    it("should detect not authenticated from sign-in page context", () => {
      const signInContent = `
        <meta name="pageContext" content="signIn"/>
        <h1>Sign in to your Walmart account</h1>
      `;

      expect(authService.analyzeAuthStatus(signInContent)).toBe(false);
    });

    it("should default to authenticated when no clear indicators but from orders page", () => {
      const ambiguousContent = `
        <div>Welcome to Walmart</div>
        <div>Shop our products</div>
      `;

      // Changed: now defaults to true when no clear indicators (assumes successful /orders fetch means auth)
      expect(authService.analyzeAuthStatus(ambiguousContent)).toBe(true);
    });

    it("should be case insensitive for order indicators", () => {
      const upperCaseContent = "YOUR ORDERS - Purchase History";
      expect(authService.analyzeAuthStatus(upperCaseContent)).toBe(true);

      const mixedCaseSignIn = "<h1>SIGN IN to Your Account</h1>";
      expect(authService.analyzeAuthStatus(mixedCaseSignIn)).toBe(false);
    });
  });

  describe("validateAuthStatus", () => {
    it("should validate correct auth status object", () => {
      const validStatus = {
        authenticated: true,
        message: "Authenticated"
      };

      expect(authService.validateAuthStatus(validStatus)).toBe(true);
    });

    it("should reject invalid auth status objects", () => {
      expect(authService.validateAuthStatus(null)).toBe(false);
      expect(authService.validateAuthStatus(undefined)).toBe(false);
      expect(authService.validateAuthStatus("string")).toBe(false);
      expect(authService.validateAuthStatus(123)).toBe(false);
      expect(authService.validateAuthStatus({})).toBe(false);
      expect(authService.validateAuthStatus({ authenticated: "true" })).toBe(false);
      expect(authService.validateAuthStatus({ authenticated: true })).toBe(false);
      expect(authService.validateAuthStatus({ message: "test" })).toBe(false);
      expect(
        authService.validateAuthStatus({
          authenticated: true,
          message: 123
        })
      ).toBe(false);
    });
  });

  describe("constructor", () => {
    it("should use default values when not provided", () => {
      const service = new AuthService();
      // Test by calling checkAuth and verifying the URL used
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => "Orders"
      });

      service.checkAuth(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith("https://www.walmart.com/orders", expect.anything());
    });

    it("should accept custom URL and headers", () => {
      const customUrl = "https://custom.walmart.com/orders";
      const customHeaders = { "X-API-Key": "test" };

      const service = new AuthService(customUrl, customHeaders);
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => "Orders"
      });

      service.checkAuth(mockFetch);

      expect(mockFetch).toHaveBeenCalledWith(
        customUrl,
        expect.objectContaining({
          headers: expect.objectContaining(customHeaders)
        })
      );
    });
  });
});
