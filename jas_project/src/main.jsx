import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./styles/pages.css";
import "./styles/animations.css";
import "./styles/Sheet_modal.css";
import "./styles/Buttons.css";
import "./styles/Form.css";
import "./styles/Badge.css";
import "./styles/Empty_state.css";
import "./styles/FAB.css";
import "./styles/glass_toast.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
