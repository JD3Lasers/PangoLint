// Host-side WebviewViewProvider for the Objects view. Pre-builds the
// full property tree from model data, sends it to the webview on
// `ready`, and dispatches insertAtCursor / jumpToCommand actions.

import * as vscode from "vscode";
import {
  DIST_PATH,
  SIDEBAR_MEDIA_ROOT_PATH,
  SIDEBAR_OBJECTS_CSS_PATH,
  SIDEBAR_OBJECTS_SCRIPT_PATH,
} from "../../../extensionHost/packagePaths";
import { getCueShapeProperties, getCueTypeProperties } from "../../../knowledge/cue-properties/cuePropertyPaths";
import { CUE_TYPES } from "../../../knowledge/cue-properties/cueTypes";
import type { PangoKnowledgeBase } from "../../../knowledge/knowledgeBase";
import { buildObjectPropertyCard, type ObjectPropertyCard } from "../../../knowledge/objectPropertyCards";
import type { ObjectPropertyEntry, ObjectPropertyIndex } from "../../../knowledge/objectPropertyIndex";
import { FX_MENU, type FxPropertyGroup, filterFxEffectProperties, fxPathToRelative } from "../../model/fxMenu";
import { getObjectDetail, getObjectTree, getPropertyPaths, type SidebarObjects } from "../../model/objects";
import { SIDEBAR_COMMAND_IDS } from "../../model/types";
import type { CommandsWebviewProvider } from "./commandsWebview";
import {
  isObjectsWebviewToHostMessage,
  type ObjectsHostToWebviewMessage,
  type ObjectsTreeNode,
  type ObjectsWebviewToHostMessage,
} from "./objectsMessages";

const OBJECT_DISPLAY_NAMES: Record<string, string> = {
  FX: "QuickFX",
};

/** Inverts setsProperty from the merged knowledge base: property path → command names[]. */
function buildPropertyCommandsIndex(kb: PangoKnowledgeBase): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const entry of Object.values(kb.commands)) {
    for (const prop of entry.setsProperty ?? []) {
      const existing = index.get(prop);
      if (existing) {
        existing.push(entry.canonical);
      } else {
        index.set(prop, [entry.canonical]);
      }
    }
  }
  return index;
}

function propertyCardForPath(index: ObjectPropertyIndex, path: string): ObjectPropertyCard | undefined {
  const entry = index.lookup(path)?.entry;
  if (!entry) return undefined;
  return buildObjectPropertyCard(entry);
}

function buildFxEffectNode(
  typeLabel: string,
  label: string,
  group: FxPropertyGroup,
  fxEntries: readonly ObjectPropertyEntry[],
  propCmds: Map<string, string[]>,
  objectPropertyIndex: ObjectPropertyIndex,
): ObjectsTreeNode {
  const props = filterFxEffectProperties(typeLabel, label, group, fxEntries);
  if (!props.length) return { label };
  return {
    label,
    children: props.map((p) => {
      const rel = fxPathToRelative(p);
      const commands = propCmds.get(rel);
      const propertyCard = propertyCardForPath(objectPropertyIndex, p);
      return commands?.length
        ? { label: rel, path: rel, commands, propertyCard }
        : { label: rel, path: rel, propertyCard };
    }),
  };
}

function leafNode(path: string, propCmds: Map<string, string[]>, propertyCard?: ObjectPropertyCard): ObjectsTreeNode {
  const commands = propCmds.get(path);
  return commands?.length ? { label: path, path, commands, propertyCard } : { label: path, path, propertyCard };
}

function buildObjectsTree(
  objects: SidebarObjects,
  objectPropertyIndex: ObjectPropertyIndex,
  propCmds: Map<string, string[]>,
): ObjectsTreeNode[] {
  const fxEntries = objectPropertyIndex.allEntries();
  const fxChildren: ObjectsTreeNode[] = FX_MENU.map((fxType) => {
    const effectCount = fxType.subcategories
      ? fxType.subcategories.reduce((n, sub) => n + sub.effects.length, 0)
      : (fxType.effects?.length ?? 0);
    let children: ObjectsTreeNode[];
    if (fxType.subcategories) {
      children = fxType.subcategories.map((sub) => ({
        label: sub.label,
        description: `${sub.effects.length} effects`,
        children: sub.effects.map((lbl) =>
          buildFxEffectNode(fxType.label, lbl, fxType.group, fxEntries, propCmds, objectPropertyIndex),
        ),
      }));
    } else {
      children = (fxType.effects ?? []).map((lbl) =>
        buildFxEffectNode(fxType.label, lbl, fxType.group, fxEntries, propCmds, objectPropertyIndex),
      );
    }
    return { label: fxType.label, description: `${effectCount} effects`, children };
  });

  const cueChildren: ObjectsTreeNode[] = CUE_TYPES.map((entry) => {
    let children: ObjectsTreeNode[];
    if (entry.shapes) {
      children = entry.shapes.map((shape) => ({
        label: shape.label,
        description: `${shape.uniqueProperties.length} unique props`,
        children: getCueShapeProperties(shape, entry).map((p) =>
          leafNode(p, propCmds, propertyCardForPath(objectPropertyIndex, p)),
        ),
      }));
    } else {
      children = getCueTypeProperties(entry).map((p) =>
        leafNode(p, propCmds, propertyCardForPath(objectPropertyIndex, p)),
      );
    }
    const description = entry.shapes
      ? `${entry.shapes.length} shapes`
      : entry.uniqueProperties.length > 0
        ? `${entry.uniqueProperties.length} unique props`
        : "common only";
    return { label: entry.label, description, children };
  });

  const objectNodes: ObjectsTreeNode[] = [];
  for (const summary of getObjectTree(objects)) {
    const detail = getObjectDetail(objects, summary.name);
    if (!detail) continue;
    const propLabel = summary.propertyCount === 1 ? "property" : "properties";
    objectNodes.push({
      label: OBJECT_DISPLAY_NAMES[summary.name] ?? summary.name,
      description: `${summary.propertyCount} ${propLabel}${summary.isArray ? " · indexed" : ""}`,
      children: getPropertyPaths(detail).map((p) => leafNode(p, propCmds, propertyCardForPath(objectPropertyIndex, p))),
    });
  }

  return [
    { label: "FX Effects", description: "Effect type browser", children: fxChildren },
    { label: "Cue Types", description: "Cue type browser", children: cueChildren },
    ...objectNodes,
  ];
}

function generateNonce(): string {
  let result = "";
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let i = 0; i < 32; i += 1) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export class ObjectsWebviewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private readonly propCmds: Map<string, string[]>;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly objects: SidebarObjects,
    private readonly objectPropertyIndex: ObjectPropertyIndex,
    knowledgeBase: PangoKnowledgeBase,
    private readonly commandsWebview: CommandsWebviewProvider | undefined = undefined,
  ) {
    this.propCmds = buildPropertyCommandsIndex(knowledgeBase);
  }

  resolveWebviewView(
    view: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, ...SIDEBAR_MEDIA_ROOT_PATH),
        vscode.Uri.joinPath(this.extensionUri, ...DIST_PATH),
      ],
    };
    view.webview.html = this.buildHtml(view.webview);
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!isObjectsWebviewToHostMessage(message)) return;
      void this.handleMessage(message);
    });
  }

  refresh(): void {
    this.postInit();
  }

  private postInit(): void {
    if (!this.view) return;
    const sections = buildObjectsTree(this.objects, this.objectPropertyIndex, this.propCmds);
    void this.view.webview.postMessage({
      type: "init",
      payload: { sections },
    } satisfies ObjectsHostToWebviewMessage);
  }

  private async handleMessage(message: ObjectsWebviewToHostMessage): Promise<void> {
    switch (message.type) {
      case "ready":
        this.postInit();
        return;
      case "insertAtCursor":
        await vscode.commands.executeCommand(SIDEBAR_COMMAND_IDS.insertAtCursor, { snippet: message.snippet });
        return;
      case "copyPath":
        await vscode.env.clipboard.writeText(message.text);
        await vscode.window.showInformationMessage(`PangoLint: copied "${message.text}".`);
        return;
      case "jumpToCommand": {
        interface ActionItem extends vscode.QuickPickItem {
          action: "insert" | "view";
          cmd: string;
        }
        const { commands } = message;
        const insertItems: ActionItem[] = commands.map((cmd) => ({
          label: cmd,
          description: "Insert at cursor",
          action: "insert",
          cmd,
        }));
        const viewItems: ActionItem[] = commands.map((cmd) => ({
          label: cmd,
          description: "View in Commands sidebar",
          action: "view",
          cmd,
        }));
        const items: vscode.QuickPickItem[] = [
          { label: "Insert at cursor", kind: vscode.QuickPickItemKind.Separator },
          ...insertItems,
          { label: "View in Commands sidebar", kind: vscode.QuickPickItemKind.Separator },
          ...viewItems,
        ];
        const picked = await vscode.window.showQuickPick(items, {
          title: "Property commands",
          placeHolder: "Select an action",
        });
        if (!picked || !("action" in picked)) return;
        const item = picked as ActionItem;
        if (item.action === "insert") {
          await vscode.commands.executeCommand(SIDEBAR_COMMAND_IDS.insertAtCursor, { snippet: item.cmd });
        } else {
          this.commandsWebview?.showCommand(item.cmd);
        }
        return;
      }
    }
  }

  private buildHtml(webview: vscode.Webview): string {
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...SIDEBAR_OBJECTS_CSS_PATH));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...SIDEBAR_OBJECTS_SCRIPT_PATH));
    const nonce = generateNonce();
    return /* html */ `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <title>PangoLint Objects</title>
    <link href="${stylesUri}" rel="stylesheet" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}
