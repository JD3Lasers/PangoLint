---
category: Play list control
order: 30
---
# Play list control

Play list control commands manage BEYOND's Playlist editor: load playlists, navigate entries, start and stop playback, and control looping. The Playlist editor provides sequence-based show control independent of the cue grid.

## Commands

### PlayListPlay

Signature: `PlayListPlay`

Start playing the current show in the PlayList. **Verified
2026-05-06** with active playlist playback: drives `PlayListState.Playing`
to 1; `PlayListState.Position` then advances at ~1:1 with wall-clock.

Example:

    PlayListPlay

Safety: T2 - begins visible cue playback.

Related: `PlayListStop`, `PlayListNext`, `PlayListState.*` readbacks.

### PlayListStop

Signature: `PlayListStop`

Stop playing the current show in the PlayList. After this command,
`PlayListState.Playing` reads as 0 and `PlayListState.Position`
stops advancing.

Command coverage maps `PlayListStop` to `PlayListState.Playing`.
The position readback remains available, but stopping does not reset
it to zero.

Example:

    PlayListStop

Safety: T2 - stops visible cue playback.

Related: `PlayListPlay`, `PlayListState.*` readbacks.

### PlayListFirst

Signature: `PlayListFirst`

Jump to the first show in the PlayList. Works in both play and edit
modes.

Example:

    PlayListFirst

Safety: T2 - may change visible output if currently playing.

Related: `PlayListLast`, `PlayListNext`, `PlayListPrev`.

### PlayListNext

Signature: `PlayListNext`

Advance to the next show in the PlayList. Works in both play and
edit modes.

Example:

    PlayListNext

Safety: T2 - advances to next show; may change visible output.

Related: `PlayListPrev`, `PlayListSetPos`.

### PlayListPrev

Signature: `PlayListPrev`

Return to the previous show in the PlayList. Works in both play
and edit modes.

Example:

    PlayListPrev

Safety: T2 - may change visible output.

Related: `PlayListNext`.

### PlayListLast

Signature: `PlayListLast`

Jump to the last show in the PlayList. Works in both play and edit
modes.

Example:

    PlayListLast

Safety: T2 - may change visible output if currently playing.

Related: `PlayListFirst`.

### PlayListSetPos

Signature: `PlayListSetPos <index>`

Jump directly to the named show in the PlayList by 1-based index.

Parameters:
- index (integer, 1..N): show index in the PlayList.

Example:

    PlayListSetPos 3 // jump to third show

Safety: T2 - may change visible output.

Related: `PlayListFirst`, `PlayListLast`, `PlayListSetTime`.

### PlayListSetTime

Signature: `PlayListSetTime <seconds>`

Jump to a time position within the currently-playing show. Per
documentation: "Work only in PLAY mode."

Runtime readback maps this command to `PlayListState.Position` while
the PlayList player is active.

Runtime range probe on 2026-05-11 confirmed stopped mode preserves
the current position, active playback accepts seconds, `-1` clamps to
`0`, and upper values pass through at least to `5000` seconds even
when `PlayListState.Duration` reads `3000`.

Parameters:
- seconds (number): time position in seconds (floating point).
 Observed range is `>=0`; values above the loaded duration may be
 accepted.

Example:

    PlayListSetTime 0 // back to start
    PlayListSetTime 30.5 // jump to 30.5 seconds in

Safety: T2: may change visible output mid-show.

Related: `PlayListSetPos`.

## Master player time control

These commands operate on **every currently-playing dynamic cue**
across the workspace - the master-tab equivalents of the per-cue
Time controls. Each is "used in
corresponding button on Master tab."

For per-track equivalents see
[fx.md](./fx.md#time-control); for show-wide
playback speed see
[general.md](./general.md#masterspeed).

### LoadPlaylist

Signature: `LoadPlaylist "<path>"`

Load a PlayList from a `.BeyondSL` file.

This replaces loaded PlayList content from disk. Coverage is
deferred until there is a safe fixture playlist and restore path.

Parameters:
- path (string): Windows-absolute path to a `.BeyondSL` file.

Example:

    LoadPlaylist "c:\Shows\MyPlaylist.BeyondSL"

Safety: T2 - replaces the current PlayList contents.

Related: `LoadCue`, `LoadWorkspace`, PlayList transport (see
[timeline-editor.md](./timeline-editor.md#playlist-transport)).
