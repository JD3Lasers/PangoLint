import * as vscode from "vscode";
import { EXTENSION_COMMAND_IDS } from "../extensionHost/extensionIds";
import { addUserObject, removeUserObject, type UserObjectKind, type UserObjectsRegistry } from "./userObjects";
import { requireWorkspaceTrust } from "./workspaceTrust";

interface UserObjectCommandsOptions {
  refreshUserObjects: () => Promise<void>;
  getWorkspaceFolder: () => string | undefined;
  getUserObjectsRegistry: () => UserObjectsRegistry;
}

export function registerUserObjectCommands(context: vscode.ExtensionContext, options: UserObjectCommandsOptions): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.addUserObject, async (name: string, kind: UserObjectKind) => {
      if (!requireWorkspaceTrust("user-object registry writes")) return;
      const workspaceFolder = options.getWorkspaceFolder();
      if (!workspaceFolder) {
        void vscode.window.showWarningMessage("PangoLint: open a workspace folder first.");
        return;
      }
      try {
        addUserObject(workspaceFolder, name, kind);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`PangoLint: ${message}`);
        return;
      }
      await options.refreshUserObjects();
      void vscode.window.showInformationMessage(`PangoLint: added '${name}' as ${kind}.`);
    }),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.removeUserObject, async () => {
      if (!requireWorkspaceTrust("user-object registry writes")) return;
      const workspaceFolder = options.getWorkspaceFolder();
      if (!workspaceFolder) {
        void vscode.window.showWarningMessage("PangoLint: open a workspace folder first.");
        return;
      }
      const registry = options.getUserObjectsRegistry();
      const names = registry.names();
      if (names.length === 0) {
        void vscode.window.showInformationMessage("PangoLint: no user objects to remove.");
        return;
      }
      const picked = await vscode.window.showQuickPick(names, {
        placeHolder: "Pick a user object to remove",
      });
      if (!picked) return;
      try {
        removeUserObject(workspaceFolder, picked);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`PangoLint: ${message}`);
        return;
      }
      await options.refreshUserObjects();
      void vscode.window.showInformationMessage(`PangoLint: removed '${picked}' from user objects.`);
    }),
    vscode.commands.registerCommand(EXTENSION_COMMAND_IDS.showUserObjects, () => {
      const registry = options.getUserObjectsRegistry();
      const lines: string[] = [`PangoLint user objects (${registry.size()} entries):`, ""];
      for (const name of registry.names()) {
        const entry = registry.get(name);
        lines.push(`  ${name}  [${entry?.kind ?? "?"}]`);
      }
      void vscode.window.showInformationMessage(lines.join("\n"), { modal: true });
    }),
  );
}
