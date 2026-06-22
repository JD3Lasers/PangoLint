---
category: Timeline editor
order: 29
---
# Timeline editor

Timeline editor commands interact with BEYOND's timeline recording and playback engine. They cover transport controls (play, stop, record, seek), timeline file operations, and the TC (timecode) sync mode. These commands are relevant when authoring or triggering timeline-based shows.

## Commands

The Object Tree exposes no timeline cursor, tab, marker, playing,
view-range, or ShowItNow state property. Transport and navigation
commands in this file are therefore classified as timeline editor
actions with no direct property target unless noted otherwise.

### PlayTimeline

Signature: `PlayTimeline`

Start playback of the current show in the Timeline editor. Per local
documentation (line 1311).

Example:

    PlayTimeline

Safety: T2 - begins visible cue playback.

Related: `StopTimeline`, `GoTimelineMode`.

### StopTimeline

Signature: `StopTimeline`

Stop playback of the current show in the Timeline editor. Per local
documentation (line 1314).

Example:

    StopTimeline

Safety: T2 - stops visible cue playback.

Related: `PlayTimeline`.

### TimelineShowItNow

Signature: `TimelineShowItNow <state>`

Set the timeline editor to "online" mode. Per the BEYOND export
comment: "set online mode for timeline editor."

Parameters:
- state (integer): 1 = online, 0 = offline (interpretation
 inferred from the example `TimelineShowItNow 1`).

Example:

    TimelineShowItNow 1

Safety: T2 - affects whether the editor's preview routes to live
output.

### TimelineSetPos

Signature: `TimelineSetPos <seconds>`

Jump the timeline cursor to a specific position. Per the BEYOND
export comment: "jump to second 10."

Object Tree search found no readable timeline cursor property, so
stored value and clamp behavior are not currently observable through
MCP readback. Representative writes for `-1`, `0`, `10`, and
`100000` were transmitted without PangoLint errors, then reset to
`0`.

Parameters:
- seconds (number): time position in seconds. Range evidence is
 unverified because no direct readback path exposes the cursor.

Example:

    TimelineSetPos 10 // jump to 10 seconds in
    TimelineSetPos 0 // back to start

Safety: T2: visible cursor jump; if playing, output may change.

Related: `TimelineJumpDelta`, `TimelineJumpToStart`,
`TimelineJumpToEnd`.

### TimelineJumpToStart

Signature: `TimelineJumpToStart`

Jump the timeline cursor to the beginning of the show.

Example:

    TimelineJumpToStart

Safety: T2: visible cursor jump.

Related: `TimelineJumpToEnd`, `TimelineSetPos`.

### TimelineJumpToEnd

Signature: `TimelineJumpToEnd`

Jump the timeline cursor to the end of the show.

Example:

    TimelineJumpToEnd

Safety: T2: visible cursor jump.

Related: `TimelineJumpToStart`.

## Tab navigation

The Timeline editor groups shows into tabs. These commands navigate
between tabs, select a tab directly, and read the selected tab.

### GetTimelineTabName

Signature: `GetTimelineTabName`

`GetTimelineTabName` returns the selected Timeline editor tab name as
a string expression. Use it without parentheses:
`GetTimelineTabName()` is an invalid expression.

Example:

    WriteLn "tab=", GetTimelineTabName
    OscOutTTS "/pangolint/timeline-tab/current", "s", GetTimelineTabName

Safety: T0 for the expression itself. The surrounding selection and
marker commands have their own safety notes.

Related: `GetTimelineTabIndex`, `TimelineSetTabName`,
`TimelineMarker`.

### GetTimelineTabIndex

Signature: `GetTimelineTabIndex`

`GetTimelineTabIndex` returns the selected Timeline editor tab as a
zero-based integer expression. Use it without parentheses:
`GetTimelineTabIndex()` is an invalid expression.

The index readback is zero-based, but `TimelineSetTabIndex` takes a
one-based argument. For example, a selected tab that reads back as
index `2` is selected by `TimelineSetTabIndex 3`.

Examples:

    WriteLn "tab=", GetTimelineTabName, " index=", GetTimelineTabIndex
    OscOutTTS "/pangolint/timeline-tab/current", "si", GetTimelineTabName, GetTimelineTabIndex

Safety: T0 for the expression itself. The surrounding selection and
marker commands have their own safety notes.

Related: `GetTimelineTabName`, `TimelineSetTabIndex`,
`TimelineMarker`.

### Timeline tab validation workflow

Use these readback expressions to validate marker import workflows:

1. Select the intended timeline tab with `TimelineSetTabName` or
   `TimelineSetTabIndex`.
2. Read `GetTimelineTabName` and `GetTimelineTabIndex`.
3. Confirm the readback matches the intended song or tab.
4. Send `TimelineMarker` commands.

Related: `TimelineSetTabName`, `TimelineSetTabIndex`,
`TimelineMarker`.

### TimelineJumpDelta

Signature: `TimelineJumpDelta <seconds>`

Shift the timeline cursor by a delta in seconds (positive forward,
negative backward). Per the BEYOND export comment: "one second."

Object Tree search found no readable timeline cursor property, so
stored value and clamp behavior are not currently observable through
MCP readback. Representative writes for `-5`, `1`, and `100000`
were transmitted without PangoLint errors, then reset with
`TimelineSetPos 0`.

Parameters:
- seconds (number): shift amount in seconds. Negative for backward.
 Range evidence is unverified because no direct readback path
 exposes the cursor.

Example:

    TimelineJumpDelta 1 // forward 1 second
    TimelineJumpDelta -5 // back 5 seconds

Safety: T2: visible cursor shift.

Related: `TimelineSetPos`.

### TimelineSetViewRange

Signature: `TimelineSetViewRange <startSeconds>, <endSeconds>`

Set the visible time range in the editor. Per the BEYOND export
example: `TimelineSetViewRange 1, 5` ("from s to 5 second").

Object Tree search found no readable timeline view-range property,
so stored values, clamp behavior, and whether `startSeconds` must be
less than `endSeconds` are not currently observable through MCP
readback. Representative writes for `0,30`, `30,0`, and `0,60`
were transmitted without PangoLint errors.

Parameters:
- startSeconds (number): start of visible range, in seconds. Range
 evidence is unverified because no direct readback path exposes the
 view range.
- endSeconds (number): end of visible range, in seconds. Range
 evidence is unverified because no direct readback path exposes the
 view range.

Example:

    TimelineSetViewRange 0, 30 // show 0..30 seconds

Safety: T1: editor view only; doesn't affect playback or output.

Related: `TimelineShiftViewRange`.

### TimelineShiftViewRange

Signature: `TimelineShiftViewRange <seconds>`

Shift the visible view range by `seconds` (pan). Per the BEYOND
export comment: "one second shift."

Object Tree search found no readable timeline view-range property,
so stored value and clamp behavior are not currently observable
through MCP readback. Representative writes for `-10`, `10`, and
`100000` were transmitted without PangoLint errors, then reset with
`TimelineSetViewRange 0,60`.

Parameters:
- seconds (number): shift amount in seconds (positive forward,
 negative backward). Range evidence is unverified because no direct
 readback path exposes the view range.

Example:

    TimelineShiftViewRange 1 // pan view forward 1 sec
    TimelineShiftViewRange -5 // pan back 5 sec

Safety: T1: editor view only.

Related: `TimelineSetViewRange`.

## Mode and save

### TimelineMarker

Signature: `TimelineMarker`
Signature: `TimelineMarker <color>`
Signature: `TimelineMarker <color>, <time>`

Add a marker to the Timeline. Three forms per documentation:

- **No args** - add marker at current position with current color.
- **One arg** - add marker with specified color at current time
 position.
- **Two args** - add marker with specified color at specified time.

Markers are added to the selected Timeline editor tab. For an app that
imports song markers, select the intended tab first, verify it with
`GetTimelineTabName` or `GetTimelineTabIndex`, then send markers.

Parameters:
- color (integer, 1..10): color index.
- time (number): time in seconds (floating point).

Example:

    TimelineMarker // current position, current color
    TimelineMarker 3 // current position, color 3
    TimelineMarker 5, 12.5 // color 5 at 12.5 seconds
    TimelineSetTabName "Song Name"
    OscOutTTS "/app/timeline/selected", "si", GetTimelineTabName, GetTimelineTabIndex
    TimelineMarker 5, 12.5

Safety: T1 - adds an editor marker; doesn't affect playback or
output.

Related: `PlayTimeline`, `GetTimelineTabName`,
`GetTimelineTabIndex`, `TimelineSetTabName`.

Marker creation mutates the timeline document. Operator-supervised
testing confirmed markers were added on selected Timeline editor tabs.
Automated coverage is still deferred until a disposable timeline
fixture and restore path are available.

## PlayList transport

The Show PlayList is BEYOND's queue of shows. These eight commands
control playback (start/stop), navigation (first/last/next/prev),
and direct jumps (by show index or time within a show).

**Readback paths** (verified 2026-05-06):

| Path | Type | Notes |
| --- | --- | --- |
| `PlayListState.Playing` | int (0/1) | 1 while playing, 0 when stopped |
| `PlayListState.Position` | float (s) | Current playback time in seconds; advances ~1:1 with wall-clock during playback |
| `PlayListState.Duration` | float (s) | Total duration of the loaded show |

**Important: PlayList ≠ Timeline.** The PlayList player is distinct
from the Timeline editor's player. `PlayListState.*` does NOT track
timeline cursor state, and there is **no exposed `Timeline.Playing`
readback** in the BEYOND object tree. To verify timeline playback
state programmatically, observe the timeline UI cursor or watch for
notification-panel events; for playlist state, the readback paths
above are the preferred surface.

### TimelineNextMarker

Signature: `TimelineNextMarker`

Move the cursor to the next marker after the current position.

Example:

    TimelineNextMarker

Safety: T2 - visible cursor jump.

Related: `TimelinePrevMarker`, `TimelinePlayFromMarker`.

### TimelinePrevMarker

Signature: `TimelinePrevMarker`

Move the cursor to the previous marker before the current position.

Example:

    TimelinePrevMarker

Safety: T2 - visible cursor jump.

Related: `TimelineNextMarker`.

## Edit points

Edit points are positions in the timeline where cue boundaries fall
 - useful for snap-style cursor navigation between cue-edge transitions.

### TimelineNextEditPoint

Signature: `TimelineNextEditPoint`

Move the cursor to the next edit point after the current position.

Example:

    TimelineNextEditPoint

Safety: T2 - visible cursor jump.

Related: `TimelinePrevEditPoint`.

### TimelinePrevEditPoint

Signature: `TimelinePrevEditPoint`

Move the cursor to the previous edit point before the current
position.

Example:

    TimelinePrevEditPoint

Safety: T2 - visible cursor jump.

Related: `TimelineNextEditPoint`.

## View range

These two commands control which slice of the timeline is visible
in the editor view (zoom + pan).

### TimelinePlayFromMarker

Signature: `TimelinePlayFromMarker "<markerName>"`

Begin timeline playback starting from a named marker rather than
the current cursor position.

Parameters:
- markerName (string): name of an existing marker to start from.
 Per the BEYOND export example, an empty string `""` is valid - 
 behavior with an empty name is unverified (likely starts from
 the first marker, or from cursor).

Example:

    TimelinePlayFromMarker "Drop"

Safety: T2 - starts visible cue playback from the named marker.

Related: `TimelinePlay`, `TimelineNextMarker`,
`TimelinePrevMarker`.

### TimelineFirstTab

Signature: `TimelineFirstTab`

Switch to the first timeline tab.

Example:

    TimelineFirstTab

Safety: T2 - visible tab change; loaded show may differ.

Related: `TimelineLastTab`, `TimelineNextTab`,
`TimelinePrevTab`.

### TimelineNextTab

Signature: `TimelineNextTab`

Switch to the next timeline tab.

Example:

    TimelineNextTab

Safety: T2 - visible tab change.

Related: `TimelinePrevTab`.

### TimelinePrevTab

Signature: `TimelinePrevTab`

Switch to the previous timeline tab.

Example:

    TimelinePrevTab

Safety: T2 - visible tab change.

Related: `TimelineNextTab`.

### TimelineLastTab

Signature: `TimelineLastTab`

Switch to the last timeline tab.

Example:

    TimelineLastTab

Safety: T2 - visible tab change.

Related: `TimelineFirstTab`.

### TimelineSetTabIndex

Signature: `TimelineSetTabIndex <index>`

Switch to a specific Timeline editor tab by one-based index. This
differs from `GetTimelineTabIndex`, which reads the selected tab as a
zero-based integer.

Observed behavior:

- `TimelineSetTabIndex 0` returned Talk OK but did not change the
  selected tab.
- `TimelineSetTabIndex 1` selected getter index `0`.
- `TimelineSetTabIndex 2` selected getter index `1`.
- `TimelineSetTabIndex 3` selected getter index `2`.

Parameters:
- index (integer, >=1 observed): one-based tab selector. The maximum
 tab count depends on the open Timeline editor tabs and has not been
 enumerated.

Example:

    TimelineSetTabIndex 3
    OscOutTTS "/app/timeline/selected", "si", GetTimelineTabName, GetTimelineTabIndex

Safety: T2: visible tab change.

Related: `TimelineSetTabName`, `TimelineFirstTab`,
`GetTimelineTabIndex`.

### TimelineSetTabName

Signature: `TimelineSetTabName "<name>"`

Switch to a specific timeline tab by name. Per the BEYOND export
example: `TimelineSetTabName "MyShow"`.

Talk OK does not prove the name matched an open tab. An observed
missing name returned Talk OK and left the selected tab unchanged. Use
`GetTimelineTabName` or `GetTimelineTabIndex` after this command when
the selected tab matters.

Parameters:
- name (string): tab name as configured in BEYOND.

Example:

    TimelineSetTabName "MyShow"
    OscOutTTS "/app/timeline/selected", "si", GetTimelineTabName, GetTimelineTabIndex

Safety: T2 - visible tab change.

Related: `TimelineSetTabIndex`, `GetTimelineTabName`.

## Markers

These three commands navigate timeline markers. Markers are added
via `TimelineMarker` (see
[timeline-editor.md](./timeline-editor.md#timelinemarker))
or `TimelineAddMarker`.

### TimelineEnableTC

Signature: `TimelineEnableTC <state>`

Enable or disable TimeCode (TC) sync for the timeline.

Parameters:
- state (integer): 0 = disabled, 1 = enabled.

Example:

    TimelineEnableTC 1
    TimelineEnableTC 0

Safety: T2 - affects timeline-source binding; downstream playback
becomes externally driven.

Runtime readback maps the argument form to `Master.TcInEnabled`:
`TimelineEnableTC 1` enables it, and `TimelineEnableTC 0` restores it.

### TimelineAddMarker

Signature: `TimelineAddMarker`

Add a marker at the current cursor position. The export shows no
parameters in the example - possibly takes an implicit color/label,
or always adds with default values.

Example:

    TimelineAddMarker

Safety: T1 - adds an editor marker; doesn't affect playback.

Related: `TimelineMarker` (with explicit color/time), variants in
[timeline-editor.md](./timeline-editor.md#timelinemarker).

Like `TimelineMarker`, this mutates the timeline document and is
deferred for property coverage until there is a safe fixture.

### TimelinePlay

Signature: `TimelinePlay`

Begin timeline playback from the current cursor position. See
section overview for the relationship with `PlayTimeline`.

Example:

    TimelinePlay

Safety: T2 - starts visible cue playback from current position.

Related: `PlayTimeline`, `TimelineStop`,
`TimelinePlayFromMarker`.

### TimelineQuickSave

Signature: `TimelineQuickSave`

Trigger a quick-save of the current timeline state to disk. The
export shows no parameters; the file destination is presumably a
session-default path or the open workspace.

Because this writes to disk, coverage is deferred until a safe
timeline file fixture and restore path exist.

Example:

    TimelineQuickSave

Safety: T1 - file save; doesn't change runtime state.

### TimelineStop

Signature: `TimelineStop`

Stop timeline playback. See section overview for the relationship
with `StopTimeline`.

Example:

    TimelineStop

Safety: T2 - stops visible cue playback.

Related: `StopTimeline`, `TimelinePlay`.
