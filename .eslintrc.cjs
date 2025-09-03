/* eslint-env node */
// Basic ESLint config for a MV3 extension using modern JS modules
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
        fetch: "readonly"
      }
    },
    plugins: {
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off"
    },
    ignores: [
      "**/icons/**",
      "**/README.md"
    ]
  }
];



