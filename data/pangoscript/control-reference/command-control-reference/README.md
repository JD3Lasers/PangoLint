# Command Control Reference

This folder contains generated command-control data for lookup and validation.

It links PangoScript commands to object property patterns and to OSC command
routes when the relationship is direct or shares the same target property.

## Files

- `summary.json`: counts and coverage totals
- `commands.json`: compact command catalog with signatures and target properties
- `command-property-links.json`: one row per command to property link
- `property-command-index.json`: property to command lookup
- `command-osc-route-links.json`: command to OSC route links
- `command-category-index.json`: command groups for browsing
- `range-seeds.json`: current known range data grouped by property

## Link Kinds

- `directDispatcherCommand`: an OSC route dispatches the named PangoScript command
- `sharedTargetProperty`: an OSC route and command write the same object property pattern
