import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  build: {
    chunkSizeWarningLimit: 300,
    rolldownOptions: {
      output: {
        manualChunks(moduleId) {
          if (moduleId.includes("node_modules")) {
            if (moduleId.includes("react-dom") || moduleId.includes("react/")) return "vendor-react";
            if (moduleId.includes("framer-motion")) return "vendor-motion";
            if (moduleId.includes("@supabase")) return "vendor-supabase";
            if (moduleId.includes("lucide-react")) return "vendor-icons";
          }
          return null;
        },
      },
    },
  },
});
