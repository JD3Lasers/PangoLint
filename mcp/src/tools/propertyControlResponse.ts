import type {
  McpPropertyControlCommand,
  McpPropertyControlEntry,
  McpPropertyControlObjectContext,
  McpPropertyControlOscRoute,
  McpPropertyControlParameterRange,
} from "../../../src/knowledge/mcpKnowledgeExports";

export const PROPERTY_CONTROL_RESPONSE_LIMITS = {
  defaultExampleLimit: 3,
  maxExampleLimit: 8,
} as const;

export interface PropertyControlDetailInput {
  includeDetails?: boolean;
  commandLimit?: number;
  oscRouteLimit?: number;
  objectContextLimit?: number;
  objectBusPathLimit?: number;
  parameterRangeLimit?: number;
}

interface ResolvedPropertyControlLimits {
  commandLimit: number;
  oscRouteLimit: number;
  objectContextLimit: number;
  objectBusPathLimit: number;
  parameterRangeLimit: number;
}

export interface PropertyControlCard {
  path: string;
  label: string;
  root: string;
  property: string;
  kind: string;
  confidence?: string;
  coverage: Record<string, boolean>;
  objectTree: {
    path?: string;
    normalizedPath?: string;
    directBusPath?: string;
    variantCount?: number;
    contextCount: number;
    contexts: McpPropertyControlObjectContext[];
    objectBusPathCount: number;
    objectBusPaths: string[];
    omitted: {
      contexts: number;
      objectBusPaths: number;
    };
  };
  value?: McpPropertyControlEntry["value"];
  readback?: McpPropertyControlEntry["readback"];
  behavior?: McpPropertyControlEntry["behavior"];
  pangoScript: {
    commandCount: number;
    commands: McpPropertyControlCommand[];
    parameterRangeCount: number;
    parameterRanges: McpPropertyControlParameterRange[];
    omitted: {
      commands: number;
      parameterRanges: number;
    };
  };
  osc: {
    routeCount: number;
    routes: McpPropertyControlOscRoute[];
    omitted: {
      routes: number;
    };
  };
  detailAvailable: McpPropertyControlEntry["detailAvailable"];
  limits: ResolvedPropertyControlLimits;
}

export function buildPropertyControlCard(
  entry: McpPropertyControlEntry,
  detailInput: PropertyControlDetailInput = {},
): PropertyControlCard {
  const limits = resolvePropertyControlLimits(detailInput);
  const contexts = entry.objectTree.contexts.slice(0, limits.objectContextLimit);
  const objectBusPaths = entry.objectTree.objectBusPaths.slice(0, limits.objectBusPathLimit);
  const commands = entry.pangoScript.commands.slice(0, limits.commandLimit);
  const parameterRanges = entry.pangoScript.parameterRanges.slice(0, limits.parameterRangeLimit);
  const routes = entry.osc.routes.slice(0, limits.oscRouteLimit);

  return {
    path: entry.path,
    label: entry.label,
    root: entry.root,
    property: entry.property,
    kind: entry.kind,
    confidence: entry.confidence,
    coverage: entry.coverage,
    objectTree: {
      path: entry.objectTree.path,
      normalizedPath: entry.objectTree.normalizedPath,
      directBusPath: entry.objectTree.directBusPath,
      variantCount: entry.objectTree.variantCount,
      contextCount: entry.objectTree.contextCount,
      contexts,
      objectBusPathCount: entry.objectTree.objectBusPathCount,
      objectBusPaths,
      omitted: {
        contexts: Math.max(0, entry.objectTree.contextCount - contexts.length),
        objectBusPaths: Math.max(0, entry.objectTree.objectBusPathCount - objectBusPaths.length),
      },
    },
    value: entry.value,
    readback: entry.readback,
    behavior: entry.behavior,
    pangoScript: {
      commandCount: entry.pangoScript.commandCount,
      commands,
      parameterRangeCount: entry.pangoScript.parameterRangeCount,
      parameterRanges,
      omitted: {
        commands: Math.max(0, entry.pangoScript.commandCount - commands.length),
        parameterRanges: Math.max(0, entry.pangoScript.parameterRangeCount - parameterRanges.length),
      },
    },
    osc: {
      routeCount: entry.osc.routeCount,
      routes,
      omitted: {
        routes: Math.max(0, entry.osc.routeCount - routes.length),
      },
    },
    detailAvailable: entry.detailAvailable,
    limits,
  };
}

function resolvePropertyControlLimits(input: PropertyControlDetailInput): ResolvedPropertyControlLimits {
  const fallback = input.includeDetails
    ? PROPERTY_CONTROL_RESPONSE_LIMITS.maxExampleLimit
    : PROPERTY_CONTROL_RESPONSE_LIMITS.defaultExampleLimit;
  return {
    commandLimit: resolveLimit(input.commandLimit, fallback),
    oscRouteLimit: resolveLimit(input.oscRouteLimit, fallback),
    objectContextLimit: resolveLimit(input.objectContextLimit, fallback),
    objectBusPathLimit: resolveLimit(input.objectBusPathLimit, fallback),
    parameterRangeLimit: resolveLimit(input.parameterRangeLimit, fallback),
  };
}

function resolveLimit(raw: number | undefined, fallback: number): number {
  if (raw === undefined || !Number.isFinite(raw)) return fallback;
  if (raw <= 0) return fallback;
  return Math.min(Math.floor(raw), PROPERTY_CONTROL_RESPONSE_LIMITS.maxExampleLimit);
}
