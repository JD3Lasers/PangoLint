# Runtime Modules

This folder owns live BEYOND interaction and transport behavior. Runtime code
is grouped by responsibility so protocol modules, readback workflows, command
batch safety gates, and VS Code adapter code can be reviewed separately.

- `talk/`: Talk TCP command sending, reply parsing, and Talk UDP payload
  construction.
- `osc/`: OSC packet handling, capture sessions, and OSC port serialization.
- `readback/`: BEYOND readback flows and object validation readbacks.
- `commandBatch/`: Talk command-batch sending, control-flow refusal, runtime
  lint gating, and object value assignment text.
- `vscode/`: VS Code command registration, output formatting, confirmation
  prompts, and live value hover integration.
- `runtimeConfig.ts` and `runtimeOptions.ts`: shared VS Code runtime setting
  defaults and option mapping.

Runtime changes cross the BEYOND safety boundary. Keep write/playback/output
behavior gated by settings, workspace trust, and operator confirmation.

BEYOND Talk is treated as straight-line command transport, not a full BEYOND
PangoScript editor runner. Talk TCP reports command status when enabled; Talk
UDP remains send-only fallback. Full scripts with labels, branches, loops,
waits, or `exit` should be pasted and run directly in BEYOND.
