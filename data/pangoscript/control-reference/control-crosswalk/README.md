# Control Crosswalk

This folder contains a generated property-first lookup table.

Use it to answer which object contexts expose a property, which PangoScript
commands can control it, which OSC command routes can control it, which direct
object bus paths exist, and whether range data is already known.

## Files

- `summary.json`: counts and coverage totals
- `property-control-index.json`: full property-first lookup data
- `property-control-index.jsonl`: one JSON line per property
- `control-route-index.json`: one row per command or OSC route control target
