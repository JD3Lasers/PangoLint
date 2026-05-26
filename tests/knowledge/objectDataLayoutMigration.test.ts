import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findPublicArtifactLeaks } from "../../scripts/package/publicArtifactPolicy";
import { readJson } from "./readKnowledgeTestData";

describe("checked-in Object Tree data layout migration", () => {
  it("keeps the public known-properties artifact free of capture provenance", () => {
    const knownProperties = readJson<Record<string, unknown>>("known-properties.json");

    expect(Object.keys(knownProperties).sort()).toEqual(["schemaVersion", "schemas"]);
  });

  it("keeps the public object-property index free of capture provenance", () => {
    const index = readJson<Record<string, unknown>>("object-property-index.json");

    expect(Object.keys(index).sort()).toEqual(["entries", "schemaVersion"]);
  });

  it("keeps shipped public artifacts free of private lab identifiers", () => {
    const artifacts = [
      "README.md",
      "CHANGELOG.md",
      "package.json",
      "data/pangoscript/commands.generated.json",
      "data/pangoscript/commands.overlay.json",
      "data/pangoscript/commands.merged.json",
      "data/pangoscript/command-property-coverage.json",
      "data/pangoscript/object-tree/runtime-indexes/known-properties.json",
      "data/pangoscript/object-tree/runtime-indexes/object-property-index.json",
      "data/pangoscript/object-tree/evidence/readback.schema.json",
      "data/pangoscript/object-tree/evidence/readback/issue-407-zone-count-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-410-zone-effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-412-zone-name-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-414-zone-direct-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-416-zone-remaining-nested-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-common-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-296-universe-zone-nested-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-297-universe-panel-alias-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-319-fx-identifier-safe-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-425-qshift-a-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-427-qshift-b-readbacks.json",
      "data/pangoscript/object-tree/evidence/readback/issue-429-qshift-direct-readbacks.json",
      "data/pangoscript/object-tree/audits/readback/issue-216-readback-write-audit.json",
      "data/pangoscript/object-tree/audits/behavior/issue-216-object-behavior-audit.json",
      "data/pangoscript/object-tree/audits/data-quality/final-object-data-quality-audit.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-484-observed-state-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-panel-alias-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-universe-zone-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-486-zone-zonealias-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-fx-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-universe-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-487-ws-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-499-gamepad-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-501-beam-flag-state.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-503-small-behavior-rows.json",
      "data/pangoscript/object-tree/source-facts/behavior-metadata/issue-513-fx-readback-retest.json",
      "data/pangoscript/object-tree/evidence/behavior/issue-513-fx-readback-retest.json",
      "data/pangoscript/object-tree/evidence/value.schema.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-act-grid-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-final-gaps.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-fx-readback-write-audit.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-grid1-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-grid2-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-master-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-protrack-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-sampled-audit.json",
      "data/pangoscript/object-tree/evidence/value/issue-216-touchpoints-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-118-mobsensor-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-120-skeleton-coordinate-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-122-universe-boolean-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-124-ws-image-numeric-boundary-spot-checks.json",
      "data/pangoscript/object-tree/evidence/value/issue-126-ws-boolean-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-128-master-numeric-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-131-ws-integer-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-133-projector-numeric-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-135-grid-integer-boundary-behavior.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-beam-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-fb-hardware-controls.json",
      "data/pangoscript/object-tree/evidence/value/issue-298-status-memory-and-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-299-gamepad-axis-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-299-mobsensor-leftovers.json",
      "data/pangoscript/object-tree/evidence/value/issue-445-ws-image-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-447-ws-ani0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-449-ws-image0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-451-ws-synthesized-image-list0-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-453-ws-common-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-455-ws-image-effect-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-457-ws-particles-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-459-ws-image-gap-write-remediation.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-a-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-b-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-qshift-direct-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-common-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-panel-alias-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-universe-zone-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-486-zone-zonealias-write-readbacks.json",
      "data/pangoscript/object-tree/evidence/value/issue-513-fx-readback-retest-ranges.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/fx/issue-513-readback-retest-pass-through.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata.schema.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/common-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe/zone-nested-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/universe-panel-alias/typed-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/fx/identifier-safe-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/final-gaps/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/act-grid-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/grid1-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/focused-cue/grid2-focused-cue-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/master/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/protrack/leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/qshift/a-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/qshift/b-control-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image0-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image-effect-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/image-gap-noop-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/synthesized-image-list0-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/ws/top-level-common-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/input/gamepad-axis-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/hardware/beam-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/hardware/status-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/count-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/direct-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/effect-leftover-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/name-readbacks.json",
      "data/pangoscript/object-tree/source-facts/readback-metadata/zone/remaining-nested-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/root.json",
      "data/pangoscript/object-tree/source-facts/value-metadata.schema.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/final-gaps/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/fx/readback-write-audit-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/global/readback-count-domains.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/beam-leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/fb-hardware-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/hardware/status-memory-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/input/mobsensor-leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/master/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/qshift/direct-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/touchpoints/leftover-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/universe/common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/universe-panel-alias/common-write-readbacks.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/zone/readback-retest-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/zone-alias/readback-retest-promotions.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/ani0-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image-gap-sampled-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image0-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/image-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/ws/synthesized-image-list0-write-remediation-controls.json",
      "data/pangoscript/object-tree/source-facts/value-metadata/workspace/grid-boundary-controls.json",
      "docs/manual.html",
      "docs/references/diagnostics/README.md",
      "docs/references/operators.md",
      "docs/references/syntax.md",
      "docs/references/beyond/pangoscript/master-object-tree.md",
      "docs/references/beyond/pangoscript/object-model.md",
      ...readdirSync(path.join(process.cwd(), "docs", "references", "beyond", "pangoscript", "command-reference"))
        .filter((fileName) => fileName.endsWith(".md"))
        .map((fileName) => path.join("docs", "references", "beyond", "pangoscript", "command-reference", fileName)),
    ];

    const leaks = artifacts.flatMap((artifact) => {
      const contents = readFileSync(path.join(process.cwd(), artifact), "utf8");
      return findPublicArtifactLeaks(contents).map((leak) => `${artifact}: ${leak.label} (${leak.match})`);
    });

    expect(leaks).toEqual([]);
  }, 120_000);

  it("detects private artifact classes without concrete lab fixtures", () => {
    const privateHost = [10, 1, 2, 3].join(".");
    const regexEscapedPrivateHost = privateHost.replaceAll(".", String.raw`\.`);
    const jsonEscapedPrivateHost = regexEscapedPrivateHost.replaceAll("\\", String.raw`\\`);
    const hardwareRoot = ["F", "B", "4"].join("");
    const hardwareDigits = [1, 2, 3, 4, 5].join("");
    const sourcePortValue = [4, 5, 6, 7, 8].join("");
    const highPortValue = [5, 6, 7, 8, 9].join("");
    const commandBuildExportLabel = `${["build", "2044"].join("-")} export`;
    const sparseEntryLabel = ["bare", "entry"].join(" ");
    const pairingPort = [8, 1, 2, 3].join("");
    const shortHost = ["x"].join("");
    const endpointValueKey = ["endpoint", "Value"].join("");
    const appPairingPort = [9, 8, 7, 6].join("");
    const appVersion = [1, 2, 3, 4].join(".");
    const leakSamples = [
      `BEYOND host ${privateHost}`,
      `pattern: /\\b${regexEscapedPrivateHost}\\b/`,
      `"pattern": "\\\\b${jsonEscapedPrivateHost}\\\\b"`,
      `controller ${hardwareRoot}_${hardwareDigits} connected`,
      `hardware serial ${hardwareDigits}`,
      `ClientHardwareSerial = ${hardwareDigits}`,
      `hardwareSerial = ${hardwareDigits}`,
      `mobile-device source port ${sourcePortValue}`,
      `source port ${sourcePortValue}`,
      `"sourcePort": ${sourcePortValue}`,
      `"port": ${highPortValue}`,
      `port ${highPortValue}`,
      `Appears as a ${sparseEntryLabel} in the ${commandBuildExportLabel} (line 423: \`PlayTimeline|PlayTimeline\`)`,
      `Cataloged in the ${commandBuildExportLabel} (line 515: ${sparseEntryLabel} \`Restart|Restart\` entry)`,
      `endpoint :${pairingPort}`,
      `endpoint:${pairingPort}`,
      `example.com:${pairingPort}`,
      `laserbox:${pairingPort}`,
      `"laserbox:${pairingPort}"`,
      `${shortHost}:${pairingPort}`,
      `"${shortHost}:${pairingPort}"`,
      `"${shortHost}":${pairingPort}`,
      `http://${shortHost}:${pairingPort}`,
      `"endpoint":${pairingPort}`,
      `${endpointValueKey}:${pairingPort}`,
      `"laserbox":${pairingPort}`,
      `port-${pairingPort}`,
      `mobile app version ${appVersion}`,
      `mobile app pairing endpoint port ${appPairingPort}`,
    ];

    for (const sample of leakSamples) {
      expect(findPublicArtifactLeaks(sample), sample).not.toEqual([]);
    }
  });

  it("keeps the public artifact leak policy free of private artifact classes", () => {
    const policySource = readFileSync(
      path.join(process.cwd(), "scripts", "package", "publicArtifactPolicy.ts"),
      "utf8",
    );

    expect(findPublicArtifactLeaks(policySource)).toEqual([]);
  });

  it("allows object readback numeric values that look like pairing ports", () => {
    expect(findPublicArtifactLeaks('{"observedValue":8191.75}')).toEqual([]);
    expect(findPublicArtifactLeaks('{"readValue":8123}')).toEqual([]);
    expect(findPublicArtifactLeaks("observedValue:8191.75")).toEqual([]);
    expect(findPublicArtifactLeaks("readValue:8123")).toEqual([]);
  });

  it("ships a compact object-property search index for agents", () => {
    const index = readJson<{
      schemaVersion: number;
      entries: Array<{
        path: string;
        normalizedPath: string;
        root: string;
        property: string;
        kind: string;
        searchText: string;
        variantCount: number;
        variants: Array<{ path: string; osc?: string }>;
      }>;
    }>("object-property-index.json");

    expect(index.schemaVersion).toBe(1);
    expect(index.entries.length).toBeGreaterThan(1000);
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "Master.ShowSpeed",
        normalizedPath: "Master.ShowSpeed",
        root: "Master",
        property: "ShowSpeed",
        kind: "object",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "Master.ShowShift",
        normalizedPath: "Master.ShowShift",
        root: "Master",
        property: "ShowShift",
        kind: "object",
      }),
    );
    const dmxOutput = index.entries.find((entry) => entry.path === "DmxOutput.N");
    expect(dmxOutput?.variantCount).toBe(2047);
    expect(dmxOutput?.variants).toContainEqual({ path: "DmxOutput.2046", osc: "/b/DmxOutput/2046" });
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "FX.N.N.N.Oscillator.Period",
        normalizedPath: "FX.N.N.N.Oscillator.Period",
        root: "FX",
        property: "Oscillator.Period",
        kind: "fx",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "WS.N.N.Caption",
        normalizedPath: "WS.N.N.Caption",
        root: "WS",
        property: "Caption",
        kind: "object",
      }),
    );
  });

  it("keeps object-property index paths unique under case-insensitive lookup", () => {
    const index = readJson<{
      entries: Array<{ path: string }>;
    }>("object-property-index.json");
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const entry of index.entries) {
      const key = entry.path.toLowerCase();
      const prior = seen.get(key);
      if (prior) duplicates.push(`${prior} / ${entry.path}`);
      else seen.set(key, entry.path);
    }

    expect(duplicates).toEqual([]);
  });

  it("collapses showfile-specific Object Tree roots before shipping the agent index", () => {
    const index = readJson<{
      entries: Array<{
        path: string;
        root: string;
        searchText: string;
        variants: Array<{ path: string; osc?: string }>;
      }>;
    }>("object-property-index.json");
    const showfileSpecificNames = [
      "---DUMMYZONE---",
      "---GROUPS---",
      "---PAIRS---",
      "---PIXELMAPS---",
      "HardwareMuter",
      "COLORPICKER",
      "SHOWKONTROL",
    ];

    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "ZoneAlias.Active",
        root: "ZoneAlias",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "UniversePanelAlias.Control.Caption",
        root: "UniversePanelAlias",
      }),
    );
    expect(index.entries).toContainEqual(
      expect.objectContaining({
        path: "FB4_XXXXX.Connected",
        root: "FB4_XXXXX",
      }),
    );
    const redactedHardwareEntry = index.entries.find((entry) => entry.path === "FB4_XXXXX.Connected");
    expect(redactedHardwareEntry).toBeDefined();
    expect(redactedHardwareEntry).not.toHaveProperty("osc");
    expect(redactedHardwareEntry?.variants).toContainEqual({ path: "FB4_XXXXX.Connected" });

    const serialized = JSON.stringify(index.entries);
    for (const name of showfileSpecificNames) {
      expect(serialized).not.toContain(name);
    }
    expect(serialized).not.toMatch(/\/b\/FB[34]_\d+/);
    expect(serialized).not.toMatch(/\/b\/FB[34]_XXXXX/);
  });

  it("uses underscore placeholders for redacted FB hardware roots", () => {
    const index = readJson<{
      entries: Array<{
        path: string;
        normalizedPath: string;
        root: string;
        variants: Array<{ path: string; osc?: string }>;
      }>;
    }>("object-property-index.json");
    const serialized = JSON.stringify(index.entries);

    expect(serialized).toContain("FB3_XXXXX.");
    expect(serialized).toContain("FB4_XXXXX.");
    expect(serialized).not.toMatch(/FB[34]-XXXXX/);

    const fb4Connected = index.entries.find((entry) => entry.path === "FB4_XXXXX.Connected");
    expect(fb4Connected).toMatchObject({
      path: "FB4_XXXXX.Connected",
      normalizedPath: "FB4_XXXXX.Connected",
      root: "FB4_XXXXX",
      variants: [{ path: "FB4_XXXXX.Connected" }],
    });
    expect(fb4Connected).not.toHaveProperty("osc");
  });

  it("marks user-configurable Object Tree alias placeholders", () => {
    const index = readJson<{
      entries: Array<{
        path: string;
        addressMetadata?: {
          mode: string;
          placeholder: string;
          aliasOf: string;
          userConfigured: boolean;
          componentPlaceholder?: string;
        };
      }>;
    }>("object-property-index.json");
    const byPath = new Map(index.entries.map((entry) => [entry.path, entry]));

    expect(byPath.get("ZoneAlias.Active")?.addressMetadata).toMatchObject({
      mode: "user-configured-name",
      placeholder: "ZoneAlias",
      aliasOf: "Zone.N",
      userConfigured: true,
    });
    expect(byPath.get("ZoneAlias.Active")?.addressMetadata?.componentPlaceholder).toBeUndefined();
    expect(byPath.get("UniversePanelAlias.Control.Caption")?.addressMetadata).toMatchObject({
      mode: "user-configured-name",
      placeholder: "UniversePanelAlias",
      aliasOf: "Universe.N",
      userConfigured: true,
      componentPlaceholder: "Control",
    });

    expect(byPath.get("Zone.N.Active")?.addressMetadata).toBeUndefined();
    expect(byPath.get("Universe.N.Button1.Caption")?.addressMetadata).toBeUndefined();
    expect(byPath.get("Master.Brightness")?.addressMetadata).toBeUndefined();
  });

  it("carries runtime-backed object schema corrections for hovers and completions", () => {
    const knownProperties = readJson<{
      schemas: Array<{
        object: string;
        propertyCount: number;
        properties: string[];
      }>;
    }>("known-properties.json");

    const master = knownProperties.schemas.find((schema) => schema.object === "Master");
    expect(master?.properties).toContain("ShowShift");
    expect(master?.propertyCount).toBe(master?.properties.length);

    const dmxOutput = knownProperties.schemas.find((schema) => schema.object === "DmxOutput");
    expect(dmxOutput?.propertyCount).toBe(2047);
    expect(dmxOutput?.properties).toContain("2046");
    expect(dmxOutput?.properties).not.toContain("2047");
  });
});
