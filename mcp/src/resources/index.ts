// Registers MCP resources - agent-readable context blobs.
//
// Reference resources:
//   pangoscript://catalog/commands     curated command catalog (JSON)
//   pangoscript://catalog/property-coverage command-property mapping coverage ledger (JSON)
//   pangoscript://schemas/objects      every canonical object schema (JSON)
//   pangoscript://diagnostics/codes    diagnostics doc page (markdown)
//   pangoscript://reference/operators  operator reference (markdown)
//   pangoscript://reference/syntax     parser-shape reference (markdown)
//   pangoscript://reference/command-reference full command-reference docs (markdown)
//   pangoscript://reference/master-object-tree Object Tree root reference (markdown)
//   pangoscript://reference/object-model object model overview (markdown)
//
// Pure logic for each handler is exported below so tests can assert on
// the payload shape without spinning up an McpServer instance.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpKnowledgeBase } from "../knowledgeBase";
import { resolveDataDir } from "../knowledgeBase";

interface RegisterContext {
  knowledge: McpKnowledgeBase;
}

const URI_CATALOG = "pangoscript://catalog/commands";
const URI_PROPERTY_COVERAGE = "pangoscript://catalog/property-coverage";
const URI_SCHEMAS = "pangoscript://schemas/objects";
const URI_DIAGNOSTICS = "pangoscript://diagnostics/codes";
const URI_OPERATORS = "pangoscript://reference/operators";
const URI_SYNTAX = "pangoscript://reference/syntax";
const URI_COMMAND_REFERENCE = "pangoscript://reference/command-reference";
const URI_MASTER_OBJECT_TREE = "pangoscript://reference/master-object-tree";
const URI_OBJECT_MODEL = "pangoscript://reference/object-model";

const COMMAND_REFERENCE_DIR = "docs/references/beyond/pangoscript/command-reference";
const COMMAND_REFERENCE_META_FILES = new Set(["README.md"]);

/**
 * Build the JSON payload served by `pangoscript://catalog/commands`.
 * Returns the curated knowledge base as-is - the agent can introspect
 * commands, forms, parameters, safetyTier, evidenceLevel, and notes.
 */
export function buildCatalogPayload(knowledge: McpKnowledgeBase): string {
  return JSON.stringify(
    {
      schemaVersion: knowledge.knowledgeBase.schemaVersion,
      commands: knowledge.knowledgeBase.commands,
    },
    null,
    2,
  );
}

/**
 * Build the JSON payload served by `pangoscript://schemas/objects`.
 * Returns every canonical object schema bundled with the extension, including
 * Master, Zone, UniversePanel, and ColorChannel.
 */
export function buildSchemasPayload(knowledge: McpKnowledgeBase): string {
  const names = knowledge.propertyIndex.allObjectNames();
  const schemas = names.map((name) => knowledge.propertyIndex.getObject(name)).filter(Boolean);
  return JSON.stringify(
    {
      generatedFrom: "PangoLint MCP bundled property index",
      objects: schemas,
    },
    null,
    2,
  );
}

export function readBundledText(relativePath: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  const repoRoot = resolveDataDir(env);
  const fullPath = path.join(repoRoot, relativePath);
  if (!existsSync(fullPath)) return undefined;
  return readFileSync(fullPath, "utf8");
}

/**
 * Build one bundled markdown resource from the command-reference docs.
 * The individual files stay in the package too, but the combined resource
 * gives MCP clients a single agent-readable reference surface.
 */
export function buildCommandReferencePayload(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const repoRoot = resolveDataDir(env);
  const dir = path.join(repoRoot, COMMAND_REFERENCE_DIR);
  if (!existsSync(dir)) return undefined;

  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".md") && !COMMAND_REFERENCE_META_FILES.has(name))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) return undefined;

  const sections = ["# PangoScript Command Reference"];
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), "utf8").trimEnd();
    sections.push(`## Source: ${file}\n\n${text}`);
  }
  return `${sections.join("\n\n")}\n`;
}

/**
 * Read a markdown file from the bundled docs tree and return its text.
 * Returns `undefined` when the file is missing so the caller can
 * surface a clear error to the MCP client.
 */
export function readMarkdownDoc(relativePath: string, env: NodeJS.ProcessEnv = process.env): string | undefined {
  return readBundledText(relativePath, env);
}

/**
 * Wrap a string payload as the SDK's read-resource result shape. Pure
 * factory - no side effects.
 */
export function asResourceContents(uri: string, mimeType: string, text: string) {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}

/**
 * Resolve a bundled markdown doc to its text + UTF-8 byte size, or
 * `undefined` if the file is missing. Used at registration time so the
 * resource metadata can advertise an accurate `size` hint.
 */
function readBundledMarkdown(relativePath: string): { text: string; size: number } | undefined {
  const text = readMarkdownDoc(relativePath);
  if (text === undefined) return undefined;
  return { text, size: Buffer.byteLength(text, "utf8") };
}

export function registerResources(server: McpServer, ctx: RegisterContext): void {
  // Eagerly compute payloads + sizes at register time so resource
  // metadata advertises `size` and reads return cached bytes. The
  // knowledge base is loaded once at boot and never mutated, so this
  // single-shot stringify is safe.
  const catalogText = buildCatalogPayload(ctx.knowledge);
  const catalogSize = Buffer.byteLength(catalogText, "utf8");

  const propertyCoverageText = readBundledText("data/pangoscript/command-property-coverage.json");
  const propertyCoverageDoc =
    propertyCoverageText === undefined
      ? undefined
      : { text: propertyCoverageText, size: Buffer.byteLength(propertyCoverageText, "utf8") };

  const schemasText = buildSchemasPayload(ctx.knowledge);
  const schemasSize = Buffer.byteLength(schemasText, "utf8");

  const diagnosticsDoc = readBundledMarkdown("docs/references/diagnostics/README.md");
  const operatorsDoc = readBundledMarkdown("docs/references/operators.md");
  const syntaxDoc = readBundledMarkdown("docs/references/syntax.md");
  const commandReferenceText = buildCommandReferencePayload();
  const commandReferenceDoc =
    commandReferenceText === undefined
      ? undefined
      : { text: commandReferenceText, size: Buffer.byteLength(commandReferenceText, "utf8") };
  const masterObjectTreeDoc = readBundledMarkdown("docs/references/beyond/pangoscript/master-object-tree.md");
  const objectModelDoc = readBundledMarkdown("docs/references/beyond/pangoscript/object-model.md");

  server.registerResource(
    "catalog/commands",
    URI_CATALOG,
    {
      mimeType: "application/json",
      size: catalogSize,
      description:
        "Full curated PangoScript command catalog - canonical name, aliases, forms, parameters, safetyTier, evidenceLevel, and notes. Agents should browse this when generating PangoScript to verify command names and arity.",
    },
    async () => asResourceContents(URI_CATALOG, "application/json", catalogText),
  );

  server.registerResource(
    "catalog/property-coverage",
    URI_PROPERTY_COVERAGE,
    {
      mimeType: "application/json",
      ...(propertyCoverageDoc ? { size: propertyCoverageDoc.size } : {}),
      description:
        "Command-to-property mapping coverage ledger. Agents can use this to tell whether a command has a confirmed setsProperty mapping, no direct property mapping, deferred probe, or unknown coverage.",
    },
    async () => {
      if (!propertyCoverageDoc) throw new Error("command-property coverage ledger not found in bundled data");
      return asResourceContents(URI_PROPERTY_COVERAGE, "application/json", propertyCoverageDoc.text);
    },
  );

  server.registerResource(
    "schemas/objects",
    URI_SCHEMAS,
    {
      mimeType: "application/json",
      size: schemasSize,
      description:
        "Every canonical BEYOND object schema bundled with the linter (Master, Zone, UniversePanel, ColorChannel, FX, …). Workspace-scoped identifiers (registered universes, zone aliases) are not included.",
    },
    async () => asResourceContents(URI_SCHEMAS, "application/json", schemasText),
  );

  server.registerResource(
    "diagnostics/codes",
    URI_DIAGNOSTICS,
    {
      mimeType: "text/markdown",
      ...(diagnosticsDoc ? { size: diagnosticsDoc.size } : {}),
      description:
        "PangoLint diagnostic codes with severity, cause, and how-to-fix guidance. Use this when surfacing a lintScript hit to a user.",
    },
    async () => {
      if (!diagnosticsDoc) throw new Error("diagnostics doc not found in bundled data");
      return asResourceContents(URI_DIAGNOSTICS, "text/markdown", diagnosticsDoc.text);
    },
  );

  server.registerResource(
    "reference/operators",
    URI_OPERATORS,
    {
      mimeType: "text/markdown",
      ...(operatorsDoc ? { size: operatorsDoc.size } : {}),
      description:
        "PangoScript operator reference - assignment, comparison, bitwise, arithmetic, logical, plus case-insensitivity and string/comment rules.",
    },
    async () => {
      if (!operatorsDoc) throw new Error("operators reference not found in bundled data");
      return asResourceContents(URI_OPERATORS, "text/markdown", operatorsDoc.text);
    },
  );

  server.registerResource(
    "reference/syntax",
    URI_SYNTAX,
    {
      mimeType: "text/markdown",
      ...(syntaxDoc ? { size: syntaxDoc.size } : {}),
      description:
        "PangoScript parser-shape reference - recognized line kinds, identifier rules, label/goto behavior, loop construct, and the permissive parser posture.",
    },
    async () => {
      if (!syntaxDoc) throw new Error("syntax reference not found in bundled data");
      return asResourceContents(URI_SYNTAX, "text/markdown", syntaxDoc.text);
    },
  );

  server.registerResource(
    "reference/command-reference",
    URI_COMMAND_REFERENCE,
    {
      mimeType: "text/markdown",
      ...(commandReferenceDoc ? { size: commandReferenceDoc.size } : {}),
      description:
        "Full PangoScript command-reference markdown assembled from the curated command-reference docs. Use this when the compact catalog entry is not enough to explain how or when to use a command.",
    },
    async () => {
      if (!commandReferenceDoc) throw new Error("command-reference docs not found in bundled data");
      return asResourceContents(URI_COMMAND_REFERENCE, "text/markdown", commandReferenceDoc.text);
    },
  );

  server.registerResource(
    "reference/master-object-tree",
    URI_MASTER_OBJECT_TREE,
    {
      mimeType: "text/markdown",
      ...(masterObjectTreeDoc ? { size: masterObjectTreeDoc.size } : {}),
      description:
        "BEYOND Object Tree root reference, including object roots, indexed path conventions, and readback path notes.",
    },
    async () => {
      if (!masterObjectTreeDoc) throw new Error("master object tree reference not found in bundled data");
      return asResourceContents(URI_MASTER_OBJECT_TREE, "text/markdown", masterObjectTreeDoc.text);
    },
  );

  server.registerResource(
    "reference/object-model",
    URI_OBJECT_MODEL,
    {
      mimeType: "text/markdown",
      ...(objectModelDoc ? { size: objectModelDoc.size } : {}),
      description:
        "PangoScript object model overview for agents generating property-path reads, writes, and readback scripts.",
    },
    async () => {
      if (!objectModelDoc) throw new Error("object model reference not found in bundled data");
      return asResourceContents(URI_OBJECT_MODEL, "text/markdown", objectModelDoc.text);
    },
  );
}
