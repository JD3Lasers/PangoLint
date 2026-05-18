import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const { isStrictSemver } = require("../../scripts/releaseSemver.cjs") as {
  isStrictSemver: (version: string) => boolean;
};
const githubRepoEnv = "GH_REPO: $" + "{{ github.repository }}";
const githubTokenEnv = "GH_TOKEN: $" + "{{ github.token }}";

function workflowJobSection(workflow: string, jobName: string): string {
  const marker = `\n  ${jobName}:\n`;
  const start = workflow.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);

  const bodyStart = start + marker.length;
  const nextJob = workflow.slice(bodyStart).search(/\n {2}[A-Za-z0-9_-]+:\n/);
  const end = nextJob >= 0 ? bodyStart + nextJob : workflow.length;
  return workflow.slice(start, end);
}

describe("release workflow", () => {
  const workflowDispatchTagEnv =
    "RELEASE_TAG: $" + "{{ github.event_name == 'workflow_dispatch' && inputs.tag || github.ref_name }}";

  it("runs MCP package verification in hosted CI", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

    expect(workflow).toContain("npm run check:mcp");
  });

  it("defines a GitHub Release artifact workflow without registry publishing", () => {
    const workflowPath = path.join(repoRoot, ".github", "workflows", "release.yml");
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain("v*");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("contents: write");
    expect(workflow.indexOf("contents: write")).toBeGreaterThan(workflow.indexOf("github-release:"));
    expect(workflow).toContain(workflowDispatchTagEnv);
    expect(workflow).toContain('[[ ! "$tag" =~ ^v[0-9]+\\.[0-9]+\\.[0-9]+');
    expect(workflow).not.toContain('tag="${{ github.event_name');
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("npm run check:public && npm run check:mcp");
    expect(workflow).toContain("npm run release:preflight");
    expect(workflow).not.toContain("npm run check:release");
    expect(workflow).not.toContain("npm run check\n");
    expect(workflow).toContain("npm run package:vsix");
    expect(workflow).toContain("npm run package:mcp");
    expect(workflow).toContain("npx vsce ls --no-dependencies");
    expect(workflow).toContain("npm --workspace mcp run verify:tarball");
    expect(workflow).toContain("npm pack --workspace mcp --dry-run --json > release-mcp-tarball.json");
    expect(workflow).toContain("SHA256SUMS");
    expect(workflow).toContain("uses: actions/upload-artifact@v4");
    expect(workflow).toContain("uses: actions/download-artifact@v4");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain('gh release view "$RELEASE_TAG"');
    expect(workflow).toContain('gh release upload "$RELEASE_TAG" release-artifacts/* --clobber');
    expect(workflow).toContain('gh release edit "$RELEASE_TAG"');
    expect(workflow).toContain("Refusing to clobber published release");
    expect(workflow).toContain("--draft");
    expect(workflow).toContain("require('./mcp/package.json').version");
    expect(workflow).not.toContain("npm publish");
    expect(workflow).not.toContain("vsce publish");
  });

  it("isolates GitHub Release write permissions from build scripts", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");
    const buildJob = workflowJobSection(workflow, "build-release-artifacts");
    const publishJob = workflowJobSection(workflow, "github-release");

    expect(buildJob).toContain("permissions:\n      contents: read");
    expect(buildJob).toContain("persist-credentials: false");
    expect(buildJob).toContain("npm ci");
    expect(buildJob).toContain("npm run release:preflight");
    expect(buildJob).toContain("npm run check:public && npm run check:mcp");
    expect(buildJob).toContain("uses: actions/upload-artifact@v4");
    expect(buildJob).not.toContain("contents: write");
    expect(buildJob).not.toContain("GH_REPO");
    expect(buildJob).not.toContain("gh release");

    expect(publishJob).toContain("needs: build-release-artifacts");
    expect(publishJob).toContain("permissions:\n      contents: write");
    expect(publishJob).toContain("uses: actions/download-artifact@v4");
    expect(publishJob).toContain(githubRepoEnv);
    expect(publishJob).toContain(githubTokenEnv);
    expect(publishJob).toContain("gh release create");
    expect(publishJob).not.toContain("actions/checkout");
    expect(publishJob).not.toContain("npm ci");
    expect(publishJob).not.toContain("npm run");
  });

  it("exposes a real MCP tarball packaging script for releases", () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["package:mcp"]).toContain("npm --workspace mcp run package:tarball");
    expect(packageJson.scripts?.["check:release"]).toBe("npm run check:public && npm run check:mcp");
    expect(packageJson.scripts?.["release:version"]).toContain("scripts/releaseVersion.cjs");
    expect(packageJson.scripts?.["release:preflight"]).toContain("scripts/checkReleasePreflight.cjs");
  });

  it("keeps the extension and standalone MCP artifact versions in lockstep", () => {
    const extensionPackage = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      version?: string;
    };
    const mcpPackage = JSON.parse(readFileSync(path.join(repoRoot, "mcp", "package.json"), "utf8")) as {
      version?: string;
    };

    expect(mcpPackage.version).toBe(extensionPackage.version);
  });

  it("validates release versions with strict SemVer", () => {
    const valid = ["0.2.0", "1.0.0", "0.2.0-alpha.1", "0.2.0-rc.1+build.2", "1.2.3+build.5"];
    const invalid = [
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "1.2.3-alpha..1",
      "1.2.3-alpha.",
      "1.2.3-01",
      "1.2.3+",
      "v1.2.3",
      "1.2",
      "1.2.3-",
    ];

    for (const version of valid) expect(isStrictSemver(version), version).toBe(true);
    for (const version of invalid) expect(isStrictSemver(version), version).toBe(false);
  });

  it("documents version selection before release packaging", () => {
    const policy = readFileSync(path.join(repoRoot, "docs", "runbooks", "versioning-policy.md"), "utf8");
    const checklist = readFileSync(path.join(repoRoot, "docs", "runbooks", "release-checklist.md"), "utf8");

    expect(policy).toContain("0.MINOR.PATCH");
    expect(policy).toContain("PATCH");
    expect(policy).toContain("MINOR");
    expect(policy).toContain("prerelease");
    expect(policy).toContain("lockstep");
    expect(checklist).toContain("Version selection policy");
    expect(checklist).toContain("npm run release:preflight");
  });

  it("keeps local release artifact staging out of git", () => {
    const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
    const vscodeignore = readFileSync(path.join(repoRoot, ".vscodeignore"), "utf8");

    expect(gitignore).toContain("artifacts/");
    expect(vscodeignore).toContain("artifacts/**");
  });
});
