import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/main.ts" },
  format: ["cjs"],
  target: "node20",
  outDir: "dist",
  clean: true,
  noExternal: ["@actions/core", "@aws-sdk/client-ecr"],
  splitting: false,
  sourcemap: false,
  minify: false,
});
