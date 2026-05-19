import * as vscode from "vscode";
import type { PropertyIndex } from "../knowledge/propertyIndex";
import { requireWorkspaceTrust } from "../workspace/workspaceTrust";
import { getBeyondRuntimeConfig } from "./runtimeConfig";
import { applyReportToCache, runValidation, type ValidatedRootsCache } from "./validateObjects";

export interface RuntimeCommandHooks {
  validatedRootsCache: ValidatedRootsCache;
  getPropertyIndex: () => PropertyIndex;
  onValidatedRootsChanged: () => void;
}

export async function validateActiveDocumentAgainstBeyond(
  output: vscode.OutputChannel,
  hooks: RuntimeCommandHooks | undefined,
): Promise<void> {
  if (!hooks) {
    void vscode.window.showErrorMessage(
      "PangoLint: validate-against-BEYOND is not wired in this build (missing runtime hooks).",
    );
    return;
  }
  if (!requireWorkspaceTrust("BEYOND object validation")) return;
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "pangoscript") {
    void vscode.window.showErrorMessage("PangoLint: Open a .BeyondCode file before validating.");
    return;
  }

  const config = vscode.workspace.getConfiguration("pangolint.beyond");
  const runtimeConfig = getBeyondRuntimeConfig(config);
  const propertyIndex = hooks.getPropertyIndex();

  output.show(true);
  output.appendLine(`[${new Date().toISOString()}] validate ${editor.document.fileName}`);

  const { report, requestIdByEntry } = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PangoLint validating objects against BEYOND",
      cancellable: false,
    },
    () =>
      runValidation({
        documentText: editor.document.getText(),
        propertyIndex,
        ...runtimeConfig,
        logger: (msg) => output.appendLine(msg),
      }),
  );

  if (report.entries.length === 0) {
    output.appendLine("  (nothing to validate - every root is already grounded)");
    void vscode.window.showInformationMessage(
      "PangoLint: every property root in this file is already known. No readbacks sent.",
    );
    return;
  }

  const changed = applyReportToCache(hooks.validatedRootsCache, report, requestIdByEntry);
  if (changed.size > 0) hooks.onValidatedRootsChanged();

  output.appendLine(
    `  summary - confirmed=${report.confirmed} silent=${report.silent} unreachable=${report.unreachable}`,
  );

  const summary = `BEYOND validate: ${report.confirmed} confirmed, ${report.silent} inconclusive, ${report.unreachable} unreachable`;
  if (report.unreachable > 0 && report.confirmed === 0) {
    void vscode.window.showErrorMessage(`${summary} - check configured Talk and OSC settings.`);
  } else if (report.confirmed > 0) {
    void vscode.window.showInformationMessage(summary);
  } else {
    void vscode.window.showWarningMessage(summary);
  }
}
