import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  define: {
    // Polyfill global for amazon-cognito-identity-js (Node.js lib used in browser)
    global: "globalThis",
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React runtime
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/wouter/")
          ) {
            return "vendor-react";
          }

          // UI component libraries (Radix + utilities)
          if (
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/class-variance-authority/") ||
            id.includes("node_modules/clsx/") ||
            id.includes("node_modules/tailwind-merge/") ||
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/cmdk/") ||
            id.includes("node_modules/vaul/") ||
            id.includes("node_modules/embla-carousel") ||
            id.includes("node_modules/input-otp/") ||
            id.includes("node_modules/react-resizable-panels/") ||
            id.includes("node_modules/react-day-picker/")
          ) {
            return "vendor-ui";
          }

          // Form handling + validation
          if (
            id.includes("node_modules/react-hook-form/") ||
            id.includes("node_modules/@hookform/") ||
            id.includes("node_modules/zod/")
          ) {
            return "vendor-forms";
          }

          // Stripe payment
          if (id.includes("node_modules/@stripe/")) {
            return "vendor-stripe";
          }

          // AWS Cognito auth
          if (id.includes("node_modules/amazon-cognito-identity-js/")) {
            return "vendor-aws";
          }

          // Charts
          if (
            id.includes("node_modules/recharts/") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-vendor/")
          ) {
            return "vendor-charts";
          }

          // Data fetching
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }

          // Animation
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }

          // Firebase client SDK
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) {
            return "vendor-firebase";
          }

          // Date utilities
          if (id.includes("node_modules/date-fns/")) {
            return "vendor-date";
          }
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
