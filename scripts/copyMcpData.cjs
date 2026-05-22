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
const {
  assertApprovedMcpAssetPath: assertApprovedPolicyPath,
  mcpAssetDirectories,
  mcpAssetFiles,
} = require("./packageSurfacePolicy.cjs");

const repoRoot = path.resolve(__dirname, "..");
const mcpRoot = path.join(repoRoot, "mcp");

function assertApprovedMcpAssetPath(rel) {
  try {
    assertApprovedPolicyPath(rel);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`copyMcpData: ${message}\n`);
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
for (const rel of mcpAssetFiles) {
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

for (const rel of mcpAssetDirectories) {
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
