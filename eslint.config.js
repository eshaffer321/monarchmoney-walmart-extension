// ESLint v9 flat config
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    ignores: [
      "**/icons/**",
      "**/README.md",
      "dist/**",
      ".wxt/**",
      "node_modules/**",
      "*.config.js",
      "*.config.ts",
      "*.config.mjs",
      "coverage/**"
    ]
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
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
        FILTER_KEYWORDS: "readonly",
        React: "readonly"
      }
    },
    plugins: {
      react: reactPlugin
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error"
    },
    settings: {
      react: {
        version: "18.0"
      }
    }
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        chrome: "readonly",
        browser: "readonly",
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
        HTMLElement: "readonly",
        HTMLAnchorElement: "readonly",
        defineBackground: "readonly",
        defineContentScript: "readonly",
        CONFIG: "readonly",
        SELECTORS: "readonly",
        PATTERNS: "readonly",
        URLS: "readonly",
        HEADERS: "readonly",
        STORAGE_KEYS: "readonly",
        SYNC_STATUS: "readonly",
        MESSAGE_TYPES: "readonly",
        FILTER_KEYWORDS: "readonly",
        React: "readonly",
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react: reactPlugin
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-unused-vars": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error"
    },
    settings: {
      react: {
        version: "18.0"
      }
    }
  }
];