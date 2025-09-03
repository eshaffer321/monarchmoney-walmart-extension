// Content script specific constants - patterns and selectors for DOM extraction
// These are separated from the main constants to be imported by content scripts

// Debug mode - imported from main constants
export const CONFIG = {
  DEBUG: true, // Set to false to disable debug logging
  API_TIMEOUT: 30000,
  CONTENT_SCRIPT_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  PAGE_LOAD_WAIT: 2000,
  ITEMS_PROCESS_LIMIT: 10 // Max items to process in detail mode
};

// DOM Selectors for item extraction
export const SELECTORS = {
  ITEM_CONTAINERS: [
    '[data-testid*="item"]',
    '[data-testid*="product"]',
    '[class*="LineItem"]',
    '[class*="line-item"]',
    '[class*="product-item"]',
    '[class*="order-item"]',
    'div[class*="item"][class*="container"]',
    'div[class*="product"][class*="row"]',
    // Walmart specific selectors
    'div[data-automation-id*="product"]',
    'div[data-automation-id*="item"]',
    "[data-item-id]",
    'article[class*="product"]',
    'div[class*="OrderItem"]',
    'div[class*="fulfillment-group"] div[class*="item"]',
    // Generic but might work
    'div[role="article"]',
    'section[class*="item"] > div'
  ],

  PRODUCT_NAME: [
    '[class*="product-name"]',
    '[class*="item-name"]',
    '[class*="title"]',
    "h3",
    "h4",
    'a[href*="/ip/"]'
  ],

  PRODUCT_LINK: 'a[href*="/ip/"]',

  ORDER_DATA_ATTRIBUTES: ["[data-order-id]", "[data-order-number]"],

  REACT_ROOT: ["#__next", "#root", "[data-reactroot]"]
};

// Regular expressions for parsing
export const PATTERNS = {
  // Price patterns
  PRICE: /\$\s*([\d,]+\.?\d{2})/g,
  PRICE_CENTS: /[\d.]+¢\/[a-z\s]+/i,

  // Quantity patterns
  QUANTITY: /(?:Qty|Quantity)[\s:]*(\d+)/i,
  QUANTITY_X: /^\s*(\d+)\s*x\s+/i,
  QUANTITY_PARENS: /\(\s*(\d+)\s*\)$/,

  // Date patterns
  DATE: /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,

  // Order patterns
  ORDER_NUMBER: /(?:Order\s*#?|#)\s*([\d-]+)/i,
  ORDER_TOTAL: /(?:Total|Order Total)\s*\$\s*([\d,]+\.?\d{2})/i,

  // Text to remove from product names
  CLEANUP: {
    SHOPPED_QTY: /\s*(Shopped)?Qty\s+\d+.*$/i,
    MULTIPACK: /Multipack Quantity:.*$/gi,
    PRICE_END: /\$[\d.,]+.*$/i,
    CENTS_UNIT: /[\d.]+¢\/[a-z\s]+.*$/i,
    WEIGHT_ADJUSTED: /Weight-adjusted.*$/i,
    COUNT_INFO: /Count:.*$/i,
    WAS_PRICE: /Was\s+\$[\d.,]+/gi
  }
};

// Non-product text to filter out
export const FILTER_KEYWORDS = ["ReorderListsRegistries", "Lists & Registries"];