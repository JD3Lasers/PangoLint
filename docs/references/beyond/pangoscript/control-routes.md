# BEYOND OSC Control Routes

PangoLint tracks three public control surfaces for BEYOND state:

- Object Tree paths such as `Zone.N.Mute` and `Master.BPM`.
- Direct Object Tree OSC addresses under `/b/`, such as `/b/Zone/0/Mute`.
- BEYOND control routes under `/beyond/...` and `/midi/...`, such as `/beyond/general/SetBpm`.

The reference site joins these surfaces when the tracked data has a public-safe
match. Command pages show matching OSC routes, argument tags, target property
paths, and value transforms. Object schema rows show the direct `/b/` address
plus compact route summaries when a property also has known control routes.

## Tracked Data

The reference UI reads only checked-in generated data:

| File | Purpose |
|---|---|
| `data/pangoscript/control-reference/command-control-reference/command-osc-route-links.json` | Joins PangoScript commands to matching `/beyond/...` and `/midi/...` routes. |
| `data/pangoscript/control-reference/osc-control-reference/object-property-target-index.json` | Joins Object Tree property patterns to matching OSC routes. |
| `data/pangoscript/object-tree/runtime-indexes/object-property-index.json` | Provides Object Tree paths and direct `/b/` OSC addresses. |

Private discovery notes and local probe work are not required to build the
public reference site.

## MCP Lookup

For agent workflows, use these offline MCP tools when you need the same joined
control data:

| Tool | Use |
|---|---|
| `lookupPropertyControls` | Exact property lookup with Object Tree path, direct `/b/` address, command links, OSC routes, range data, readback, and behavior metadata. |
| `searchPropertyControls` | Search property controls by path, OSC route, command name, context, and value metadata. |

Runtime readback and script send tools are separate opt-ins. The control route
data in the reference site and MCP lookup tools is static knowledge and does
not contact BEYOND.
