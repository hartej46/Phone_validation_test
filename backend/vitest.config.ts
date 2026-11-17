import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      angelos: path.resolve(__dirname, "node_modules/angelos/dist/index.mjs"),
    },
  },
});
