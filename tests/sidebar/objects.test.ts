import { assert, describe, expect, it } from "vitest";

import { buildPropertyIndex, type PropertyIndexFile } from "../../src/knowledge/propertyIndex";
import { toBeyondOscAddress, toSetPropSnippet } from "../../src/sidebar/model/objectPaths";
import { buildSidebarObjects, getObjectDetail, getObjectTree, getPropertyPaths } from "../../src/sidebar/model/objects";
import type { ObjectsTreeNode } from "../../src/sidebar/view/webview/objectsMessages";

const fixture: PropertyIndexFile = {
  schemaVersion: 1,
  generatedAt: "2026-05-05T00:00:00Z",
  generatedFrom: "test-fixture",
  schemas: [
    {
      object: "Master",
      isArray: false,
      propertyCount: 2,
      properties: ["BlackOut", "Brightness"],
      sharedWithAliases: 0,
    },
    {
      object: "Zone",
      isArray: true,
      propertyCount: 3,
      properties: ["Active", "Geometry.X", "Geometry.Y"],
      sharedWithAliases: 0,
      arrayIndices: ["0", "1", "2", "3"],
    },
    {
      object: "MyZone",
      isArray: true,
      propertyCount: 3,
      properties: ["Active", "Geometry.X", "Geometry.Y"],
      sharedWithAliases: 0,
      inheritedFrom: "Zone",
    },
  ],
};

describe("sidebar objects", () => {
  it("builds summaries sorted alphabetically with array + inheritance flags", () => {
    const objects = buildSidebarObjects(buildPropertyIndex(fixture));
    expect(getObjectTree(objects).map((object) => object.name)).toEqual(["Master", "MyZone", "Zone"]);
    expect(getObjectTree(objects)[1]?.inheritedFrom).toBe("Zone");
  });

  it("returns full detail with properties and array indices", () => {
    const objects = buildSidebarObjects(buildPropertyIndex(fixture));
    const detail = getObjectDetail(objects, "zone");
    expect(detail?.isArray).toBe(true);
    expect(detail?.properties).toEqual(["Active", "Geometry.X", "Geometry.Y"]);
    expect(detail?.arrayIndices).toEqual(["0", "1", "2", "3"]);
  });

  it("returns undefined for unknown object names", () => {
    const objects = buildSidebarObjects(buildPropertyIndex(fixture));
    expect(getObjectDetail(objects, "Nope")).toBeUndefined();
  });

  it("returns property paths prefixed with object name for scalar objects", () => {
    const objects = buildSidebarObjects(buildPropertyIndex(fixture));
    const detail = getObjectDetail(objects, "master");
    assert(detail !== undefined);
    expect(getPropertyPaths(detail)).toEqual(["Master.BlackOut", "Master.Brightness"]);
  });

  it("returns N-indexed property paths for indexed objects", () => {
    const objects = buildSidebarObjects(buildPropertyIndex(fixture));
    const detail = getObjectDetail(objects, "zone");
    assert(detail !== undefined);
    expect(getPropertyPaths(detail)).toEqual(["Zone.N.Active", "Zone.N.Geometry.X", "Zone.N.Geometry.Y"]);
  });

  it("formats object paths as BEYOND OSC addresses", () => {
    expect(toBeyondOscAddress("Master.Brightness")).toBe("/b/Master/Brightness");
    expect(toBeyondOscAddress("Zone.N.Geometry.X")).toBe("/b/Zone/N/Geometry/X");
  });

  it("formats object paths as SetProp snippets", () => {
    expect(toSetPropSnippet("Master.Brightness")).toBe('SetProp "Master.Brightness", ');
    expect(toSetPropSnippet(" Zone.N.Geometry.X ")).toBe('SetProp "Zone.N.Geometry.X", ');
  });

  it("allows the Objects webview payload to carry a compact property card", () => {
    const node: ObjectsTreeNode = {
      label: "Master.ShowSpeed",
      path: "Master.ShowSpeed",
      propertyCard: {
        path: "Master.ShowSpeed",
        normalizedPath: "Master.ShowSpeed",
        root: "Master",
        property: "ShowSpeed",
        kind: "object",
        confidence: "observed",
        variantCount: 1,
        detailAvailable: {
          variants: 1,
          probeContexts: 0,
          contextValueMetadata: 0,
        },
        classification: {
          accessMode: "read-write",
          behaviorKind: "state-value",
          writeTestStatus: "write-readback-tested",
          readbackStatus: "readback-tested",
          evidenceLevel: "observed",
        },
      },
    };

    expect(node.propertyCard?.classification?.behaviorKind).toBe("state-value");
  });
});
