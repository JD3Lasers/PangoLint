export const PANGOSCRIPT_LANGUAGE_ID = "pangoscript";

export const PANGOLINT_DIAGNOSTIC_SOURCE = "PangoLint";

export const EXTENSION_CONFIG_SECTIONS = {
  pangolint: "pangolint",
  beyond: "pangolint.beyond",
} as const;

export const EXTENSION_SETTING_KEYS = {
  folderScopedUniverses: "folderScopedUniverses",
  codeLensLabelReferences: "codeLens.labelReferences",
  diagnosticsHighlightStyle: "diagnostics.highlightStyle",
  diagnosticsInlineMessages: "diagnostics.inlineMessages",
  talkHost: "talkHost",
  talkPort: "talkPort",
  talkTransport: "talkTransport",
  talkTcpHost: "talkTcpHost",
  talkTcpPort: "talkTcpPort",
  talkUdpHost: "talkUdpHost",
  talkUdpPort: "talkUdpPort",
  talkUdpFallbackAllowed: "talkUdpFallbackAllowed",
  talkTcpPassword: "talkTcpPassword",
  oscListenHost: "oscListenHost",
  oscListenPort: "oscListenPort",
  readbackTimeoutMs: "readbackTimeoutMs",
  liveHoverValues: "liveHoverValues",
  allowScriptExecution: "allowScriptExecution",
  confirmRunEachSession: "confirmRunEachSession",
} as const;

export const EXTENSION_COMMAND_IDS = {
  validateCurrentScript: "pangolint.validateCurrentScript",
  checkBeyondConnection: "pangolint.checkBeyondConnection",
  addUserObject: "pangolint.addUserObject",
  removeUserObject: "pangolint.removeUserObject",
  showUserObjects: "pangolint.showUserObjects",
  runScript: "pangolint.runScript",
  runSelection: "pangolint.runSelection",
  fetchObjectValue: "pangolint.fetchObjectValue",
  setObjectValue: "pangolint.setObjectValue",
  replayLastScript: "pangolint.replayLastScript",
  pinToWatcher: "pangolint.pinToWatcher",
  unpinFromWatcher: "pangolint.unpinFromWatcher",
  refreshWatcher: "pangolint.refreshWatcher",
  clearWatcher: "pangolint.clearWatcher",
  validateObjectsAgainstBeyond: "pangolint.validateObjectsAgainstBeyond",
  openReferenceSite: "pangolint.openReferenceSite",
  sidebarRefresh: "pangolint.sidebar.refresh",
  sidebarInsertAtCursor: "pangolint.sidebar.insertAtCursor",
  sidebarCopySignature: "pangolint.sidebar.copySignature",
  sidebarOpenReference: "pangolint.sidebar.openReference",
  sidebarRevealDiagnostic: "pangolint.sidebar.revealDiagnostic",
  sidebarOpenDiagnosticDocs: "pangolint.sidebar.openDiagnosticDocs",
  sidebarFilterCommands: "pangolint.sidebar.filterCommands",
  sidebarClearFilter: "pangolint.sidebar.clearFilter",
  sidebarInsertSelectedCommand: "pangolint.sidebar.insertSelectedCommand",
  sidebarShowCommand: "pangolint.sidebar.showCommand",
  sidebarShowCommandAtCursor: "pangolint.sidebar.showCommandAtCursor",
} as const;

export const EXTENSION_VIEW_IDS = {
  commands: "pangolint.commandsView",
  objects: "pangolint.objectsView",
  diagnostics: "pangolint.diagnosticsView",
  watcher: "pangolintWatcher",
} as const;

export const EXTENSION_WORKSPACE_STATE_KEYS = {
  watchedPaths: "pangolint.watchedPaths",
} as const;

export const EXTENSION_OUTPUT_CHANNELS = {
  run: "PangoLint: Run",
  validation: "PangoLint: Validation",
} as const;
