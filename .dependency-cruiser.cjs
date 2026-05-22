module.exports = {
  forbidden: [
    {
      name: "no-circular-imports",
      severity: "error",
      comment: "Source modules should not depend on each other in cycles.",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "mcp-imports-vsix-source-through-mcp-exports",
      severity: "error",
      comment: "MCP code should use the MCP-facing VSIX source export files.",
      from: {
        path: "^mcp/src/",
      },
      to: {
        path: "^src/",
        pathNot: [
          "^src/knowledge/mcpKnowledgeExports\\.ts$",
          "^src/language/mcpLanguageExports\\.ts$",
          "^src/runtime/mcpRuntimeExports\\.ts$",
        ],
      },
    },
    {
      name: "vsix-source-does-not-import-mcp-source",
      severity: "error",
      comment: "The VSIX source must not depend on MCP server source.",
      from: {
        path: "^src/",
      },
      to: {
        path: "^mcp/src/",
      },
    },
    {
      name: "browser-code-does-not-import-node-builtins",
      severity: "error",
      comment: "Browser bundles must stay free of Node built-in modules.",
      from: {
        path: "^src/(reference/bundle|sidebar/view/webview/(bundle|objects-bundle))/",
      },
      to: {
        dependencyTypes: ["core"],
      },
    },
    {
      name: "source-does-not-import-build-output",
      severity: "error",
      comment: "Checked-in source should not import generated build output.",
      from: {
        path: "^(src|mcp/src|tests|scripts)/",
      },
      to: {
        path: "^(dist|mcp/dist|out|coverage)/",
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment: "Imports should resolve from the public checkout.",
      from: {},
      to: {
        couldNotResolve: true,
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
      dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg"],
    },
    exclude: {
      path: "^(dist|mcp/dist|out|coverage|node_modules)/",
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts", ".json"],
      mainFields: ["types", "module", "main"],
    },
  },
};
