import { BUNDLED_PANGOSCRIPT_DATA_PATHS } from "../../src/knowledge/bundledDataPaths";

export const MCP_RESOURCE_URIS = {
  catalog: "pangoscript://catalog/commands",
  propertyCoverage: "pangoscript://catalog/property-coverage",
  schemas: "pangoscript://schemas/objects",
  diagnostics: "pangoscript://diagnostics/codes",
  operators: "pangoscript://reference/operators",
  syntax: "pangoscript://reference/syntax",
  commandReference: "pangoscript://reference/command-reference",
  masterObjectTree: "pangoscript://reference/master-object-tree",
  objectModel: "pangoscript://reference/object-model",
} as const;

export const COMMAND_REFERENCE_DIR = "docs/references/beyond/pangoscript/command-reference";

export const COMMAND_REFERENCE_META_FILES = new Set(["README.md"]);

export const MCP_BUNDLED_REFERENCE_PATHS = {
  propertyCoverage: BUNDLED_PANGOSCRIPT_DATA_PATHS.commandPropertyCoverage,
  diagnostics: "docs/references/diagnostics/README.md",
  operators: "docs/references/operators.md",
  syntax: "docs/references/syntax.md",
  masterObjectTree: "docs/references/beyond/pangoscript/master-object-tree.md",
  objectModel: "docs/references/beyond/pangoscript/object-model.md",
} as const;
