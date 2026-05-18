#!/usr/bin/env node
// Copies the data + docs + license files the MCP server needs into mcp/ so that
// `npm pack` from the mcp/ workspace produces a self-contained tarball.
// Both consumers keep reading from the tracked data and docs paths in dev;
// this script just mirrors them under
// mcp/ for the published artifact.
//
// Run via: `npm --workspace mcp run copy:assets`, or directly:
//   node scripts/copyMcpData.cjs

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const mcpRoot = path.join(repoRoot, "mcp");
const forbiddenMcpAssetPathPatterns = [
  ["local probe directory", /(^|\/)probes?(?:\/|$)/i],
  ["local probe file", /(^|\/)probe-[^/]*$/i],
  ["maintainer-only evidence directory", /(^|\/)maintainer[-_]evidence(?:\/|$)/i],
];

const forbiddenMcpDataPrefixes = [
  ["Object Tree source facts", "data/pangoscript/object-tree/source-facts/"],
  ["Object Tree evidence", "data/pangoscript/object-tree/evidence/"],
  ["Object Tree audit output", "data/pangoscript/object-tree/audits/"],
  ["Object Tree package projection", "data/pangoscript/object-tree/package-projections/"],
];

const FILES = [
  "LICENSE",
  "data/pangoscript/commands.merged.json",
  "data/pangoscript/command-property-coverage.json",
  "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  "data/pangoscript/control-reference/README.md",
  "data/pangoscript/control-reference/package-policy.json",
  "docs/references/diagnostics/README.md",
  "docs/references/operators.md",
  "docs/references/syntax.md",
  "docs/references/beyond/pangoscript/master-object-tree.md",
  "docs/references/beyond/pangoscript/object-model.md",
];

const DIRECTORIES = [
  "data/pangoscript/control-reference/mcp-control-reference",
  "docs/references/beyond/pangoscript/command-reference",
];

const allowedMcpDataPaths = new Set([
  "data/pangoscript/commands.merged.json",
  "data/pangoscript/command-property-coverage.json",
  "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
  "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
  "data/pangoscript/control-reference/README.md",
  "data/pangoscript/control-reference/package-policy.json",
  "data/pangoscript/control-reference/mcp-control-reference/README.md",
  "data/pangoscript/control-reference/mcp-control-reference/property-controls.json",
  "data/pangoscript/control-reference/mcp-control-reference/summary.json",
]);

const allowedMcpDataDirectoryPrefixes = ["data/pangoscript/control-reference/mcp-control-reference/"];

function isAllowedMcpDataPath(rel) {
  if (!rel.startsWith("data/")) return true;
  if (allowedMcpDataPaths.has(rel)) return true;
  return allowedMcpDataDirectoryPrefixes.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix));
}

function assertApprovedMcpAssetPath(rel) {
  for (const [label, pattern] of forbiddenMcpAssetPathPatterns) {
    const match = pattern.exec(rel);
    if (match?.[0]) {
      process.stderr.write(`copyMcpData: refused maintainer-only asset path: ${rel} (${label})\n`);
      process.exit(1);
    }
  }
  for (const [label, prefix] of forbiddenMcpDataPrefixes) {
    if (rel === prefix.slice(0, -1) || rel.startsWith(prefix)) {
      process.stderr.write(`copyMcpData: refused maintainer-only asset path: ${rel} (${label})\n`);
      process.exit(1);
    }
  }
  if (!isAllowedMcpDataPath(rel)) {
    process.stderr.write(`copyMcpData: refused unapproved MCP data path: ${rel}\n`);
    process.exit(1);
  }
}

function copiedAssetFiles(directoryPath, relRoot) {
  if (!fs.existsSync(directoryPath)) return [];
  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);
    const entryRel = `${relRoot}/${entry.name}`;
    if (entry.isDirectory()) return copiedAssetFiles(entryPath, entryRel);
    return entry.isFile() ? [entryRel] : [];
  });
}

function removeGeneratedPath(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    return;
  } catch (error) {
    if (!["EPERM", "ENOTEMPTY"].includes(error?.code)) throw error;
  }

  if (!fs.existsSync(target)) return;
  if (!fs.lstatSync(target).isDirectory()) {
    fs.rmSync(target, { force: true, maxRetries: 10, retryDelay: 100 });
    return;
  }

  for (const entry of fs.readdirSync(target)) {
    removeGeneratedPath(path.join(target, entry));
  }
}

for (const rel of ["data", "docs"]) {
  removeGeneratedPath(path.join(mcpRoot, rel));
}

let copied = 0;
for (const rel of FILES) {
  assertApprovedMcpAssetPath(rel);
  const source = path.join(repoRoot, rel);
  const dest = path.join(mcpRoot, rel);
  if (!fs.existsSync(source)) {
    process.stderr.write(`copyMcpData: source missing: ${rel}\n`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  copied++;
}

for (const rel of DIRECTORIES) {
  assertApprovedMcpAssetPath(rel);
  const source = path.join(repoRoot, rel);
  const dest = path.join(mcpRoot, rel);
  if (!fs.existsSync(source)) {
    process.stderr.write(`copyMcpData: source missing: ${rel}\n`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(source, dest, { recursive: true });
  copied++;
}

for (const rel of [
  ...copiedAssetFiles(path.join(mcpRoot, "data"), "data"),
  ...copiedAssetFiles(path.join(mcpRoot, "docs"), "docs"),
]) {
  assertApprovedMcpAssetPath(rel);
}

process.stdout.write(`copyMcpData: copied ${copied} file(s) into mcp/\n`);
