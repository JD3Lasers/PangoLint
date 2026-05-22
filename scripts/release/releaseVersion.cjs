#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
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

function writeJson(relativePath, value) {
  writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const version = process.argv[2]?.trim();
if (!version) fail("Usage: npm run release:version -- <MAJOR.MINOR.PATCH[-prerelease]>");
if (version.startsWith("v")) fail("Pass the package version without a leading v, for example 0.2.0.");
if (!isStrictSemver(version)) fail(`Invalid semver version: ${version}`);

const extensionPackage = readJson("package.json");
const mcpPackage = readJson("mcp/package.json");
const lockfile = readJson("package-lock.json");

extensionPackage.version = version;
mcpPackage.version = version;
lockfile.version = version;
if (lockfile.packages?.[""]) lockfile.packages[""].version = version;
if (lockfile.packages?.mcp) lockfile.packages.mcp.version = version;

writeJson("package.json", extensionPackage);
writeJson("mcp/package.json", mcpPackage);
writeJson("package-lock.json", lockfile);

process.stdout.write(`Set PangoLint extension and MCP package versions to ${version}\n`);
