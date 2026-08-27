import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __IS_BETA_BUILD__: JSON.stringify(process.env.HARBOR_CHANNEL !== "stable"),
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
    proxy: {
      // Stands in for the hosted relay the web build expects.
      //
      // safeFetch sends most addon and metadata hosts to `/api-proxy/<host>/…`
      // because a browser cannot reach the ones that send no CORS header. Under
      // Tauri that rewrite is skipped and requests go out directly, so the
      // desktop and Android builds never needed the relay — but this fork no
      // longer ships one, which left `/api-proxy` answering with index.html in
      // the dev preview. Cinemeta then parsed "<!doctype html>" as JSON, and
      // anything built on it, Cinemana's title lookup included, silently
      // returned nothing.
      //
      // Forwarding the path back to the host named in it makes the preview
      // behave like the real app. Dev server only: it has no effect on any
      // build output.
      // `router` is an http-proxy option that Vite forwards but does not declare
      // in its own types, hence the cast. It is what allows one rule to serve
      // every host, since the target is only known per request.
      "/api-proxy": {
        target: "https://v3-cinemeta.strem.io",
        changeOrigin: true,
        router: (req: { url?: string }) => {
          const host = /^\/api-proxy\/([^/?#]+)/.exec(req.url ?? "")?.[1];
          return host ? `https://${host}` : "https://v3-cinemeta.strem.io";
        },
        rewrite: (path: string) => path.replace(/^\/api-proxy\/[^/?#]+/, ""),
      } as unknown as Record<string, unknown>,
    },
  },
  resolve: {
    alias: { "@": "/src" },
  },
  build: {
    // Source maps are on so a CPU profile taken on the device names real
    // functions. Without them the profiler reports minified identifiers and a
    // line number into the bundle, and those line numbers land inside the large
    // theme template literals in theme.ts — which is how one profile was nearly
    // read as blaming a MutationObserver that was not even running.
    //
    // They are emitted as separate .map files, so the APK carries them but no
    // shipped JavaScript grows. Worth turning off again once the hot paths here
    // are known.
    sourcemap: true,
    rollupOptions: {
      output: {
        // A single 3 MB entry chunk has to be parsed before anything renders,
        // which is painful on Android TV boxes and low-end phones. Splitting the
        // heavy, rarely-changing libraries out lets them cache independently and
        // keeps the startup chunk small.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("hls.js") || id.includes("mpegts.js")) return "vendor-streaming";
          if (id.includes("lottie-web")) return "vendor-lottie";
          if (
            id.includes("react-markdown") ||
            id.includes("remark") ||
            id.includes("rehype") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("unist") ||
            id.includes("unified")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
            return "vendor-react";
          }
        },
      },
    },
  },
});
