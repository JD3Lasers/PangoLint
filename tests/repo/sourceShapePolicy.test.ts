import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const typeScriptFileSizeAudits = [
  { root: "src", lineLimit: 600 },
  { root: "scripts", lineLimit: 600 },
  { root: "mcp/src", lineLimit: 600 },
  { root: "tests", lineLimit: 900 },
  { root: "mcp/tests", lineLimit: 900 },
];

const folderNameAuditRoots = ["src", "scripts", "mcp/src", "tests", "mcp/tests"];

// Generated artifacts, checked-in data, and operator example paths are outside
// this audit. Those paths preserve public, source, or upstream names.
const allowedOversizedTypeScriptFiles = new Map<string, string>([
  [
    "src/knowledge/cue-properties/parametricImageShapes.ts",
    "Captured Parametric Image shape data is intentionally kept as one readable metadata table.",
  ],
  [
    "scripts/build/referenceSite/buildReferenceCatalog.ts",
    "Reference catalog assembly is existing build pipeline code and will be split in a separate script cleanup.",
  ],
  [
    "tests/knowledge/commandKnowledgeData.test.ts",
    "Command knowledge coverage intentionally keeps related generated data checks in one audit file.",
  ],
  [
    "tests/knowledge/object-value-metadata/cue-and-zone.test.ts",
    "Cue and zone value metadata coverage is a data-quality audit over one evidence family.",
  ],
  [
    "tests/knowledge/object-value-metadata/device.test.ts",
    "Device value metadata coverage is a data-quality audit over one evidence family.",
  ],
  [
    "tests/knowledge/objectPropertyClassificationData.test.ts",
    "Object property classification coverage audits a checked-in metadata surface with many cases.",
  ],
  [
    "tests/knowledge/objectReadbackMetadataData.test.ts",
    "Object readback metadata coverage audits a checked-in metadata surface with many cases.",
  ],
  [
    "tests/language/diagnostics.test.ts",
    "Language diagnostics coverage keeps parser and diagnostic compatibility cases together for now.",
  ],
]);

function readTypeScriptFiles(folderPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...readTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

function readDirectories(folderPath: string): string[] {
  const directories: string[] = [];
  for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(folderPath, entry.name);
    directories.push(entryPath, ...readDirectories(entryPath));
  }
  return directories;
}

function repoPath(filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function lineCount(filePath: string): number {
  const text = readFileSync(filePath, "utf8");
  if (!text) return 0;
  return text.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function fileSizeAuditForPath(filePath: string): (typeof typeScriptFileSizeAudits)[number] | undefined {
  return typeScriptFileSizeAudits.find(({ root }) => filePath === root || filePath.startsWith(`${root}/`));
}

function isAllowedFolderName(folderName: string): boolean {
  return /^[a-z][A-Za-z0-9]*$/.test(folderName) || /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(folderName);
}

describe("source shape policy", () => {
  it("keeps TypeScript source files below drift limits unless an exemption is documented", () => {
    const oversizedFiles = typeScriptFileSizeAudits.flatMap(({ root, lineLimit }) =>
      readTypeScriptFiles(path.join(repoRoot, root))
        .map((filePath) => ({ path: repoPath(filePath), lines: lineCount(filePath), limit: lineLimit }))
        .filter((file) => file.lines > file.limit)
        .filter((file) => !allowedOversizedTypeScriptFiles.has(file.path))
        .map((file) => `${file.path} has ${file.lines} lines, limit ${file.limit}`),
    );

    expect(oversizedFiles).toEqual([]);

    for (const [filePath, reason] of allowedOversizedTypeScriptFiles) {
      expect(reason.trim().length, `${filePath} exemption reason`).toBeGreaterThan(24);
      const audit = fileSizeAuditForPath(filePath);
      expect(audit, `${filePath} is covered by a file-size audit root`).toBeDefined();
      expect(lineCount(path.join(repoRoot, filePath)), `${filePath} exemption still needed`).toBeGreaterThan(
        audit?.lineLimit ?? Number.MAX_SAFE_INTEGER,
      );
    }
  });

  it("keeps source, script, and test folder names readable", () => {
    const invalidFolders = folderNameAuditRoots.flatMap((root) =>
      readDirectories(path.join(repoRoot, root))
        .map(repoPath)
        .filter((folderPath) => !isAllowedFolderName(path.basename(folderPath))),
    );

    expect(invalidFolders).toEqual([]);
  });
});
