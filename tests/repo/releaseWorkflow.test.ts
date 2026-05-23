import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const { compareVersions } = require("../../scripts/release/checkPrVersionBump.cjs") as {
  compareVersions: (left: string, right: string) => number;
};
const { isStrictSemver } = require("../../scripts/release/releaseSemver.cjs") as {
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

  it("enforces PR version bumps in hosted CI", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const versionPolicyJob = workflowJobSection(workflow, "version-policy");

    expect(versionPolicyJob).toContain("name: Version policy");
    expect(versionPolicyJob).toContain("if: github.event_name == 'pull_request'");
    expect(versionPolicyJob).toContain("fetch-depth: 0");
    expect(versionPolicyJob).toContain("npm run check:pr-version");
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
    expect(workflow).toContain("uses: actions/upload-artifact@v6");
    expect(workflow).toContain("uses: actions/download-artifact@v7");
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
    expect(buildJob).toContain("uses: actions/upload-artifact@v6");
    expect(buildJob).not.toContain("contents: write");
    expect(buildJob).not.toContain("GH_REPO");
    expect(buildJob).not.toContain("gh release");

    expect(publishJob).toContain("needs: build-release-artifacts");
    expect(publishJob).toContain("permissions:\n      contents: write");
    expect(publishJob).toContain("uses: actions/download-artifact@v7");
    expect(publishJob).toContain(githubRepoEnv);
    expect(publishJob).toContain(githubTokenEnv);
    expect(publishJob).toContain("gh release create");
    expect(publishJob).not.toContain("actions/checkout");
    expect(publishJob).not.toContain("npm ci");
    expect(publishJob).not.toContain("npm run");
  });

  it("keeps release artifact actions on Node 24 runtime majors", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).not.toMatch(/uses:\s*actions\/upload-artifact@v[1-5]\b/);
    expect(workflow).not.toMatch(/uses:\s*actions\/download-artifact@v[1-6]\b/);
  });

  it("keeps npm OIDC publishing isolated from release-tag verification scripts", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "npm-publish.yml"), "utf8");
    const buildJob = workflowJobSection(workflow, "build-mcp-package");
    const publishJob = workflowJobSection(workflow, "publish-mcp");

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).not.toContain("permissions:\n  contents: read\n  id-token: write");

    expect(buildJob).toContain("uses: actions/checkout@v6");
    expect(buildJob).toContain("persist-credentials: false");
    expect(buildJob).toContain("npm ci --ignore-scripts");
    expect(buildJob).toContain("npm run check:mcp");
    expect(buildJob).toContain("uses: actions/upload-artifact@v6");
    expect(buildJob).not.toContain("id-token: write");

    expect(publishJob).toContain("needs: build-mcp-package");
    expect(publishJob).toContain("permissions:\n      contents: read\n      id-token: write");
    expect(publishJob).toContain("environment:\n      name: npm-publish");
    expect(publishJob).toContain("uses: actions/download-artifact@v7");
    expect(publishJob).toContain('npm publish "./release-assets/pangolint-mcp-$RELEASE_VERSION.tgz" --provenance');
    expect(publishJob).not.toContain("actions/checkout");
    expect(publishJob).not.toContain("npm ci");
    expect(publishJob).not.toContain("npm run");
  });

  it("publishes Marketplace VSIX assets from a clean pinned tool context", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "marketplace-publish.yml"), "utf8");
    const publishJob = workflowJobSection(workflow, "publish-vsix");
    const vscePatEnv = ["VSCE_PAT: $", "{{ secrets.VSCE_PAT }}"].join("");

    expect(publishJob).toContain("environment:\n      name: marketplace-publish");
    expect(publishJob).toContain("gh release download");
    expect(publishJob).toContain(githubRepoEnv);
    expect(publishJob).toContain('grep "pangolint-$RELEASE_VERSION.vsix$" SHA256SUMS');
    expect(publishJob).toContain('npm_config_ignore_scripts: "true"');
    expect(publishJob).toContain("npx --yes @vscode/vsce@3.9.1 show");
    expect(publishJob).toContain("npx --yes @vscode/vsce@3.9.1 publish");
    expect(publishJob).toContain(vscePatEnv);
    expect(publishJob).not.toContain("actions/checkout");
    expect(publishJob).not.toContain("npm ci");
  });

  it("exposes a real MCP tarball packaging script for releases", () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["package:mcp"]).toContain("npm --workspace mcp run package:tarball");
    expect(packageJson.scripts?.["check:release"]).toBe("npm run check:public && npm run check:mcp");
    expect(packageJson.scripts?.["release:version"]).toContain("scripts/release/releaseVersion.cjs");
    expect(packageJson.scripts?.["release:preflight"]).toContain("scripts/release/checkReleasePreflight.cjs");
    expect(packageJson.scripts?.["check:pr-version"]).toContain("scripts/release/checkPrVersionBump.cjs");
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

  it("compares SemVer versions for PR version policy", () => {
    expect(compareVersions("0.4.3", "0.4.2")).toBeGreaterThan(0);
    expect(compareVersions("0.5.0", "0.4.9")).toBeGreaterThan(0);
    expect(compareVersions("0.4.3-alpha.2", "0.4.3-alpha.1")).toBeGreaterThan(0);
    expect(compareVersions("0.4.3-alpha-2", "0.4.3-alpha-1")).toBeGreaterThan(0);
    expect(compareVersions("0.4.3", "0.4.3-alpha.1")).toBeGreaterThan(0);
    expect(compareVersions("0.4.3-alpha.1", "0.4.3")).toBeLessThan(0);
    expect(compareVersions("0.4.3", "0.4.3")).toBe(0);
  });

  it("documents version selection before release packaging", () => {
    const policy = readFileSync(path.join(repoRoot, "docs", "runbooks", "versioning-policy.md"), "utf8");
    const checklist = readFileSync(path.join(repoRoot, "docs", "runbooks", "release-checklist.md"), "utf8");

    expect(policy).toContain("0.MINOR.PATCH");
    expect(policy).toContain("PATCH");
    expect(policy).toContain("MINOR");
    expect(policy).toContain("prerelease");
    expect(policy).toContain("lockstep");
    expect(policy).toContain("Every PR into `main` must advance");
    expect(policy).toContain("Version policy");
    expect(checklist).toContain("Version selection policy");
    expect(checklist).toContain("npm run release:preflight");
  });

  it("keeps PR version policy visible in the pull request template", () => {
    const template = readFileSync(path.join(repoRoot, ".github", "pull_request_template.md"), "utf8");

    expect(template).toContain("npm run release:version");
    expect(template).toContain("CHANGELOG.md");
    expect(template).toContain("docs/runbooks/versioning-policy.md");
  });

  it("keeps local release artifact staging out of git", () => {
    const gitignore = readFileSync(path.join(repoRoot, ".gitignore"), "utf8");
    const vscodeignore = readFileSync(path.join(repoRoot, ".vscodeignore"), "utf8");

    expect(gitignore).toContain("artifacts/");
    expect(gitignore).toContain(".playwright-mcp/");
    expect(vscodeignore).toContain("artifacts/**");
    expect(vscodeignore).toContain(".playwright-mcp/**");
  });
});
