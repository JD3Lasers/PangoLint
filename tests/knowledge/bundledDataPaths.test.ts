import { describe, expect, it } from "vitest";
import { BUNDLED_PANGOSCRIPT_DATA_PATHS, bundledDataPathSegments } from "../../src/knowledge/bundledDataPaths";

describe("bundled PangoScript data paths", () => {
  it("names the shipped command and Object Tree runtime data files", () => {
    expect(BUNDLED_PANGOSCRIPT_DATA_PATHS.commandsMerged).toBe("data/pangoscript/commands.merged.json");
    expect(BUNDLED_PANGOSCRIPT_DATA_PATHS.knownProperties).toBe(
      "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
    );
    expect(BUNDLED_PANGOSCRIPT_DATA_PATHS.objectPropertyIndex).toBe(
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
    );
    expect(BUNDLED_PANGOSCRIPT_DATA_PATHS.mcpPropertyControls).toBe(
      "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
    );
  });

  it("converts bundled data paths into extension-relative path segments", () => {
    expect(bundledDataPathSegments(BUNDLED_PANGOSCRIPT_DATA_PATHS.commandsMerged)).toEqual([
      "data",
      "pangoscript",
      "commands.merged.json",
    ]);
  });
});
