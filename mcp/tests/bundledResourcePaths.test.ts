import { describe, expect, it } from "vitest";
import {
  COMMAND_REFERENCE_DIR,
  COMMAND_REFERENCE_META_FILES,
  MCP_BUNDLED_REFERENCE_PATHS,
  MCP_RESOURCE_URIS,
} from "../src/bundledResourcePaths";

describe("MCP bundled resource paths", () => {
  it("names resource URIs exposed to MCP clients", () => {
    expect(MCP_RESOURCE_URIS.catalog).toBe("pangoscript://catalog/commands");
    expect(MCP_RESOURCE_URIS.propertyCoverage).toBe("pangoscript://catalog/property-coverage");
    expect(MCP_RESOURCE_URIS.commandReference).toBe("pangoscript://reference/command-reference");
  });

  it("names bundled markdown reference paths", () => {
    expect(COMMAND_REFERENCE_DIR).toBe("docs/references/beyond/pangoscript/command-reference");
    expect(COMMAND_REFERENCE_META_FILES.has("README.md")).toBe(true);
    expect(MCP_BUNDLED_REFERENCE_PATHS.diagnostics).toBe("docs/references/diagnostics/README.md");
    expect(MCP_BUNDLED_REFERENCE_PATHS.masterObjectTree).toBe(
      "docs/references/beyond/pangoscript/master-object-tree.md",
    );
  });
});
