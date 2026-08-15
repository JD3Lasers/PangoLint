import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowDirectory = path.join(".github", "workflows");
const hostedRunnerDeclaration = /^\s*runs-on: (?:ubuntu|windows|macos)-(?:latest|\d+(?:\.\d+)?(?:-[a-z0-9]+)?)$/;

describe("GitHub-hosted workflow policy", () => {
  it("uses GitHub-hosted runners for every checked-in workflow", () => {
    for (const filename of readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name))) {
      const workflow = readFileSync(path.join(workflowDirectory, filename), "utf8");
      const runnerDeclarations = workflow.match(/^\s+runs-on:\s*.+$/gm) ?? [];

      expect(workflow).not.toContain("self-hosted");
      expect(runnerDeclarations.length).toBeGreaterThan(0);
      for (const declaration of runnerDeclarations) {
        expect(declaration).toMatch(hostedRunnerDeclaration);
      }
    }
  });

  it.each(["ubuntu-latest", "ubuntu-24.04", "windows-2025", "macos-15-intel"])(
    "accepts the GitHub-hosted %s runner label",
    (label) => expect(`runs-on: ${label}`).toMatch(hostedRunnerDeclaration),
  );

  it("keeps live BEYOND smoke local", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const runbook = readFileSync("docs/runbooks/beyond-runtime-command-runbook.md", "utf8");

    expect(existsSync(path.join(workflowDirectory, "live-beyond-smoke.yml"))).toBe(false);
    expect(packageJson).toContain('"smoke:live-beyond"');
    expect(runbook).toContain("## Operator-Supervised Local Smoke");
    expect(runbook).toContain("npm run smoke:live-beyond -- --mode all");
  });
});
