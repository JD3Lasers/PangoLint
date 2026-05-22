#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { normalizeVersionInput } = require("./releaseSemver.cjs");

const root = path.resolve(__dirname, "..", "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const args = process.argv.slice(2);
const skipGithub = args.includes("--skip-github");
const requestedVersion = args.find((arg) => !arg.startsWith("--"));

const extensionPackage = readJson("package.json");
const mcpPackage = readJson("mcp/package.json");
const lockfile = readJson("package-lock.json");
const version = normalizeVersionInput(requestedVersion ?? extensionPackage.version, { allowLeadingV: true }) ?? "";
const tag = `v${version}`;

if (!version) fail(`Invalid package version: ${requestedVersion ?? extensionPackage.version ?? ""}`);
if (extensionPackage.version !== version) {
  fail(`package.json version ${extensionPackage.version} does not match requested version ${version}`);
}
if (mcpPackage.version !== version) {
  fail(`mcp/package.json version ${mcpPackage.version} does not match package.json version ${version}`);
}
if (
  lockfile.version !== version ||
  lockfile.packages?.[""]?.version !== version ||
  lockfile.packages?.mcp?.version !== version
) {
  fail(`package-lock.json does not match package version ${version}`);
}

const changelog = readText("CHANGELOG.md");
if (!changelog.includes(`## [${version}]`)) {
  fail(`CHANGELOG.md is missing a ## [${version}] release heading`);
}
if (!changelog.includes(`[Unreleased]: https://github.com/JD3Lasers/PangoLint/compare/${tag}...HEAD`)) {
  fail(`CHANGELOG.md Unreleased comparison link must start at ${tag}`);
}

const status = run("git", ["status", "--porcelain"]).trim();
if (status && process.env.PANGOLINT_RELEASE_PREFLIGHT_ALLOW_DIRTY !== "1") {
  fail("Working tree is not clean. Commit the version/changelog changes before release packaging.");
}

if (!skipGithub) {
  try {
    const releaseJson = run("gh", ["release", "view", tag, "--json", "isDraft"]);
    const release = JSON.parse(releaseJson);
    if (release.isDraft !== true) {
      fail(`Refusing to clobber published release ${tag}. Bump the version instead.`);
    }
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (!stderr.includes("release not found") && !stderr.includes("Not Found")) {
      fail(`Unable to inspect GitHub Release ${tag}: ${stderr.trim() || error.message}`);
    }
  }
}

process.stdout.write(`Release preflight passed for ${tag}\n`);
