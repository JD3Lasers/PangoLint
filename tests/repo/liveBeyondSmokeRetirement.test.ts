import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.join(".github", "workflows", "live-beyond-smoke.yml");

describe("retired live BEYOND smoke workflow", () => {
  it("keeps operator-supervised smoke checks available locally", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const runbook = readFileSync("docs/runbooks/beyond-runtime-command-runbook.md", "utf8");

    expect(existsSync(workflowPath)).toBe(false);
    expect(packageJson).toContain('"smoke:live-beyond"');
    expect(runbook).toContain("## Operator-Supervised Local Smoke");
    expect(runbook).toContain("npm run smoke:live-beyond -- --mode all");
  });
});
