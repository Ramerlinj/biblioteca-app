import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }

          if (id.includes("node_modules/firebase")) {
            return "firebase-vendor";
          }

          if (id.includes("node_modules/@radix-ui")) {
            return "radix-vendor";
          }

          if (id.includes("node_modules/recharts") || id.includes("node_modules/victory-vendor")) {
            return "charts-vendor";
          }

          if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform") || id.includes("node_modules/zod")) {
            return "forms-vendor";
          }

          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/react-icons")) {
            return "icons-vendor";
          }

          if (id.includes("node_modules/framer-motion")) {
            return "motion-vendor";
          }

          if (id.includes("node_modules/@tanstack/react-query")) {
            return "query-vendor";
          }

          if (id.includes("node_modules/wouter") || id.includes("node_modules/date-fns")) {
            return "router-date-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  preview: {
    port: 3000,
    host: "0.0.0.0",
  },
});
