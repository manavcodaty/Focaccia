import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      exclude: [
        "src/components/crowd-canvas.tsx",
        "src/components/animated-demos.tsx",
        "src/components/reveal.tsx",
        "src/components/spotlight-card.tsx",
        "src/components/hero.tsx",
        "src/test/**",
        "**/*.test.tsx"
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
