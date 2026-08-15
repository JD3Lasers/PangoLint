import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowDirectory = path.join(".github", "workflows");
const githubHostedRunnerLabels = new Set([
  "macos-14",
  "macos-15",
  "macos-15-intel",
  "macos-26",
  "macos-26-intel",
  "macos-latest",
  "ubuntu-22.04",
  "ubuntu-22.04-arm",
  "ubuntu-24.04",
  "ubuntu-24.04-arm",
  "ubuntu-26.04",
  "ubuntu-26.04-arm",
  "ubuntu-latest",
  "ubuntu-slim",
  "windows-11-arm",
  "windows-11-vs2026-arm",
  "windows-2022",
  "windows-2025",
  "windows-2025-vs2026",
  "windows-latest",
  "xcode-27",
]);

describe("GitHub-hosted workflow policy", () => {
  it("uses GitHub-hosted runners for every checked-in workflow", () => {
    for (const filename of readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name))) {
      const workflow = readFileSync(path.join(workflowDirectory, filename), "utf8");
      const runnerDeclarations = workflow.match(/^\s+runs-on:\s*.+$/gm) ?? [];

      expect(workflow).not.toContain("self-hosted");
      expect(runnerDeclarations.length).toBeGreaterThan(0);
      for (const declaration of runnerDeclarations) {
        const label = declaration.slice(declaration.indexOf(":") + 1).trim();
        expect(githubHostedRunnerLabels.has(label), `${filename}: unsupported runner label ${label}`).toBe(true);
      }
    }
  });

  it("accepts pinned hosted labels and rejects hosted-looking custom labels", () => {
    expect(githubHostedRunnerLabels.has("ubuntu-24.04")).toBe(true);
    expect(githubHostedRunnerLabels.has("windows-2025")).toBe(true);
    expect(githubHostedRunnerLabels.has("macos-15-intel")).toBe(true);
    expect(githubHostedRunnerLabels.has("ubuntu-0")).toBe(false);
    expect(githubHostedRunnerLabels.has("windows-9999-custom")).toBe(false);
  });

  it("keeps live BEYOND smoke local", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const runbook = readFileSync("docs/runbooks/beyond-runtime-command-runbook.md", "utf8");

    expect(existsSync(path.join(workflowDirectory, "live-beyond-smoke.yml"))).toBe(false);
    expect(packageJson).toContain('"smoke:live-beyond"');
    expect(runbook).toContain("## Operator-Supervised Local Smoke");
    expect(runbook).toContain("npm run smoke:live-beyond -- --mode all");
  });
});
