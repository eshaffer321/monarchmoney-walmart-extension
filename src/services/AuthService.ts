/**
 * AuthService - Pure business logic for authentication checking
 * This service contains no browser-specific dependencies
 */

// Type for fetch init parameter (subset of RequestInit we need)
export interface FetchInit {
  method?: string;
  credentials?: "include" | "omit" | "same-origin";
  headers?: Record<string, string>;
}

// Simple Response type for our needs
export interface FetchResponse {
  status: number;
  url: string;
  text(): Promise<string>;
}

export interface AuthStatus {
  authenticated: boolean;
  message: string;
}

export interface AuthCheckOptions {
  url?: string;
  headers?: Record<string, string>;
}

export class AuthService {
  private readonly ordersUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(
    ordersUrl = "https://www.walmart.com/orders",
    defaultHeaders: Record<string, string> = {}
  ) {
    this.ordersUrl = ordersUrl;
    this.defaultHeaders = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ...defaultHeaders
    };
  }

  /**
   * Check authentication by analyzing response from orders page
   * @param fetchFn - Function to fetch URL (allows for testing with mock)
   * @param options - Optional configuration
   */
  async checkAuth(
    fetchFn: (url: string, init?: FetchInit) => Promise<FetchResponse>,
    options: AuthCheckOptions = {}
  ): Promise<AuthStatus> {
    const url = options.url || this.ordersUrl;
    const headers = { ...this.defaultHeaders, ...(options.headers || {}) };

    console.log("[AuthService] Checking auth at:", url);

    try {
      const response = await fetchFn(url, {
        method: "GET",
        credentials: "include",
        headers
      });

      console.log("[AuthService] Response status:", response.status);
      console.log("[AuthService] Response URL:", response.url);

      if (response.status !== 200) {
        return {
          authenticated: false,
          message: `HTTP ${response.status}`
        };
      }

      const text = await response.text();
      console.log("[AuthService] Response text length:", text.length);
      console.log("[AuthService] Response preview:", text.substring(0, 500));

      const isAuthenticated = this.analyzeAuthStatus(text);
      console.log("[AuthService] Authentication result:", isAuthenticated);

      return {
        authenticated: isAuthenticated,
        message: isAuthenticated ? "Authenticated" : "Not logged in to Walmart"
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[AuthService] Error during auth check:", errorMessage);
      return {
        authenticated: false,
        message: errorMessage
      };
    }
  }

  /**
   * Analyze HTML content to determine authentication status
   * Pure function - easily testable
   */
  analyzeAuthStatus(htmlContent: string): boolean {
    console.log("[AuthService] Analyzing auth status...");

    // STRONG POSITIVE INDICATORS - These definitively mean authenticated
    // Check for pageContext meta tag first
    if (htmlContent.includes('name="pageContext" content="yourOrders"')) {
      console.log('[AuthService] Found pageContext="yourOrders" - AUTHENTICATED');
      return true;
    }

    // Check for purchase history specific content
    if (htmlContent.includes('"yourOrders"') || htmlContent.includes("'yourOrders'")) {
      console.log("[AuthService] Found yourOrders context - AUTHENTICATED");
      return true;
    }

    // Check for order-specific React/Next.js data
    if (htmlContent.includes('"orderHistory"') || htmlContent.includes('"orderList"')) {
      console.log("[AuthService] Found order data structure - AUTHENTICATED");
      return true;
    }

    // Check for order management UI elements (very specific)
    if (
      htmlContent.includes('data-testid="order-') ||
      htmlContent.includes('class="order-card"') ||
      htmlContent.includes('id="order-list"')
    ) {
      console.log("[AuthService] Found order UI elements - AUTHENTICATED");
      return true;
    }

    // STRONG NEGATIVE INDICATORS - These definitively mean NOT authenticated
    // Check for actual login form elements (not just the word "password")
    if (
      htmlContent.includes('<input type="password"') ||
      (htmlContent.includes('type="password"') && htmlContent.includes('name="password"'))
    ) {
      console.log("[AuthService] Found password input field - NOT AUTHENTICATED");
      return false;
    }

    // Check for sign-in page specific content
    if (
      htmlContent.includes("Sign in to your Walmart account") ||
      htmlContent.includes('name="pageContext" content="signIn"') ||
      htmlContent.includes('name="pageContext" content="login"')
    ) {
      console.log("[AuthService] Found sign-in page content - NOT AUTHENTICATED");
      return false;
    }

    // Check if redirected to login URL
    if (htmlContent.includes("/account/login?") || htmlContent.includes("/signin?returnUrl")) {
      console.log("[AuthService] Found login redirect URL - NOT AUTHENTICATED");
      return false;
    }

    // FALLBACK CHECKS - Less definitive
    const lowercaseContent = htmlContent.toLowerCase();

    // Check for order-related content (but be more specific)
    const orderIndicators = [
      "purchase history",
      "your orders",
      "order details",
      "track package",
      "reorder items"
    ];

    for (const indicator of orderIndicators) {
      if (lowercaseContent.includes(indicator)) {
        console.log(`[AuthService] Found order indicator: "${indicator}" - AUTHENTICATED`);
        return true;
      }
    }

    // Check for order number patterns with context
    if (htmlContent.match(/<[^>]*>.*order\s*#?\s*\d{6,}.*<\/[^>]*>/i)) {
      console.log("[AuthService] Found order number in content - AUTHENTICATED");
      return true;
    }

    // If we see "Sign in" as a prominent heading or button (not just anywhere)
    if (
      htmlContent.match(/<h[1-3][^>]*>.*Sign in.*<\/h[1-3]>/i) ||
      htmlContent.match(/<button[^>]*>.*Sign in.*<\/button>/i)
    ) {
      console.log("[AuthService] Found Sign in heading/button - NOT AUTHENTICATED");
      return false;
    }

    // Default: if we got a 200 response from /orders, assume authenticated
    // (Walmart would redirect to login if not authenticated)
    console.log(
      "[AuthService] No definitive indicators, but got 200 from /orders - assuming AUTHENTICATED"
    );
    return true;
  }

  /**
   * Validate auth status object
   */
  validateAuthStatus(status: unknown): status is AuthStatus {
    if (!status || typeof status !== "object") {
      return false;
    }

    const s = status as Record<string, unknown>;
    return typeof s.authenticated === "boolean" && typeof s.message === "string";
  }
}
