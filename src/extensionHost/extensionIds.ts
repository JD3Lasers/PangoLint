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
  talkTcpEchoMode: "talkTcpEchoMode",
  oscListenHost: "oscListenHost",
  oscListenPort: "oscListenPort",
  readbackTimeoutMs: "readbackTimeoutMs",
  liveHoverValues: "liveHoverValues",
  allowScriptExecution: "allowScriptExecution",
  confirmRunEachSession: "confirmRunEachSession",
} as const;

export const EXTENSION_SETTING_IDS = {
  folderScopedUniverses: `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.folderScopedUniverses}`,
  codeLensLabelReferences: `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.codeLensLabelReferences}`,
  diagnosticsHighlightStyle: `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.diagnosticsHighlightStyle}`,
  diagnosticsInlineMessages: `${EXTENSION_CONFIG_SECTIONS.pangolint}.${EXTENSION_SETTING_KEYS.diagnosticsInlineMessages}`,
  talkHost: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkHost}`,
  talkPort: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkPort}`,
  talkTransport: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkTransport}`,
  talkTcpHost: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkTcpHost}`,
  talkTcpPort: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkTcpPort}`,
  talkUdpHost: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkUdpHost}`,
  talkUdpPort: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkUdpPort}`,
  talkUdpFallbackAllowed: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkUdpFallbackAllowed}`,
  talkTcpPassword: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkTcpPassword}`,
  talkTcpEchoMode: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.talkTcpEchoMode}`,
  oscListenHost: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.oscListenHost}`,
  oscListenPort: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.oscListenPort}`,
  readbackTimeoutMs: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.readbackTimeoutMs}`,
  liveHoverValues: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.liveHoverValues}`,
  allowScriptExecution: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.allowScriptExecution}`,
  confirmRunEachSession: `${EXTENSION_CONFIG_SECTIONS.beyond}.${EXTENSION_SETTING_KEYS.confirmRunEachSession}`,
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
