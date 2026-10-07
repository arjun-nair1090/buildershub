import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      port: 5173,
      host: true, // reachable from a phone on the same Wi-Fi, for QR scanning
      proxy: { "/api": env.VITE_API_PROXY_TARGET || "http://localhost:8010" },
    },
  };
});
