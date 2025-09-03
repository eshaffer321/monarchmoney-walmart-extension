// ESLint v9 flat config
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        chrome: "readonly",
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        alert: "readonly",
        confirm: "readonly",
        URL: "readonly",
        CONFIG: "readonly",
        SELECTORS: "readonly",
        PATTERNS: "readonly",
        URLS: "readonly",
        HEADERS: "readonly",
        STORAGE_KEYS: "readonly",
        SYNC_STATUS: "readonly",
        MESSAGE_TYPES: "readonly",
        FILTER_KEYWORDS: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off"
    },
    ignores: ["**/icons/**", "**/README.md"]
  }
];

