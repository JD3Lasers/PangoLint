export const BUNDLED_PANGOSCRIPT_DATA_PATHS = {
  beyondCategoryTree: "data/pangoscript/beyond-category-tree.json",
  commandsMerged: "data/pangoscript/commands.merged.json",
  commandPropertyCoverage: "data/pangoscript/command-property-coverage.json",
  knownProperties: "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  objectPropertyIndex: "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  mcpPropertyControls: "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
  mcpControlReferenceReadme: "data/pangoscript/control-reference/mcp-control-reference/README.md",
  mcpControlReferenceSummary: "data/pangoscript/control-reference/mcp-control-reference/summary.json",
  controlReferencePackagePolicy: "data/pangoscript/control-reference/package-policy.json",
} as const;

export type BundledPangoScriptDataPath =
  (typeof BUNDLED_PANGOSCRIPT_DATA_PATHS)[keyof typeof BUNDLED_PANGOSCRIPT_DATA_PATHS];

export function bundledDataPathSegments(relativePath: BundledPangoScriptDataPath | string): string[] {
  return relativePath.split("/");
}
