import * as vscode from "vscode";

export function requireWorkspaceTrust(feature: string): boolean {
  if (vscode.workspace.isTrusted) return true;
  void vscode.window.showWarningMessage(`PangoLint: ${feature} is disabled until this workspace is trusted.`);
  return false;
}
