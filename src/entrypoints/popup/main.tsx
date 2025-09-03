import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../ui/popup/App.jsx";
import "../../ui/popup/App.css";

const container = document.getElementById("root")!;
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
