import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/pages.css";
import "./styles/animations.css";
import "./styles/sheet_modal.css";
import "./styles/buttons.css";
import "./styles/form.css";
import "./styles/badge.css";
import "./styles/empty_state.css";
import "./styles/fab.css";
import "./styles/glass_toast.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for PWA offline support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // silent — SW is non-critical
    });
  });
}
