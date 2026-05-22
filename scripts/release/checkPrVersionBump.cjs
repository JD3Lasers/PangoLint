#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { isStrictSemver } = require("./releaseSemver.cjs");

const root = path.resolve(__dirname, "..", "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function gitShow(ref, relativePath) {
  return execFileSync("git", ["show", `${ref}:${relativePath}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitHasTag(tag) {
  try {
    execFileSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function parseVersion(version) {
  const buildStart = version.indexOf("+");
  const mainAndPrerelease = buildStart === -1 ? version : version.slice(0, buildStart);
  const prereleaseStart = mainAndPrerelease.indexOf("-");
  const main = prereleaseStart === -1 ? mainAndPrerelease : mainAndPrerelease.slice(0, prereleaseStart);
  const prerelease = prereleaseStart === -1 ? undefined : mainAndPrerelease.slice(prereleaseStart + 1);
  const [major, minor, patch] = main.split(".").map((part) => Number.parseInt(part, 10));
  return {
    major,
    minor,
    patch,
    prerelease: prerelease ? prerelease.split(".") : [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number.parseInt(leftPart, 10) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number.parseInt(rightPart, 10) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

function compareVersions(leftVersion, rightVersion) {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function readCurrentVersions() {
  const rootPackage = readJson("package.json");
  const mcpPackage = readJson("mcp/package.json");
  const lockfile = readJson("package-lock.json");
  return {
    root: rootPackage.version,
    mcp: mcpPackage.version,
    lockfile: lockfile.version,
    lockfileRoot: lockfile.packages?.[""]?.version,
    lockfileMcp: lockfile.packages?.mcp?.version,
  };
}

function assertLockstep(versions) {
  const entries = Object.entries(versions).filter(([, value]) => value !== undefined);
  const mismatched = entries.filter(([, value]) => value !== versions.root);
  if (mismatched.length > 0) {
    fail(
      `Package versions must stay in lockstep. package.json is ${versions.root}; mismatches: ${mismatched
        .map(([name, value]) => `${name}=${value}`)
        .join(", ")}`,
    );
  }
  if (!isStrictSemver(versions.root)) {
    fail(`package.json version is not strict SemVer: ${versions.root}`);
  }
}

function main() {
  const baseRef =
    process.argv[2] ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
  const versions = readCurrentVersions();
  assertLockstep(versions);

  const basePackage = JSON.parse(gitShow(baseRef, "package.json"));
  const baseVersion = basePackage.version;
  if (!isStrictSemver(baseVersion)) {
    fail(`${baseRef}:package.json version is not strict SemVer: ${baseVersion}`);
  }
  if (compareVersions(versions.root, baseVersion) <= 0) {
    fail(`PR version must be greater than ${baseRef}. Current ${versions.root}; base ${baseVersion}.`);
  }

  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const baseChangelog = gitShow(baseRef, "CHANGELOG.md");
  if (changelog === baseChangelog) {
    fail("CHANGELOG.md must change when a PR bumps the package version.");
  }
  if (!changelog.includes(`## [${versions.root}] - `)) {
    fail(`CHANGELOG.md must include a heading for ${versions.root}.`);
  }
  if (gitHasTag(`v${versions.root}`)) {
    fail(`Version ${versions.root} already has a local tag. Choose a new version.`);
  }

  process.stdout.write(`PR version policy passed: ${baseVersion} -> ${versions.root}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  compareVersions,
};
