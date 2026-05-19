# PangoLint PangoScript command reference

A maintainer-authored reference for every PangoScript command surfaced by
the PangoLint catalog. This is the prose source we curate against - 
each section here corresponds to a structured projection in
`data/pangoscript/commands.overlay.json` and ultimately to hover,
signature help, and completion in the editor.

## Why we maintain our own reference

Pangolin's own documentation is incomplete: many commands are listed without
descriptions, parameters have inconsistent ranges, and several command groups
are missing entirely. Pangolin's BEYOND command export gives us authoritative
one-line examples but no prose.

Rather than scrape and paraphrase those sources at scale, we write our
own reference from a top-down review of every command. That gives us:

- **A single, consistent voice** across all 521 commands.
- **A diff target** - we can compare our reference against Pangolin's
 doc to surface what they're missing, and against our overlay JSON to
 surface what we still need to encode.
- **A public-safe evidence trail** - entries summarize the claim without
 exposing maintainer-local source IDs or paths.

## How to read each entry

Each command entry follows this template:

```
### CommandName

Signature: `CommandName <param1>, <param2>`

One-sentence summary.

Optional one-paragraph "when to use this" hint.

Parameters:
- param1 (type, range): description.
- param2 (type, optional): description.

Example:

    CommandName 1, 2

Safety: T1 - readback only.

Related: OtherCommand, RelatedThing.
```

Variable forms (e.g. `StartCue <page>, <cell>` vs `StartCue "<name>"`)
are documented as separate `Signature:` lines under one entry, with
their parameters listed after the corresponding signature.

### Heading-level convention

- **`# Title`** - file title (one per file).
- **`## Section`** - topical groupings within a file (e.g.
 `## Safety classification`, `## Cross-references`, `## BGR vs RGB
 byte order`).
- **`### CommandName`** - per-command entry. **Always `###`, never
 `##`.** Short, single-command files (audio-config, color-helpers,
 cue-caption-color, cue-click-modes, lock-security, physics-sliders)
 used to use `## CommandName`; this was unified to `###` in 2026-05-06
 so `tests/commandReferenceCoverage.test.ts` and any reader can rely
 on a single convention.
- **`### CmdA / CmdB / CmdC`** - combined heading covering a tight
 family (e.g. `### SizeX / SizeY / SizeZ`). Still uses `###`. The
 command-reference coverage test recognizes this pattern as documenting
 all listed commands.

## Verification Gaps

Verification gaps are tracked in GitHub issues. Command pages call out
unverified behavior inline when it affects safe use or parameter shape.

## OSC control routes

The generated reference browser also joins selected commands and Object Tree
properties to tracked OSC control routes. See
[`../control-routes.md`](../control-routes.md) for the public data sources and
MCP lookup tools behind those route summaries.

## Section index

The command-reference files are aligned one-to-one with BEYOND command-tree categories. The order column mirrors `data/pangoscript/beyond-category-tree.json`.

| Category | Order | Commands |
| --- | ---: | ---: |
| [General](./general.md) | 1 | 71 |
| [Cue clicking](./cue-clicking.md) | 2 | 16 |
| [How to stop?](./how-to-stop.md) | 3 | 6 |
| [Main toolbar](./main-toolbar.md) | 4 | 12 |
| [Transition](./transition.md) | 5 | 3 |
| [Cell "navigation"](./cell-navigation.md) | 6 | 10 |
| [Beat timer - tap and re-sync](./beat-timer.md) | 7 | 6 |
| [Virtual LJ](./virtual-lj.md) | 8 | 2 |
| [Generating beats](./generating-beats.md) | 9 | 3 |
| [Selecting Live Control](./selecting-live-control.md) | 10 | 16 |
| [Live Control](./live-control.md) | 11 | 61 |
| [Live Control sliders buttons](./live-control-sliders-buttons.md) | 12 | 15 |
| [Live Control Physics](./live-control-physics.md) | 13 | 4 |
| [FX](./fx.md) | 14 | 45 |
| [Code](./code.md) | 15 | 13 |
| [Projection Zone - the destination](./projection-zone.md) | 16 | 31 |
| [Tabs](./tabs.md) | 17 | 16 |
| [Pages](./pages.md) | 18 | 9 |
| [Category selection](./category-selection.md) | 19 | 7 |
| [Universe page navigation](./universe-page-navigation.md) | 20 | 13 |
| [ProTracks](./protracks.md) | 21 | 26 |
| [Files](./files.md) | 22 | 5 |
| [MIDI, DMX, Channel, OSC output](./midi-dmx-channel-osc-output.md) | 23 | 29 |
| [Pause between commands](./pause-between-commands.md) | 24 | 1 |
| [Starting exe files](./starting-exe-files.md) | 25 | 1 |
| [Waiting for events - time, beats, DMX, etc](./waiting-for-events.md) | 26 | 17 |
| [Network](./network.md) | 27 | 14 |
| [Dynamics - Limiters](./dynamics-limiters.md) | 28 | 8 |
| [Timeline editor](./timeline-editor.md) | 29 | 26 |
| [Play list control](./play-list-control.md) | 30 | 9 |
| [Players](./players.md) | 31 | 7 |
| [Trigger Definition (test mode)](./trigger-definition.md) | 32 | 4 |
| [Trigger Parameters (test mode)](./trigger-parameters.md) | 33 | 8 |
| [Object Property Animation](./object-property-animation.md) | 34 | 3 |
| [Advanced MIDI mapping](./advanced-midi-mapping.md) | 35 | 13 |

## Sync invariant

When a section is updated here, the corresponding entries in
[`data/pangoscript/commands.overlay.json`](../../../../../../data/pangoscript/commands.overlay.json)
must also be updated in the same commit. Run `npm run build:knowledge`
to regenerate `commands.merged.json`, then `npm run report:gaps` to
verify no actionable gaps were introduced.

## Provenance

Keep maintainer provenance and private-tooling identifiers out of public
command knowledge. When updating these files, summarize only the public-safe
claim in this reference and in `data/pangoscript/commands.overlay.json`.
