// Action descriptors for the sidebar. The model exports command IDs and payload
// shapes while the view layer owns vscode.commands.registerCommand.

import {
  type CopySignaturePayload,
  type InsertAtCursorPayload,
  type OpenDiagnosticDocsPayload,
  type OpenReferencePayload,
  type RevealDiagnosticPayload,
  SIDEBAR_COMMAND_IDS,
  type SidebarCommandId,
} from "./types";

export interface InsertAtCursorAction {
  id: typeof SIDEBAR_COMMAND_IDS.insertAtCursor;
  payload: InsertAtCursorPayload;
}

export interface CopySignatureAction {
  id: typeof SIDEBAR_COMMAND_IDS.copySignature;
  payload: CopySignaturePayload;
}

export interface OpenReferenceAction {
  id: typeof SIDEBAR_COMMAND_IDS.openReference;
  payload: OpenReferencePayload;
}

export interface RevealDiagnosticAction {
  id: typeof SIDEBAR_COMMAND_IDS.revealDiagnostic;
  payload: RevealDiagnosticPayload;
}

export interface OpenDiagnosticDocsAction {
  id: typeof SIDEBAR_COMMAND_IDS.openDiagnosticDocs;
  payload: OpenDiagnosticDocsPayload;
}

export interface RefreshAction {
  id: typeof SIDEBAR_COMMAND_IDS.refresh;
  payload: Record<string, never>;
}

export type SidebarAction =
  | InsertAtCursorAction
  | CopySignatureAction
  | OpenReferenceAction
  | RevealDiagnosticAction
  | OpenDiagnosticDocsAction
  | RefreshAction;

export function insertAtCursor(snippet: string): InsertAtCursorAction {
  return { id: SIDEBAR_COMMAND_IDS.insertAtCursor, payload: { snippet } };
}

export function copySignature(text: string): CopySignatureAction {
  return { id: SIDEBAR_COMMAND_IDS.copySignature, payload: { text } };
}

export function openReference(target: string): OpenReferenceAction {
  return { id: SIDEBAR_COMMAND_IDS.openReference, payload: { target } };
}

export function revealDiagnostic(uri: string, line: number, character: number): RevealDiagnosticAction {
  return { id: SIDEBAR_COMMAND_IDS.revealDiagnostic, payload: { uri, line, character } };
}

export function openDiagnosticDocs(rule: string): OpenDiagnosticDocsAction {
  return { id: SIDEBAR_COMMAND_IDS.openDiagnosticDocs, payload: { rule } };
}

export function refresh(): RefreshAction {
  return { id: SIDEBAR_COMMAND_IDS.refresh, payload: {} };
}

export function isSidebarCommandId(value: string): value is SidebarCommandId {
  return Object.values(SIDEBAR_COMMAND_IDS).includes(value as SidebarCommandId);
}
