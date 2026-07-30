import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./Styles/Pages.css";
import "./Styles/Animations.css";
import "./Styles/Sheet_modal.css";
import "./Styles/Buttons.css";
import "./Styles/Form.css";
import "./Styles/Badge.css";
import "./Styles/Empty_state.css";
import "./Styles/Fab.css";
import "./Styles/Glass_toast.css";

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
