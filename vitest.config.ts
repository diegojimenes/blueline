import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
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
