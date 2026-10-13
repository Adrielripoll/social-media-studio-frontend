import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";

function localAuthOrigin(apiUrl: string): Plugin {
  const apiHost = new URL(apiUrl).hostname;
  const localHosts = ["localhost", "127.0.0.1"];

  return {
    name: "local-auth-origin",
    apply: "serve",
    configureServer(server) {
      if (!localHosts.includes(apiHost)) return;
      server.middlewares.use((request, response, next) => {
        if (
          !request.headers.host ||
          !["GET", "HEAD"].includes(request.method ?? "GET")
        )
          return next();
        const current = new URL(
          request.url ?? "/",
          "http://" + request.headers.host,
        );
        if (
          !localHosts.includes(current.hostname) ||
          current.hostname === apiHost
        )
          return next();
        current.hostname = apiHost;
        response.writeHead(307, {
          Location: current.href,
          "Cache-Control": "no-store",
        });
        response.end();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiUrl = env.VITE_API_URL?.trim() || "http://127.0.0.1:3001";
  return {
    plugins: [localAuthOrigin(apiUrl), react()],
    server: { port: 3003, strictPort: true },
  };
});
