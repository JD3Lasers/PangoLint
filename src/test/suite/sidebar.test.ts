import * as assert from "node:assert";
import * as vscode from "vscode";

const EXTENSION_ID = "jd3.pangolint";

const EXPECTED_SIDEBAR_COMMANDS = [
  "pangolint.sidebar.clearFilter",
  "pangolint.sidebar.copySignature",
  "pangolint.sidebar.filterCommands",
  "pangolint.sidebar.insertAtCursor",
  "pangolint.sidebar.insertSelectedCommand",
  "pangolint.sidebar.openDiagnosticDocs",
  "pangolint.sidebar.openReference",
  "pangolint.sidebar.refresh",
  "pangolint.sidebar.revealDiagnostic",
  "pangolint.sidebar.showCommand",
  "pangolint.sidebar.showCommandAtCursor",
];

suite("Extension Host: Sidebar (Phase 1)", () => {
  suiteSetup(async () => {
    // showTextDocument does not await activation; awaiting the extension
    // explicitly is the only way to guarantee the pangolint.sidebar.*
    // commands are registered before the assertions below run.
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `Extension '${EXTENSION_ID}' not found in extension host.`);
    await extension.activate();
  });

  test("sidebar action commands are registered after activation", async () => {
    const commands = await vscode.commands.getCommands(true);
    const sidebarCommands = commands.filter((id) => id.startsWith("pangolint.sidebar.")).sort();
    assert.deepStrictEqual(
      sidebarCommands,
      EXPECTED_SIDEBAR_COMMANDS,
      `Sidebar commands missing or extra: ${sidebarCommands.join(", ")}`,
    );
  });

  test("pangolint.sidebar.refresh resolves without throwing", async () => {
    await vscode.commands.executeCommand("pangolint.sidebar.refresh");
  });

  test("insertAtCursor refuses to edit non-PangoScript documents", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "keep me",
      language: "markdown",
    });
    await vscode.window.showTextDocument(doc);

    await vscode.commands.executeCommand("pangolint.sidebar.insertAtCursor", {
      snippet: 'OscOutString "/x", "s", "v"',
    });

    assert.strictEqual(doc.getText(), "keep me");
  });
});
