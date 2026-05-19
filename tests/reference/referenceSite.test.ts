import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { valueTransformLabel } from "../../src/reference/bundle/detail";
import { buildFxTree } from "../../src/reference/bundle/objectTree";
import type { ReferenceCatalog, ReferenceOscRoute } from "../../src/reference/bundle/types";

const repoRoot = process.cwd();
const htmlPath = path.join(repoRoot, "media", "reference", "pangoscript-reference.html");
const objectPropertyTargetIndexPath = path.join(
  repoRoot,
  "data",
  "pangoscript",
  "control-reference",
  "osc-control-reference",
  "object-property-target-index.json",
);

interface SourceObjectPropertyOscRoute {
  routeId: string;
  supportStatus: string;
}

function readReferenceHtml(): string {
  return readFileSync(htmlPath, "utf8");
}

function readCatalog(): ReferenceCatalog {
  const html = readReferenceHtml();
  const match = /<script id="reference-catalog" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  expect(match?.[1]).toBeTruthy();
  return JSON.parse((match?.[1] ?? "").replace(/<\\\//g, "</")) as ReferenceCatalog;
}

function readObjectPropertyTargetRoutes(): SourceObjectPropertyOscRoute[] {
  return JSON.parse(readFileSync(objectPropertyTargetIndexPath, "utf8")) as SourceObjectPropertyOscRoute[];
}

function allOscRoutes(catalog: ReferenceCatalog): ReferenceOscRoute[] {
  return [
    ...catalog.commands.flatMap((command) => command.oscRoutes ?? []),
    ...catalog.objects.flatMap((objectSchema) =>
      objectSchema.properties.flatMap((property) => property.oscRoutes ?? []),
    ),
  ];
}

describe("standalone reference site build", () => {
  beforeAll(() => {
    execSync("npm run build:reference", { cwd: repoRoot, stdio: "pipe" });
  }, 60_000);

  it("builds a self-contained offline HTML page", () => {
    const html = readReferenceHtml();

    expect(html).toContain('<script id="reference-catalog" type="application/json">');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).not.toContain("sourceRefs");
    expect(html).not.toContain("generatedFrom");
    expect(html).not.toContain("Catalog build —");
    expect(html).toContain("topbar__meta-short");
  });

  it("keeps the sticky detail header paint flush with the detail scroll top", () => {
    const html = readReferenceHtml();

    expect(html).toContain("padding: 0 2.5rem 4rem;");
    expect(html).toContain("margin: 0 -2.5rem 1.25rem;");
    expect(html).not.toContain("margin: -2rem -2.5rem 1.25rem;");
  });

  it("omits the navigation generated-date footer from the offline reference page", () => {
    const html = readReferenceHtml();

    expect(html).not.toContain("nav__footer");
    expect(html).not.toContain("Generated 2026-");
  });

  it("keeps mobile toolbar search and clear controls aligned", () => {
    const html = readReferenceHtml();

    expect(html).toContain(".toolbar__search {\n  grid-column: 1 / -1;");
    expect(html).toContain(".toolbar__clear {\n  grid-column: 1 / -1;");
    expect(html).toContain("min-height: 2.35rem;");
    expect(html).toContain(".toolbar__clear {\n  grid-column: 1 / -1;\n  background: transparent;");
    expect(html).toContain(".toolbar__clear[hidden]");
  });

  it("recomposes the reference layout for mobile browse and detail panels", () => {
    const html = readReferenceHtml();

    expect(html).toContain('.layout[data-mobile-panel="browse"] .col--detail');
    expect(html).toContain('.layout[data-mobile-panel="detail"] .col--nav');
    expect(html).toContain("Back to results");
    expect(html).toContain("content: attr(data-label);");
    expect(html).toContain(".object__props td::before");
    expect(html).toContain(".form__params td::before");
  });

  it("links command property coverage to Object Tree-only schemas", () => {
    const catalog = readCatalog();
    const command = catalog.commands.find((candidate) => candidate.canonical === "SetCueCaptionColor");
    const ws = catalog.objects.find((candidate) => candidate.name === "WS");
    const captionColor = ws?.properties.find((property) => property.path === "WS.N.N.CaptionColor");

    expect(command?.coverage?.setsProperty).toContain("WS.N.N.CaptionColor");
    expect(ws?.isArray).toBe(true);
    expect(captionColor?.osc).toBe("/b/WS/0/0/CaptionColor");
    expect(captionColor?.setters).toContain("SetCueCaptionColor");
  });

  it("emits public OSC control routes for commands and Object Tree properties", () => {
    const catalog = readCatalog();
    const setBpm = catalog.commands.find((candidate) => candidate.canonical === "SetBpm");
    const dmxOut = catalog.commands.find((candidate) => candidate.canonical === "DmxOut");
    const dmxOutput = catalog.objects
      .find((candidate) => candidate.name === "DmxOutput")
      ?.properties.find((property) => property.path === "DmxOutput.N");
    const zonePosX = catalog.objects
      .find((candidate) => candidate.name === "Zone")
      ?.properties.find((property) => property.path === "Zone.N.PositionX");
    const projector = catalog.objects.find((candidate) => candidate.name === "Projector");
    const projectorPositionX = projector?.properties.find((property) => property.path === "Projector.N.PositionX");
    const projectorInvertX = projector?.properties.find((property) => property.path === "Projector.N.InvertX");
    const masterLcFx1 = catalog.objects
      .find((candidate) => candidate.name === "MasterLC")
      ?.properties.find((property) => property.path === "MasterLC.FX1");

    expect(setBpm?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/general/SetBpm",
          args: ["f"],
          normalizedTargetPropertyPatterns: ["Master.BPM"],
        }),
      ]),
    );
    expect(dmxOut?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/dmx",
          args: ["f[]"],
          valueTransform: { kind: "arrayOffset", offset: 1 },
        }),
      ]),
    );
    expect(dmxOutput?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/dmx",
          args: ["f[]"],
          valueTransform: { kind: "arrayOffset", offset: 1 },
        }),
      ]),
    );
    expect(zonePosX?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/zone/<zone>/livecontrol/posx",
          args: ["f"],
        }),
      ]),
    );
    expect(projectorPositionX?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/projector/<projector>/posx",
          args: ["f"],
        }),
      ]),
    );
    expect(projectorInvertX?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/projector/<projector>/invx",
          args: ["f"],
        }),
      ]),
    );
    expect(masterLcFx1?.oscRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pathPattern: "/beyond/master/livecontrol/fx",
          args: ["f", "f", "f", "f"],
          valueTransform: { kind: "subtract", amount: 1 },
        }),
      ]),
    );
  });

  it("strips maintainer route status from public OSC control routes", () => {
    const catalog = readCatalog();
    const html = readReferenceHtml();
    const privateRouteFields = ["routeKind", "evidenceLevel", "supportStatus", "safetyTier", "linkKind"];
    const privateRouteValues = [
      "wireAccepted",
      "observedNoOp",
      "untestedDestructive",
      "inferredFromMatchedScope",
      "acceptedNoReadback",
      "notWorkingAsDocumented",
    ];
    const publishedRouteSignatures = new Set(
      allOscRoutes(catalog).map((route) => `${route.pathPattern} (${route.args.join(",")})`),
    );

    for (const route of allOscRoutes(catalog)) {
      for (const field of privateRouteFields) {
        expect(route).not.toHaveProperty(field);
      }
      if (route.valueTransform) {
        expect(route.valueTransform).not.toHaveProperty("description");
      }
    }
    for (const value of privateRouteValues) {
      expect(html).not.toContain(value);
    }
    expect(publishedRouteSignatures).not.toContain("/beyond/general/CueUp (i,i)");
    expect(publishedRouteSignatures).not.toContain("/beyond/general/CueUp (i,i,i)");
    expect(publishedRouteSignatures).not.toContain("/beyond/general/CueDown (i,i,i)");
    expect(publishedRouteSignatures).not.toContain("/beyond/general/LoadWorkspace (s)");
  });

  it("publishes every public Object Tree OSC route from the control reference", () => {
    const catalog = readCatalog();
    const publicStatuses = new Set(["confirmed", "acceptedNoReadback"]);
    const sourceRouteIds = new Set(
      readObjectPropertyTargetRoutes()
        .filter((route) => publicStatuses.has(route.supportStatus))
        .map((route) => route.routeId),
    );
    const publishedRouteIds = new Set(
      catalog.objects.flatMap((objectSchema) =>
        objectSchema.properties.flatMap((property) => property.oscRoutes?.map((route) => route.id) ?? []),
      ),
    );
    const missingRouteIds = [...sourceRouteIds].filter((routeId) => !publishedRouteIds.has(routeId)).sort();

    expect(missingRouteIds).toEqual([]);
  });

  it("labels subtract OSC value transforms with their amount", () => {
    expect(valueTransformLabel({ kind: "subtract", amount: 1 })).toBe("subtract 1");
  });

  it("renders OSC control route UI in the offline reference page", () => {
    const html = readReferenceHtml();

    expect(html).toContain("OSC routes");
    expect(html).toContain("detail__routes-list");
    expect(html).toContain("object__routes");
    expect(html).toContain("/beyond/general/SetBpm");
    expect(html).toContain("/beyond/zone/<zone>/livecontrol/posx");
    expect(html).not.toContain("Route facts");
    expect(html).not.toContain("detail__route-meta");
  });

  it("emits public Object Tree behavior classification for reference object properties", () => {
    const catalog = readCatalog();
    const master = catalog.objects.find((candidate) => candidate.name === "Master");
    const showSpeed = master?.properties.find((property) => property.path === "Master.ShowSpeed");
    const doBeep = catalog.objects
      .find((candidate) => candidate.name === "DmxIO")
      ?.properties.find((property) => property.path === "DmxIO.DoBeep");

    expect(showSpeed?.classification).toEqual({
      accessMode: "read-write",
      behaviorKind: "state-value",
      writeTestStatus: "write-readback-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
    expect(showSpeed?.propertyCard).toMatchObject({
      path: "Master.ShowSpeed",
      normalizedPath: "Master.ShowSpeed",
      detailAvailable: expect.any(Object),
      classification: showSpeed?.classification,
    });
    expect(showSpeed?.propertyCard).not.toHaveProperty("details");
    expect(showSpeed?.propertyCard).not.toHaveProperty("variants");
    expect(doBeep?.classification).toEqual({
      accessMode: "read-only",
      behaviorKind: "computed-status",
      writeTestStatus: "write-no-op-tested",
      readbackStatus: "readback-tested",
      evidenceLevel: "observed",
    });
  });

  it("reports coverage counts from the emitted reference catalog", () => {
    const catalog = readCatalog();
    const counts = {
      total: catalog.commands.length,
      mapped: 0,
      noDirectProperty: 0,
      deferred: 0,
      unknown: 0,
    };
    for (const command of catalog.commands) {
      switch (command.coverage?.status ?? "unknown") {
        case "mapped":
          counts.mapped += 1;
          break;
        case "no-direct-property":
          counts.noDirectProperty += 1;
          break;
        case "deferred":
          counts.deferred += 1;
          break;
        case "unknown":
          counts.unknown += 1;
          break;
      }
    }

    expect(catalog.meta.coverage).toEqual(counts);
  });

  it("normalizes known array schemas so setter chips resolve to OSC-backed properties", () => {
    const catalog = readCatalog();
    const zone = catalog.objects.find((candidate) => candidate.name === "Zone");
    const mute = zone?.properties.find((property) => property.path === "Zone.N.Mute");

    expect(zone?.isArray).toBe(true);
    expect(mute?.osc).toBe("/b/Zone/0/Mute");
    expect(mute?.setters).toContain("MuteZone");
  });

  it("emits probeContexts for WS and FX properties (annotation fields stripped)", () => {
    const catalog = readCatalog();
    const ws = catalog.objects.find((o) => o.name === "WS");
    const fx = catalog.objects.find((o) => o.name === "FX");

    // WS should have at least one property with cue-type probeContext
    const wsWithCtx = ws?.properties.filter((p) => p.probeContexts?.length);
    expect(wsWithCtx?.length).toBeGreaterThan(0);

    // The first cue-type context should have structural fields but no annotation fields
    const firstWsCtx = wsWithCtx?.[0]?.probeContexts?.find((c) => c.kind === "cue-type");
    expect(firstWsCtx).toMatchObject({
      id: expect.any(String),
      kind: "cue-type",
      label: expect.any(String),
      normalizedPrefix: expect.stringContaining("WS"),
      probePrefix: expect.stringContaining("WS"),
    });
    expect(firstWsCtx).not.toHaveProperty("notes");
    expect(firstWsCtx).not.toHaveProperty("populationDependent");
    expect(firstWsCtx).not.toHaveProperty("qfxPanel");
    expect(firstWsCtx).not.toHaveProperty("cellCaption");
    expect(firstWsCtx).not.toHaveProperty("channel");

    // FX should have at least one property with quickfx-effect probeContext
    const fxWithCtx = fx?.properties.filter((p) => p.probeContexts?.some((c) => c.kind === "quickfx-effect"));
    expect(fxWithCtx?.length).toBeGreaterThan(0);

    // The quickfx-effect context should have label + parentLabel for tree grouping
    const firstFxCtx = fxWithCtx?.[0]?.probeContexts?.find((c) => c.kind === "quickfx-effect");
    expect(firstFxCtx).toMatchObject({
      kind: "quickfx-effect",
      label: expect.any(String),
      parentLabel: expect.any(String),
    });
    expect(firstFxCtx).not.toHaveProperty("notes");
  });

  it("builds the FX tree with user-facing effect type groups", () => {
    const catalog = readCatalog();
    const fxTree = buildFxTree(catalog.objects);
    const groupLabels = fxTree.map((node) => node.label);

    expect(groupLabels.slice(0, 5)).toEqual([
      "Oscillating effect",
      "Key effect",
      "Color effect",
      "Zone routing",
      "More",
    ]);
    expect(groupLabels).not.toEqual(
      expect.arrayContaining(["Layer 3, Effect 1", "Layer 4, Effect 1", "Layer 5, Effect 1"]),
    );
    expect(groupLabels).not.toEqual(expect.arrayContaining(["Beam Brush", "Brightness effect", "Power effect"]));

    const childLabels = (group: string): string[] =>
      fxTree.find((node) => node.label === group)?.children?.map((node) => node.label) ?? [];
    expect(childLabels("Color effect")).toEqual(
      expect.arrayContaining(["Palette effect", "Beam Brush effect", "Brightness effect"]),
    );
    expect(childLabels("Zone routing")).toEqual(expect.arrayContaining(["Zone Chase effect", "Set Zone"]));
    expect(childLabels("More")).toEqual(expect.arrayContaining(["Path effect", "Image properties"]));

    const oscillating = fxTree.find((node) => node.label === "Oscillating effect");
    expect(oscillating?.children?.map((node) => node.label)).toEqual(["Geometric", "Color", "Waves", "Mirror"]);
  });
});
