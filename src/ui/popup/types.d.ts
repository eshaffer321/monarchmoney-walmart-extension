// Type declarations for popup UI components

export interface AuthStatus {
  authenticated: boolean;
  message: string;
}

export interface SyncStatus {
  status: string;
  details?: {
    message?: string;
    orderCount?: number;
    itemCount?: number;
    extractionMode?: string;
  };
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  orderCount?: number;
  extractionMode?: string;
  data?: unknown;
  error?: string;
}

export interface StatusResponse {
  authStatus?: AuthStatus;
  syncStatus?: SyncStatus;
  lastSync?: string;
  processedOrderCount?: number;
}

declare module "./App.jsx" {
  import React from "react";
  const App: React.FC;
  export default App;
}

declare module "./main.jsx";
