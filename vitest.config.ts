import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "src/core/test-helpers.ts",
        "src/core/parse/node.ts",
        "src/core/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 40,
      },
    },
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["src/core/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "renderer",
          environment: "jsdom",
          setupFiles: ["src/renderer/test/setup.ts"],
          include: ["src/renderer/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
