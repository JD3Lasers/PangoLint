// Typed message protocol between the Objects webview and its host
// (ObjectsWebviewProvider). Minimal: the webview renders a pre-built
// tree and only sends bounded insert / navigation actions back to the host.

interface ObjectsValueSummary {
  valueType?: string;
  range?: {
    min?: number;
    max?: number;
    dynamicMaxExpression?: string;
    minInclusive?: boolean;
    maxInclusive?: boolean;
    unit?: string;
    boundaryBehavior?: string;
    evidenceLevel?: string;
  };
  acceptedValueCount?: number;
  unit?: string;
  defaultValue?: string | number | boolean;
  evidenceLevel?: string;
  locationKind?: string;
  contextValueMetadataCount?: number;
}

interface ObjectsReadbackSummary {
  status: string;
  probePath?: string;
  valueType?: string;
  typeTag?: string;
  evidenceLevel?: string;
  observedValue?: string | number | boolean | null;
  locationKind?: string;
}

interface ObjectsBehaviorClassification {
  accessMode: string;
  behaviorKind: string;
  writeTestStatus: string;
  readbackStatus: string;
  evidenceLevel: string;
}

interface ObjectsPropertyCard {
  path: string;
  normalizedPath: string;
  root: string;
  property: string;
  kind: string;
  osc?: string;
  confidence: string;
  variantCount: number;
  valueSummary?: ObjectsValueSummary;
  readbackSummary?: ObjectsReadbackSummary;
  classification?: ObjectsBehaviorClassification;
  detailAvailable: {
    variants: number;
    probeContexts: number;
    contextValueMetadata: number;
  };
}

export interface ObjectsTreeNode {
  label: string;
  description?: string;
  path?: string;
  /** Commands that write this property path (populated from setsProperty in the knowledge base). */
  commands?: string[];
  propertyCard?: ObjectsPropertyCard;
  children?: ObjectsTreeNode[];
}

export interface ObjectsInitPayload {
  sections: ObjectsTreeNode[];
}

// ============================================================
// HOST → WEBVIEW
// ============================================================

export type ObjectsHostToWebviewMessage = {
  type: "init";
  payload: ObjectsInitPayload;
};

// ============================================================
// WEBVIEW → HOST
// ============================================================

export type ObjectsWebviewToHostMessage =
  | { type: "ready" }
  | { type: "insertAtCursor"; snippet: string }
  | { type: "copyPath"; text: string }
  | { type: "jumpToCommand"; commands: string[] };

export function isObjectsWebviewToHostMessage(value: unknown): value is ObjectsWebviewToHostMessage {
  if (!value || typeof value !== "object") return false;
  const c = value as { commands?: unknown; snippet?: unknown; type?: unknown };
  if (c.type === "ready") return true;
  if (c.type === "insertAtCursor") return typeof c.snippet === "string";
  if (c.type === "copyPath") return typeof (c as { text?: unknown }).text === "string";
  if (c.type === "jumpToCommand") {
    return Array.isArray(c.commands) && c.commands.every((command) => typeof command === "string");
  }
  return false;
}
