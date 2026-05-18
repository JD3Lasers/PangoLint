import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const objectTreeRoot = path.join(repoRoot, "data", "pangoscript", "object-tree");
const manifestPath = path.join(objectTreeRoot, "data-groups.json");
const readmePath = path.join(objectTreeRoot, "README.md");
const objectPathFactsPath = path.join(objectTreeRoot, "source-facts", "object-paths.json");
const knownPropertiesRuntimeIndexPath = path.join(objectTreeRoot, "runtime-indexes", "known-properties.json");
const objectPropertyRuntimeIndexPath = path.join(objectTreeRoot, "runtime-indexes", "object-property-index.json");
const valueMetadataRootPath = path.join(objectTreeRoot, "source-facts", "value-metadata", "root.json");
const valueMetadataPilotPath = path.join(
  objectTreeRoot,
  "source-facts",
  "value-metadata",
  "zone",
  "visualization-id-range.json",
);
const readbackMetadataDirectoryPath = path.join(objectTreeRoot, "source-facts", "readback-metadata");
const behaviorMetadataRootPath = path.join(objectTreeRoot, "source-facts", "behavior-metadata", "root.json");
const valueEvidenceDirectoryPath = path.join(objectTreeRoot, "evidence", "value");
const readbackEvidenceDirectoryPath = path.join(objectTreeRoot, "evidence", "readback");
const behaviorEvidenceDirectoryPath = path.join(objectTreeRoot, "evidence", "behavior");
const behaviorAuditDirectoryPath = path.join(objectTreeRoot, "audits", "behavior");
const readbackAuditDirectoryPath = path.join(objectTreeRoot, "audits", "readback");
const dataQualityAuditPath = path.join(
  objectTreeRoot,
  "audits",
  "data-quality",
  "final-object-data-quality-audit.json",
);
const emDash = String.fromCharCode(0x2014);

interface ObjectTreeDataGroupManifest {
  schemaVersion: number;
  objectTreeRoot: string;
  targetFolders: Array<{ path: string; role: string }>;
  dataGroups: ObjectTreeDataGroup[];
}

interface ObjectTreeDataGroup {
  id: string;
  role: string;
  currentPaths: string[];
  targetPaths: string[];
  consumers: string[];
  generator: string;
  packageSurface: string;
  retirementPolicy: string;
}

interface ObjectPathSourceFacts {
  schemaVersion: number;
  paths: Array<{
    path: string;
    normalizedPath: string;
    root: string;
    kind: "object" | "fx";
    segments: string[];
  }>;
  fxLabels?: {
    cells?: Record<string, unknown>;
  };
  sourceSummary?: {
    pathCount?: number;
    rootCount?: number;
  };
}

describe("Object Tree architecture data contract", () => {
  it("declares Object Tree folders and data groups before data moves", () => {
    const manifest = readManifest();
    const targetFolders = manifest.targetFolders.map((entry) => entry.path).sort();

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.objectTreeRoot).toBe("data/pangoscript/object-tree");
    expect(targetFolders).toEqual([
      "audits/",
      "evidence/",
      "package-projections/",
      "runtime-indexes/",
      "source-facts/",
    ]);

    for (const group of manifest.dataGroups) {
      expect(group.id, "id").toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(group.role, group.id).toMatch(
        /^(source facts|generated runtime index|evidence|audit output|package projection|schema)$/,
      );
      expect(group.currentPaths.length, `${group.id} current paths`).toBeGreaterThan(0);
      expect(group.targetPaths.length, `${group.id} target paths`).toBeGreaterThan(0);
      expect(group.consumers.length, `${group.id} consumers`).toBeGreaterThan(0);
      expect(group.generator.length, `${group.id} generator`).toBeGreaterThan(0);
      expect(group.packageSurface.length, `${group.id} package surface`).toBeGreaterThan(0);
      expect(group.retirementPolicy.length, `${group.id} retirement policy`).toBeGreaterThan(0);
      for (const targetPath of group.targetPaths) {
        expect(targetPath, group.id).toMatch(/^data\/pangoscript\/object-tree\//);
      }
    }
  });

  it("maps the current Object Tree data paths to product-shaped target paths", () => {
    const groups = new Map(readManifest().dataGroups.map((group) => [group.id, group]));

    expect(groups.get("object-path-source-facts")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/source-facts/object-paths.json"],
      targetPaths: ["data/pangoscript/object-tree/source-facts/object-paths.json"],
      packageSurface: "not packaged",
    });
    expect(groups.get("known-properties-runtime-index")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/runtime-indexes/known-properties.json"],
      targetPaths: ["data/pangoscript/object-tree/runtime-indexes/known-properties.json"],
    });
    expect(groups.get("object-property-runtime-index")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/runtime-indexes/object-property-index.json"],
      targetPaths: ["data/pangoscript/object-tree/runtime-indexes/object-property-index.json"],
    });
    expect(groups.get("value-metadata")).toMatchObject({
      currentPaths: [
        "data/pangoscript/object-tree/source-facts/value-metadata/root.json",
        "data/pangoscript/object-tree/source-facts/value-metadata/",
      ],
      targetPaths: ["data/pangoscript/object-tree/source-facts/value-metadata/"],
    });
    expect(groups.get("readback-metadata")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/source-facts/readback-metadata/"],
      targetPaths: ["data/pangoscript/object-tree/source-facts/readback-metadata/"],
    });
    expect(groups.get("behavior-metadata")).toMatchObject({
      currentPaths: [
        "data/pangoscript/object-tree/source-facts/behavior-metadata/root.json",
        "data/pangoscript/object-tree/source-facts/behavior-metadata/",
      ],
      targetPaths: ["data/pangoscript/object-tree/source-facts/behavior-metadata/"],
    });
    expect(groups.get("value-evidence")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/evidence/value/"],
      targetPaths: ["data/pangoscript/object-tree/evidence/value/"],
    });
    expect(groups.get("readback-evidence")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/evidence/readback/"],
      targetPaths: ["data/pangoscript/object-tree/evidence/readback/"],
    });
    expect(groups.get("behavior-evidence")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/evidence/behavior/"],
      targetPaths: ["data/pangoscript/object-tree/evidence/behavior/"],
    });
    expect(groups.get("behavior-audits")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/audits/behavior/"],
      targetPaths: ["data/pangoscript/object-tree/audits/behavior/"],
    });
    expect(groups.get("readback-audits")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/audits/readback/"],
      targetPaths: ["data/pangoscript/object-tree/audits/readback/"],
    });
    expect(groups.get("data-quality-audits")).toMatchObject({
      currentPaths: ["data/pangoscript/object-tree/audits/data-quality/final-object-data-quality-audit.json"],
      targetPaths: ["data/pangoscript/object-tree/audits/data-quality/final-object-data-quality-audit.json"],
    });
  });

  it("documents the migration order and pilot rename", () => {
    const readme = readFile(readmePath);

    for (const text of [
      "Issue #530",
      "Issue #531",
      "Issue #532",
      "Issue #533",
      "Issue #534",
      "Issue #535",
      "Issue #536",
      "data/pangoscript/object-tree/",
      "source-facts/",
      "runtime-indexes/",
      "evidence/",
      "audits/",
      "package-projections/",
      "source-facts/value-metadata/",
      "source-facts/readback-metadata/",
      "source-facts/behavior-metadata/",
      "Do not remove active data before replacement paths exist and consumers move.",
    ]) {
      expect(readme, text).toContain(text);
    }
  });

  it("stores Object Tree source metadata under product-shaped source fact paths", () => {
    expect(existsSync(valueMetadataRootPath)).toBe(true);
    expect(existsSync(valueMetadataPilotPath)).toBe(true);
    expect(existsSync(readbackMetadataDirectoryPath)).toBe(true);
    expect(existsSync(behaviorMetadataRootPath)).toBe(true);

    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-ranges.json"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-ranges"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-readbacks"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-classifications.json"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-classifications"))).toBe(false);

    const pilot = JSON.parse(readFile(valueMetadataPilotPath)) as { entries?: Array<{ path?: string }> };
    expect(pilot.entries).toContainEqual(expect.objectContaining({ path: "Zone.N.VisualizationId" }));
  });

  it("stores Object Tree evidence and audits under product-shaped paths", () => {
    expect(existsSync(valueEvidenceDirectoryPath)).toBe(true);
    expect(existsSync(readbackEvidenceDirectoryPath)).toBe(true);
    expect(existsSync(behaviorEvidenceDirectoryPath)).toBe(true);
    expect(existsSync(behaviorAuditDirectoryPath)).toBe(true);
    expect(existsSync(readbackAuditDirectoryPath)).toBe(true);
    expect(existsSync(dataQualityAuditPath)).toBe(true);

    for (const oldPath of [
      "object-range-evidence",
      "object-range-evidence.schema.json",
      "object-readback-evidence",
      "object-readback-evidence.schema.json",
      "object-behavior-evidence",
      "object-behavior-audits",
      "object-readback-audits",
    ]) {
      expect(existsSync(path.join(repoRoot, "data", "pangoscript", oldPath)), oldPath).toBe(false);
    }
  });

  it("requires tracked files under the Object Tree root to match declared target folders", () => {
    const manifest = readManifest();
    const allowedFiles = new Set(["README.md", "data-groups.json"]);
    const targetFolderPrefixes = manifest.targetFolders.map((entry) => entry.path);
    const files = listFiles(objectTreeRoot);

    for (const relativePath of files) {
      if (allowedFiles.has(relativePath)) continue;
      expect(
        targetFolderPrefixes.some((prefix) => relativePath.startsWith(prefix)),
        `${relativePath} must live under a declared Object Tree target folder`,
      ).toBe(true);
    }
  });

  it("keeps new Object Tree architecture docs free of long dash characters", () => {
    expect(readFile(readmePath)).not.toContain(emDash);
    expect(readFile(manifestPath)).not.toContain(emDash);
  });

  it("stores tracked Object Tree path source facts without maintainer input paths", () => {
    const sourceFacts = JSON.parse(readFile(objectPathFactsPath)) as ObjectPathSourceFacts;
    const contents = readFile(objectPathFactsPath);

    expect(sourceFacts.schemaVersion).toBe(1);
    expect(sourceFacts.paths.length).toBeGreaterThan(10_000);
    expect(sourceFacts.sourceSummary?.pathCount).toBe(sourceFacts.paths.length);
    expect(sourceFacts.sourceSummary?.rootCount).toBeGreaterThan(40);
    expect(sourceFacts.fxLabels?.cells && Object.keys(sourceFacts.fxLabels.cells).length).toBeGreaterThan(0);
    expect(sourceFacts.paths[0]).toMatchObject({
      path: expect.any(String),
      normalizedPath: expect.any(String),
      root: expect.any(String),
      kind: expect.stringMatching(/^(object|fx)$/),
      segments: expect.any(Array),
    });

    for (const pattern of [/\bFB3_\d+\b/i, /\bFB4_\d+\b/i]) {
      expect(contents).not.toMatch(pattern);
    }
  });

  it("points Object Tree generators at tracked source facts by default", () => {
    const objectPropertyGenerator = readFile(path.join(repoRoot, "scripts", "generateObjectPropertyIndex.ts"));
    const knownPropertiesGenerator = readFile(path.join(repoRoot, "scripts", "generateKnownProperties.ts"));

    for (const source of [objectPropertyGenerator, knownPropertiesGenerator]) {
      expect(source).toContain("data/pangoscript/object-tree/source-facts/object-paths.json");
    }
  });

  it("stores generated Object Tree runtime indexes under the architecture path", () => {
    expect(existsSync(knownPropertiesRuntimeIndexPath)).toBe(true);
    expect(existsSync(objectPropertyRuntimeIndexPath)).toBe(true);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "known-properties.json"))).toBe(false);
    expect(existsSync(path.join(repoRoot, "data", "pangoscript", "object-property-index.json"))).toBe(false);

    const knownProperties = JSON.parse(readFile(knownPropertiesRuntimeIndexPath)) as { schemas?: unknown[] };
    const objectPropertyIndex = JSON.parse(readFile(objectPropertyRuntimeIndexPath)) as { entries?: unknown[] };
    expect(knownProperties.schemas?.length).toBeGreaterThan(40);
    expect(objectPropertyIndex.entries?.length).toBeGreaterThan(5_000);
  });
});

function readManifest(): ObjectTreeDataGroupManifest {
  return JSON.parse(readFile(manifestPath)) as ObjectTreeDataGroupManifest;
}

function readFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return listFiles(entryPath).map((childPath) => `${entry.name}/${childPath}`);
    }
    return entry.isFile() ? [entry.name] : [];
  });
}
