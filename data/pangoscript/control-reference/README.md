# BEYOND Control Reference

This generated dataset organizes BEYOND controls for PangoLint documentation, lookup, and future linting work.

## Dataset Groups

- `object-control-reference/`: Object Tree paths by cue type, Parametric Image form type, Universe component type, FX effect type, and global object root.
- `osc-control-reference/`: OSC command routes and matching target property patterns.
- `command-control-reference/`: PangoScript commands, command property coverage, command to OSC route links, and range seeds.
- `control-crosswalk/`: property-first lookup joining Object Tree contexts, direct `/b/` paths, PangoScript commands, OSC command routes, range seeds, and behavior classification.
- `mcp-control-reference/`: compact generated MCP projection for property control lookup tools.
- `package-policy.json`: checked-in consumer and package-surface policy for the control-reference groups.

## Public Checkout

Normal public development, tests, package verification, and MCP verification use the checked-in files in this folder.

Evidence overlays remain the editable source for value metadata, readback metadata, and behavior classification. This folder is generated output.
