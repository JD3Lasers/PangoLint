import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { ObjectPropertyIndexFile } from "../../src/knowledge/objectPropertyIndex";

const indexPath = path.join(
  process.cwd(),
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "object-property-index.json",
);
const knownPropertiesPath = path.join(
  process.cwd(),
  "data",
  "pangoscript",
  "object-tree",
  "runtime-indexes",
  "known-properties.json",
);

describe("Projector count access metadata", () => {
  it("distinguishes the PangoScript expression from the OSC object-bus-only status path", () => {
    const index = JSON.parse(readFileSync(indexPath, "utf8")) as ObjectPropertyIndexFile;
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("Projector.Count")).toMatchObject({
      readbackMetadata: {
        accessMechanism: "pangoscript-expression",
        probePath: "Projector.Count",
        valueType: "integer",
        evidenceLevel: "observed",
      },
      classification: {
        accessMode: "unknown",
        behaviorKind: "computed-status",
        writeTestStatus: "not-tested",
        readbackStatus: "readback-tested",
        evidenceLevel: "unverified",
      },
    });

    expect(byPath.get("Status.Projector.Count")).toMatchObject({
      readbackMetadata: {
        accessMechanism: "osc-object-bus",
        probePath: "/b/Status/Projector/Count",
        valueType: "integer",
        evidenceLevel: "observed",
      },
      classification: {
        accessMode: "object-bus-only",
        behaviorKind: "computed-status",
        readbackStatus: "readback-tested",
        evidenceLevel: "observed",
      },
    });
  });

  it("models Count as a direct property on the indexed Projector schema", () => {
    const knownProperties = JSON.parse(readFileSync(knownPropertiesPath, "utf8")) as {
      schemas: Array<{ object: string; propertyCount: number; properties: string[]; rootProperties?: string[] }>;
    };
    const projector = knownProperties.schemas.find((schema) => schema.object === "Projector");

    expect(projector?.rootProperties).toEqual(["Count"]);
    expect(projector?.properties).not.toContain("Count");
    expect(projector?.propertyCount).toBe((projector?.properties.length ?? 0) + 1);
  });
});
