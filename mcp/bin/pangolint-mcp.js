#!/usr/bin/env node
// Launcher for the pangolint-mcp stdio server. The real entry lives in
// dist/server.js (built via `npm run compile` in the mcp workspace).
import("../dist/server.js")
  .then((mod) => {
    return mod.startServer();
  })
  .catch((err) => {
    process.stderr.write(
      `pangolint-mcp launcher fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  });
