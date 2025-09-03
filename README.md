# MonarchMoney Walmart Extension

A Chrome MV3 extension that extracts Walmart orders and surfaces them in a React popup.

- Built with WXT + Vite + React
- Content script parses Walmart order pages (fallback to DOM when state is unavailable)

## Status

- CI: GitHub Actions (lint, format, tests, build)
- Coverage: Codecov

## Getting Started

1. Install dependencies

```bash
npm ci
```

2. Dev (hot reload)

```bash
npm run dev
```

3. Build

```bash
npm run build
```

4. Load extension

- Chrome → chrome://extensions → Developer Mode → Load Unpacked → select `.wxt/chrome-mv3`

## Scripts

- `npm run dev` — WXT dev server with HMR
- `npm run build` — production bundle to `.wxt/`
- `npm run lint` — ESLint over `src`
- `npm run format` / `npm run check-format` — Prettier
- `npm run test` — Vitest with coverage (v8)

## Project Structure

- `src/entrypoints`
  - `background.ts` — service worker (auth check, content flow)
  - `content/index.ts` — content script for walmart.com pages
  - `popup/` — popup entry (loads React UI)
- `src/ui/popup` — React UI
- `src/shared` — constants and helpers
- `wxt.config.ts` — WXT/manifest config

## Permissions

- `storage`, `activeTab`, `scripting`
- Host: `https://www.walmart.com/*`

## Notes

- Debug logging gated by `CONFIG.DEBUG` in `src/shared/index.ts`
- Content script is defensive and will attempt multiple extraction strategies
