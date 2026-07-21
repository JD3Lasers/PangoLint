#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  allowedMcpDataPaths,
  findForbiddenMcpPackagePathLabels,
  requiredMcpPackagePaths,
} = require("./packageSurfacePolicy.cjs");

const repoRoot = path.resolve(__dirname, "..", "..");
const mcpRoot = path.join(repoRoot, "mcp");
const mcpPackageJson = JSON.parse(fs.readFileSync(path.join(mcpRoot, "package.json"), "utf8"));

if (mcpPackageJson.dependencies?.["@modelcontextprotocol/sdk"]) {
  throw new Error(
    "The bundled MCP server must keep @modelcontextprotocol/sdk as a build-time dependency, not an installed runtime dependency.",
  );
}
if (!mcpPackageJson.devDependencies?.["@modelcontextprotocol/sdk"]) {
  throw new Error("The MCP build is missing its @modelcontextprotocol/sdk development dependency.");
}

const forbiddenPublicTextPatterns = [
  ["private doc cache label", /\bdoc[- ]cache\b/i],
  ["private help doc label", /\bhelp doc\b/i],
  ["private local help doc label", /\blocal help doc\b/i],
  ["private help-doc label", /\bhelp-doc\b/i],
  ["private commands doc label", /\bBEYOND commands doc\b/i],
  ["discouraged canonical wording", /\bcanonical\b/i],
  ["private command export build label", /\bbuild-\d{4}\s+export\b/i],
  ["private command export line reference", /\b(?:line|lines)\s+\d+(?:\s+and\s+\d+)?\s*:\s*`[^`]+`/i],
  [
    "private sparse command entry provenance",
    /\b(?:appears? as|cataloged in|per)\b[^\r\n]{0,80}\bbare entr(?:y|ies)\b/i,
  ],
  ["em dash punctuation", /\u2014/],
];

const forbiddenDescriptionTextPatterns = [
  ["positive verified wording", /\b(?:runtime-)?verified\b|\bverification\[\]|by visual observation/i],
  [
    "runtime proof wording",
    /\b(?:Runtime readback|readback probe confirmed|probe confirmed|readback probe observed|Fresh MCP probe|MCP probe|Probed live|freshly observed|operator confirmation|tested span)\b/i,
  ],
  ["dated proof wording", /\b\d{4}-\d{2}-\d{2}\b/],
  ["private build label", /\b(?:post-)?build-\d{4}\b/i],
  ["observed proof wording", /\bobserved\b/i],
  ["Pangolin Wiki source label", /\bPangolin Wiki\b/i],
  ["BEYOND export source label", /\bBEYOND export\b|\bexport\b/i],
  ["private doc cache label", /\b(?:local help doc|doc[- ]cache|documentation cache|commands doc cache)\b/i],
  ["private source line label", /\b(?:line|lines)\s+\d{2,}\b/i],
];

const commandReferencePrefix = "docs/references/beyond/pangoscript/command-reference/";

function findForbiddenPublicTextMatches(packedPath, content) {
  if (packedPath.endsWith(".json")) {
    try {
      const data = JSON.parse(content);
      return findForbiddenJsonTextMatches(data, "", "", packedPath === "data/pangoscript/commands.merged.json");
    } catch {
      return findForbiddenTextMatches(content);
    }
  }
  return findForbiddenTextMatches(content);
}

function findForbiddenJsonTextMatches(value, key, pathLabel, scanCommandDescriptionText) {
  if (typeof value === "string") {
    if (key === "canonical") {
      return [];
    }
    return [
      ...findForbiddenTextMatches(value),
      ...(scanCommandDescriptionText && key === "description" ? findForbiddenDescriptionTextMatches(value) : []),
    ].map((label) => `${pathLabel}: ${label}`);
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenJsonTextMatches(item, String(index), `${pathLabel}[${index}]`, scanCommandDescriptionText),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, childValue]) => {
      const childPath = pathLabel ? `${pathLabel}.${childKey}` : childKey;
      return findForbiddenJsonTextMatches(childValue, childKey, childPath, scanCommandDescriptionText);
    });
  }
  return [];
}

function findForbiddenTextMatches(content) {
  const matches = [];
  for (const [label, pattern] of forbiddenPublicTextPatterns) {
    if (pattern.test(content)) {
      matches.push(label);
    }
  }
  return matches;
}

function findForbiddenDescriptionTextMatches(content) {
  const normalized = content
    .replace(/\bunverified\b/gi, "")
    .replace(/\bnot verified\b/gi, "")
    .replace(/\bnot directly verified\b/gi, "")
    .replace(/\bcannot be directly verified\b/gi, "")
    .replace(/\bhas not been verified\b/gi, "");
  const matches = [];
  for (const [label, pattern] of forbiddenDescriptionTextPatterns) {
    if (pattern.test(normalized)) {
      matches.push(label);
    }
  }
  return matches;
}

function findMarkdownExampleIndentIssues(packedPath, content) {
  if (!packedPath.startsWith(commandReferencePrefix) || !packedPath.endsWith(".md")) {
    return [];
  }

  const issues = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== "Example:") {
      continue;
    }

    for (let codeLine = index + 1; codeLine < lines.length; codeLine += 1) {
      const trimmed = lines[codeLine].trim();
      if (trimmed === "") {
        continue;
      }
      if (
        /^(?:#{2,3}\s|Parameters:|Evidence note:|Readback:|Readback paths:|Property mapping:|Safety:|Related:)/.test(
          trimmed,
        )
      ) {
        break;
      }

      const leadingSpaces = lines[codeLine].match(/^( *)/)?.[1].length ?? 0;
      if (leadingSpaces < 4) {
        issues.push(`${packedPath}:${codeLine + 1}: example code line must use four leading spaces`);
      }
    }
  }
  return issues;
}

function shouldScanPackedText(packedPath) {
  return packedPath.startsWith("data/") || packedPath.startsWith(commandReferencePrefix);
}

const npmCommand = process.env.npm_execpath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const npmArgs = [...(process.env.npm_execpath ? [process.env.npm_execpath] : []), "pack", "--dry-run", "--json"];
const rawPack = execFileSync(npmCommand, npmArgs, {
  cwd: mcpRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const packEntries = JSON.parse(rawPack);
const files = new Set((packEntries[0]?.files ?? []).map((entry) => entry.path));

for (const requiredPath of requiredMcpPackagePaths) {
  if (!files.has(requiredPath)) {
    throw new Error(`MCP tarball is missing required file: ${requiredPath}`);
  }
}

const forbidden = [];
for (const packedPath of files) {
  for (const label of findForbiddenMcpPackagePathLabels(packedPath)) {
    forbidden.push(`${packedPath}: ${label}`);
  }
}
if (forbidden.length > 0) {
  throw new Error(`MCP tarball includes forbidden path(s):\n${forbidden.join("\n")}`);
}

const dataPaths = [...files].filter((packedPath) => packedPath.startsWith("data/")).sort();
const unexpectedData = dataPaths.filter((packedPath) => !allowedMcpDataPaths.has(packedPath));
if (unexpectedData.length > 0) {
  throw new Error(`MCP tarball includes unapproved data surface(s): ${unexpectedData.join(", ")}`);
}

const forbiddenTextMatches = [];
const markdownExampleIndentIssues = [];
for (const packedPath of [...files].sort()) {
  if (!shouldScanPackedText(packedPath)) {
    continue;
  }
  const sourcePath = path.join(mcpRoot, packedPath);
  if (!fs.existsSync(sourcePath) || fs.statSync(sourcePath).isDirectory()) {
    continue;
  }
  const content = fs.readFileSync(sourcePath, "utf8");
  for (const label of findForbiddenPublicTextMatches(packedPath, content)) {
    forbiddenTextMatches.push(`${packedPath}: ${label}`);
  }
  markdownExampleIndentIssues.push(...findMarkdownExampleIndentIssues(packedPath, content));
}
if (forbiddenTextMatches.length > 0) {
  throw new Error(`MCP tarball includes private source label(s):\n${forbiddenTextMatches.join("\n")}`);
}
if (markdownExampleIndentIssues.length > 0) {
  throw new Error(
    `MCP tarball includes Markdown example indentation issue(s):\n${markdownExampleIndentIssues.join("\n")}`,
  );
}

console.log(`MCP tarball content verified: ${files.size} files.`);
