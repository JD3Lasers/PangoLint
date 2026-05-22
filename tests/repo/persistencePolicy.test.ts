import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import {
  EXTENSION_CONFIG_SECTIONS,
  EXTENSION_OUTPUT_CHANNELS,
  EXTENSION_WORKSPACE_STATE_KEYS,
} from "../../src/extensionHost/extensionIds";

const repoRoot = process.cwd();

describe("persistence policy", () => {
  it("names the VS Code settings and workspace state locations used by the extension host", () => {
    expect(EXTENSION_CONFIG_SECTIONS.pangolint).toBe("pangolint");
    expect(EXTENSION_CONFIG_SECTIONS.beyond).toBe("pangolint.beyond");
    expect(EXTENSION_WORKSPACE_STATE_KEYS.watchedPaths).toBe("pangolint.watchedPaths");
    expect(EXTENSION_OUTPUT_CHANNELS.run).toBe("PangoLint: Run");
    expect(EXTENSION_OUTPUT_CHANNELS.validation).toBe("PangoLint: Validation");
  });

  it("keeps user object persistence in the workspace registry file", () => {
    const source = readFileSync(path.join(repoRoot, "src", "workspace", "userObjects.ts"), "utf8");

    expect(source).toContain('path.join(workspaceFolder, ".pangolint", "user-objects.json")');
    expect(source).toContain("must stay inside the workspace");
  });

  it("does not add browser storage persistence to packaged webview bundles", () => {
    for (const relativePath of [
      "src/sidebar/view/webview/bundle/main.ts",
      "src/sidebar/view/webview/objects-bundle/main.ts",
      "src/reference/bundle/router.ts",
    ]) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(source, relativePath).not.toMatch(/\b(?:localStorage|sessionStorage)\b/);
    }
  });
});
