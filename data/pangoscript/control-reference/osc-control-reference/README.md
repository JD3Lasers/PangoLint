# OSC Control Reference

This folder contains a generated reference dataset for BEYOND OSC command routes.

It complements the object-control dataset:

- `object-control-reference` describes the `/b/` object property bus.
- `osc-control-reference` describes dispatcher routes such as `/beyond/zone`,
  `/beyond/cue`, direct gateways, MIDI routes, and workspace-dependent routes.

## Files

- `summary.json`: counts and high-level notes
- `osc-routes.json`: full route records
- `osc-route-index.json`: compact route lookup records
- `object-property-target-index.json`: routes grouped by target property pattern

## Route Kinds

- `propertyMappedCommand`: route writes through the command dispatcher and maps to
  known object properties
- `dispatcherCommand`: route invokes a command, with partial or no property target
- `gatewayBus`: route writes to a direct bus such as DMX, beams, channels, or touch
- `midiGateway`: route controls MIDI integration
- `workspaceDependentCommand`: route depends on user-defined names or objects
- `writeOnlyCalibration`: route writes calibration state with no property readback

## Evidence Levels

- `observed`: property readback or external routing confirmed behavior
- `wireAccepted`: route accepted but no property readback exists
- `observedNoOp`: route accepted but tested as a no-op for the expected property
- `inferredFromMatchedScope`: inferred from matched namespace behavior
- `documented`: documented but not tested in this dataset
- `untested`: not tested or requires external workspace/device setup
