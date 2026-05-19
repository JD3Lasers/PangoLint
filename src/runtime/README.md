# Runtime Modules

This folder owns live BEYOND interaction and transport behavior:

- Talk TCP command sending and reply parsing,
- Talk UDP payload construction and sending,
- OSC packet handling,
- BEYOND readback flows,
- Talk command-batch helpers,
- runtime lint and value-serialization gates,
- bounded `/pangolint/` OSC callback capture for Talk batch runs,
- shared VS Code runtime setting defaults,
- VS Code command registration for runtime operations.

Runtime changes cross the BEYOND safety boundary. Keep write/playback/output
behavior gated by settings, workspace trust, and operator confirmation.

BEYOND Talk is treated as straight-line command transport, not a full BEYOND
PangoScript editor runner. Talk TCP reports command status when enabled; Talk
UDP remains send-only fallback. Full scripts with labels, branches, loops,
waits, or `exit` should be pasted and run directly in BEYOND.
