import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/suite/**/*.test.js",
  workspaceFolder: ".",
  mocha: {
    ui: "tdd",
    timeout: 10000,
  },
});
