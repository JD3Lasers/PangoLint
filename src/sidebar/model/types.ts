// Renderer-agnostic data shapes for the PangoLint activity-bar sidebar.
// Must not import vscode.TreeItem / vscode.TreeView / vscode.WebviewView so
// a future webview renderer can consume these types unchanged.
//
// SidebarSafetyTier / SidebarEvidenceLevel mirror the canonical
// `SafetyTier` / `EvidenceLevel` types from src/knowledge/knowledgeBase.ts
// - duplicated here as plain string-literal unions so the webview
// bundle's tsconfig can type-check this file without pulling in the
// node-side knowledge-base modules (which import `node:fs`).

import { EXTENSION_COMMAND_IDS } from "../../extensionHost/extensionIds";

export type SidebarSafetyTier = "T0" | "T1" | "T2" | "T3" | "T4" | "unknown";
export type SidebarEvidenceLevel = "exported" | "documented" | "observed" | "inferred" | "unverified";

export interface CommandSummary {
  canonical: string;
  /** Sidebar item kind; commands are executable statements, functions are expression helpers. */
  kind?: "command" | "function";
  aliases: string[];
  description: string;
  signature: string;
  safetyTier: SidebarSafetyTier;
  evidenceLevel: SidebarEvidenceLevel;
  /** BEYOND-native category from the command tree. */
  category: string;
}

export interface CommandDetail extends CommandSummary {
  signatures: SignatureDetail[];
  notes: NoteDetail[];
  tags: string[];
  /** Object property paths this command writes, when directly mapped. */
  setsProperty: string[];
  /** Primary example text used for the tooltip and the Insert action. */
  example: string;
}

export interface SignatureDetail {
  signature: string;
  description?: string;
  parameters: ParameterDetail[];
}

export interface ParameterDetail {
  name: string;
  type: string;
  required: boolean;
  range?: string;
  valueRange?: ParameterValueRange;
  acceptedValues?: ParameterAcceptedValue[];
  description?: string;
}

export type ParameterBoundaryBehavior = "clamp" | "reject" | "no-op" | "wrap" | "pass-through" | "unknown";

export interface ParameterValueRange {
  min?: number;
  max?: number;
  minInclusive?: boolean;
  maxInclusive?: boolean;
  unit?: string;
  boundaryBehavior?: ParameterBoundaryBehavior;
  evidenceLevel?: SidebarEvidenceLevel;
  notes?: string;
}

export interface ParameterAcceptedValue {
  value: string | number | boolean;
  label?: string;
  description?: string;
}

export interface NoteDetail {
  text: string;
}

export interface ObjectSummary {
  name: string;
  isArray: boolean;
  propertyCount: number;
  inheritedFrom?: string;
}

export interface ObjectDetail extends ObjectSummary {
  properties: string[];
  arrayIndices?: string[];
  perIndexSchemas?: Record<string, string>;
}

export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface DiagnosticInput {
  rule: string;
  severity: DiagnosticSeverity;
  message: string;
  uri: string;
  line: number;
  character: number;
  source?: string;
}

export interface DiagnosticGroup {
  rule: string;
  severity: DiagnosticSeverity;
  count: number;
  entries: DiagnosticInput[];
}

export interface FilterState {
  query?: string;
  /** Category multi-select. Empty/undefined means no category constraint. */
  categories?: string[];
}

/**
 * Stable command IDs the view layer registers and the model surfaces from
 * action descriptors. View renderers wire their click / message handlers
 * to these IDs so swapping renderers does not break command bindings.
 */
export const SIDEBAR_COMMAND_IDS = {
  insertAtCursor: EXTENSION_COMMAND_IDS.sidebarInsertAtCursor,
  copySignature: EXTENSION_COMMAND_IDS.sidebarCopySignature,
  openReference: EXTENSION_COMMAND_IDS.sidebarOpenReference,
  revealDiagnostic: EXTENSION_COMMAND_IDS.sidebarRevealDiagnostic,
  openDiagnosticDocs: EXTENSION_COMMAND_IDS.sidebarOpenDiagnosticDocs,
  refresh: EXTENSION_COMMAND_IDS.sidebarRefresh,
  filterCommands: EXTENSION_COMMAND_IDS.sidebarFilterCommands,
  clearFilter: EXTENSION_COMMAND_IDS.sidebarClearFilter,
  insertSelectedCommand: EXTENSION_COMMAND_IDS.sidebarInsertSelectedCommand,
  showCommand: EXTENSION_COMMAND_IDS.sidebarShowCommand,
  showCommandAtCursor: EXTENSION_COMMAND_IDS.sidebarShowCommandAtCursor,
} as const;

export type SidebarCommandId = (typeof SIDEBAR_COMMAND_IDS)[keyof typeof SIDEBAR_COMMAND_IDS];

export interface InsertAtCursorPayload {
  snippet: string;
}

export interface CopySignaturePayload {
  text: string;
}

export interface OpenReferencePayload {
  /** Source URL, file path, or vscode.Uri-compatible string. */
  target: string;
}

export interface RevealDiagnosticPayload {
  uri: string;
  line: number;
  character: number;
}

export interface OpenDiagnosticDocsPayload {
  rule: string;
}
