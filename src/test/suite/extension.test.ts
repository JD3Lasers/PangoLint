import * as assert from "node:assert";
import * as path from "node:path";
import * as vscode from "vscode";

const fixturePath = path.resolve(__dirname, "../../../docs/runbooks/vsix-smoke-test.BeyondCode");

suite("Extension Host", () => {
  test("activation: .BeyondCode files get pangoscript language", async () => {
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    assert.strictEqual(doc.languageId, "pangoscript");
  });

  test("diagnostics: smoke fixture has 6 PangoLint diagnostics", async () => {
    const uri = vscode.Uri.file(fixturePath);
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    const diags = await waitForDiagnostics(uri, 6, 8000);
    const pangoLint = diags.filter((d) => d.source === "PangoLint");
    assert.strictEqual(pangoLint.length, 6, `Got: ${pangoLint.map((d) => diagnosticCodeValue(d)).join(", ")}`);
    const codes = pangoLint.map(diagnosticCodeValue).sort();
    assert.deepStrictEqual(codes, [
      "missing-label",
      "missing-terminal-exit",
      "unbalanced-parentheses",
      "unclosed-string",
      "uninitialized-variable",
      "unknown-command",
    ]);
  });

  test("formatting: formatter produces edits for unformatted pangoscript", async () => {
    // Open an in-memory document that the formatter will change (comma spacing).
    const doc = await vscode.workspace.openTextDocument({
      content: 'OscOutTTS "/x","s",zoneName',
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
      "vscode.executeFormatDocumentProvider",
      doc.uri,
      { tabSize: 2, insertSpaces: true },
    );
    assert.ok(
      Array.isArray(edits) && edits.length > 0,
      `Formatter not registered or produced no edits (got: ${JSON.stringify(edits)})`,
    );
    // VS Code minimizes diffs: two commas → two space-insertion edits at the comma positions.
    assert.strictEqual(edits.length, 2, "Formatter should insert spaces after both commas");
    assert.ok(
      edits.every((e) => e.newText === " "),
      "Each edit should insert exactly one space",
    );
  });

  test("hover: returns content for SelectZone command name", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "SelectZone 1",
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      new vscode.Position(0, 3),
    );
    assert.ok(
      Array.isArray(hovers) && hovers.length > 0,
      `Hover provider returned nothing (got: ${JSON.stringify(hovers)})`,
    );
    const content = hovers
      .flatMap((h) => (Array.isArray(h.contents) ? h.contents : [h.contents]))
      .map((c) => (typeof c === "string" ? c : c.value))
      .join("\n");
    assert.ok(content.includes("SelectZone"), `Hover content missing command name: ${content}`);
  });

  test("hover: returns content for ExtValue expression function", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "value = ExtValue(0, 127)",
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      doc.uri,
      new vscode.Position(0, 10),
    );
    assert.ok(
      Array.isArray(hovers) && hovers.length > 0,
      `Hover provider returned nothing (got: ${JSON.stringify(hovers)})`,
    );
    const content = hovers
      .flatMap((h) => (Array.isArray(h.contents) ? h.contents : [h.contents]))
      .map((c) => (typeof c === "string" ? c : c.value))
      .join("\n");
    assert.ok(content.includes("ExtValue"), `Hover content missing function name: ${content}`);
    assert.ok(content.includes("external control value"), `Hover content missing function description: ${content}`);
  });

  test("completion: returns SelectZone for Sel prefix", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: "Sel",
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(0, 3),
    );
    const labels = completions.items.map((item) => labelText(item.label));
    assert.ok(labels.includes("SelectZone"), `SelectZone missing from completions: ${labels.join(", ")}`);
  });

  test("completion: returns script labels after Goto", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: ["Start:", "Done: Exit", "Goto St"].join("\n"),
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      doc.uri,
      new vscode.Position(2, "Goto St".length),
    );
    const labels = completions.items.map((item) => labelText(item.label));
    assert.ok(labels.includes("Start"), `Start label missing from completions: ${labels.join(", ")}`);
  });

  test("signature help: returns OscOutTTS signature", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: 'OscOutTTS "/pangolint/smoke", ',
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const signatureHelp = await vscode.commands.executeCommand<vscode.SignatureHelp | undefined>(
      "vscode.executeSignatureHelpProvider",
      doc.uri,
      new vscode.Position(0, doc.lineAt(0).text.length),
    );
    const signatures = signatureHelp?.signatures.map((signature) => signature.label) ?? [];
    assert.ok(
      signatures.some((signature) => signature.includes("OscOutTTS")),
      `OscOutTTS missing from signature help: ${signatures.join(", ")}`,
    );
  });

  test("outline: exposes script labels as document symbols", async () => {
    const doc = await vscode.workspace.openTextDocument({
      content: ["Start:", "  SelectZone 1", "Done: exit"].join("\n"),
      language: "pangoscript",
    });
    await vscode.window.showTextDocument(doc);
    const symbols = await vscode.commands.executeCommand<Array<vscode.DocumentSymbol | vscode.SymbolInformation>>(
      "vscode.executeDocumentSymbolProvider",
      doc.uri,
    );
    const names = symbols.map((symbol) => symbol.name);
    assert.deepStrictEqual(names, ["Start", "Done"]);
  });

  test("commands: pangolint.validateCurrentScript is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("pangolint.validateCurrentScript"), "pangolint.validateCurrentScript not found");
  });

  test("commands: pangolint.checkBeyondConnection is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("pangolint.checkBeyondConnection"), "pangolint.checkBeyondConnection not found");
  });
});

async function waitForDiagnostics(
  uri: vscode.Uri,
  expectedCount: number,
  timeoutMs: number,
): Promise<vscode.Diagnostic[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const diags = vscode.languages.getDiagnostics(uri);
    if (diags.filter((d) => d.source === "PangoLint").length === expectedCount) {
      return diags;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return vscode.languages.getDiagnostics(uri);
}

function diagnosticCodeValue(diagnostic: vscode.Diagnostic): string {
  const code = diagnostic.code;
  if (typeof code === "string" || typeof code === "number") return String(code);
  if (code && typeof code === "object" && "value" in code) return String(code.value);
  return "";
}

function labelText(label: string | vscode.CompletionItemLabel): string {
  return typeof label === "string" ? label : label.label;
}
