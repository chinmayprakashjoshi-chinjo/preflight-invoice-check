// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

const isBuild = process.argv.includes("build") || process.env.NODE_ENV === "production";

export default defineConfig({
  nitro: false,
  vite: {
    resolve: {
      alias: {
        zod: path.resolve(__dirname, "./node_modules/zod"),
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    ...(isBuild
      ? {
          define: {
            "import.meta.env.VITE_USE_MOCKS": JSON.stringify(process.env.VITE_USE_MOCKS ?? "false"),
          },
        }
      : {}),
  },
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index",
      },
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
});
