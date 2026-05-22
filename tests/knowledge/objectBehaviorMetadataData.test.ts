import { describe, expect, it } from "vitest";
import {
  assertObjectPropertyBehaviorClassification,
  type ObjectPropertyBehaviorClassification,
  type ObjectPropertyReadbackMetadata,
  type ObjectPropertyValueMetadata,
  readJson,
  readObjectPropertyClassificationOverlayFiles,
} from "./readKnowledgeTestData";

describe("checked-in Object Tree behavior metadata data", () => {
  it("keeps object-property behavior classification overlay entries structurally valid", () => {
    const overlayFiles = readObjectPropertyClassificationOverlayFiles();
    const objectPropertyIndex = readJson<{
      entries: Array<{
        path: string;
        valueMetadata?: ObjectPropertyValueMetadata;
        readbackMetadata?: ObjectPropertyReadbackMetadata;
        contextValueMetadata?: Array<ObjectPropertyValueMetadata & { contextId: string }>;
        classification?: ObjectPropertyBehaviorClassification;
      }>;
    }>("object-property-index.json");
    const knownPaths = new Set(objectPropertyIndex.entries.map((entry) => entry.path));
    const byPath = new Map(objectPropertyIndex.entries.map((entry) => [entry.path, entry]));

    expect(overlayFiles.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const source of overlayFiles) {
      expect(source.overlay.schemaVersion, source.relativePath).toBe(1);
      for (const entry of source.overlay.entries) {
        expect(knownPaths.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(true);
        expect(seen.has(entry.path), `${source.relativePath} ${entry.path}`).toBe(false);
        seen.add(entry.path);
        assertObjectPropertyBehaviorClassification(entry);
        expect(byPath.get(entry.path)?.classification, entry.path).toMatchObject({
          accessMode: entry.accessMode,
          behaviorKind: entry.behaviorKind,
          writeTestStatus: entry.writeTestStatus,
          readbackStatus: entry.readbackStatus,
          evidenceLevel: entry.evidenceLevel,
        });
      }
    }
  });
});
