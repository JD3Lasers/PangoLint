# Runtime Modules

This folder owns live BEYOND interaction and transport behavior:

- Talk UDP payload construction and sending,
- OSC packet handling,
- BEYOND readback flows,
- Talk UDP command-batch helpers,
- runtime lint and value-serialization gates,
- bounded `/pangolint/` OSC callback capture for Talk batch runs,
- shared VS Code runtime setting defaults,
- VS Code command registration for runtime operations.

Runtime changes cross the BEYOND safety boundary. Keep write/playback/output
behavior gated by settings, workspace trust, and operator confirmation.

Talk UDP is treated as straight-line command transport, not a full BEYOND
PangoScript editor runner. Full scripts with labels, branches, loops, waits, or
`exit` should be pasted and run directly in BEYOND.
