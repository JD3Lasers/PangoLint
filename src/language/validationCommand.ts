import * as vscode from "vscode";
import {
  EXTENSION_COMMAND_IDS,
  EXTENSION_OUTPUT_CHANNELS,
  EXTENSION_VIEW_IDS,
  PANGOSCRIPT_LANGUAGE_ID,
} from "../extensionHost/extensionIds";
import { formatValidationReport, type ValidationReportDiagnostic, type ValidationSeverity } from "./validationReport";

interface ValidationCommandOptions {
  diagnosticCollection: vscode.DiagnosticCollection;
  refreshDiagnostics: (document: vscode.TextDocument) => void;
}

export function registerValidationCommand(context: vscode.ExtensionContext, options: ValidationCommandOptions): void {
  const validationOutput = vscode.window.createOutputChannel(EXTENSION_OUTPUT_CHANNELS.validation);

  context.subscriptions.push(
    validationOutput,
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.validateCurrentScript, async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || document.languageId !== PANGOSCRIPT_LANGUAGE_ID) {
        void vscode.window.showWarningMessage("Open a PangoScript document before validating.");
        return;
      }
      options.refreshDiagnostics(document);
      const diagnostics = options.diagnosticCollection.get(document.uri) ?? [];
      const count = diagnostics.length;
      validationOutput.clear();
      validationOutput.appendLine(
        formatValidationReport({
          documentName: vscode.workspace.asRelativePath(document.uri, false),
          diagnostics: diagnostics.map(toValidationReportDiagnostic),
        }),
      );
      if (count > 0) {
        validationOutput.show(true);
      }
      const picked = await vscode.window.showInformationMessage(
        count === 0 ? "PangoLint: no diagnostics found." : `PangoLint: ${count} diagnostic(s) found.`,
        "Show Diagnostics",
        "Show Output",
        "Open Problems",
      );
      if (picked === "Show Diagnostics") {
        await vscode.commands.executeCommand(`${EXTENSION_VIEW_IDS.diagnostics}.focus`);
      } else if (picked === "Show Output") {
        validationOutput.show(true);
      } else if (picked === "Open Problems") {
        await vscode.commands.executeCommand("workbench.panel.markers.view.focus");
      }
    }),
  );
}

function toValidationReportDiagnostic(diagnostic: vscode.Diagnostic): ValidationReportDiagnostic {
  return {
    severity: validationSeverity(diagnostic.severity),
    code: diagnosticCodeValue(diagnostic),
    message: diagnostic.message,
    line: diagnostic.range.start.line,
    character: diagnostic.range.start.character,
  };
}

function validationSeverity(severity: vscode.DiagnosticSeverity): ValidationSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "warning";
  }
}

function diagnosticCodeValue(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code;
  if (typeof code === "string" || typeof code === "number") return String(code);
  if (code && typeof code === "object" && "value" in code) return String(code.value);
  return "unknown";
}
