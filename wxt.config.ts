import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  outDir: ".wxt",
  manifest: {
    name: "Walmart Monarch Sync",
    version: "0.1.0",
    description: "Sync Walmart orders to Monarch Money",
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: ["https://www.walmart.com/*"],
    action: {
      default_popup: "popup.html"
    }
  },
  runner: {
    startUrls: ["https://www.walmart.com/orders"]
  }
});
