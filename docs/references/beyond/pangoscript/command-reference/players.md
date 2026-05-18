---
category: Players
order: 31
---
# Players

Players commands control BEYOND's dedicated content players (audio, video, or media timeline players). Commands include load, play, pause, stop, and seek for named player instances.

## Commands

The bundled Object Tree exposes no `Player` root and no aggregate
player time/speed/jump/loop state. The master-player commands below
are classified as action commands with no direct property target.

### InvertPlayersTime

Signature: `InvertPlayersTime`

Invert the time direction of all currently-playing cues - every
dynamic player runs backwards from its current position.

Example:

    InvertPlayersTime

Safety: T3 - visible playback-direction change across every active
cue.

Related: `InvertProTrackTime` (see
[protracks.md](./protracks.md#invertprotracktime)),
`PlayersSetJump`.

### PlayersSetJump

Signature: `PlayersSetJump`

Two-call pattern: first call memorizes the current player position;
second call restores the time of every player to the saved
position. "first call memorize current player
position and second call restore the time of player to that
position."

Use `PlayersResetJump` to clear the saved time without restoring.

Example:

    PlayersSetJump // first call - memorize
    //... operator does something...
    PlayersSetJump // second call - restore

Safety: T2 - sets a marker; second call shifts all currently
playing cues to the saved position (visible jump).

Related: `PlayersResetJump`, `PlayersSetLoop`,
`ProTrackSetJump` (see
[protracks.md](./protracks.md#protracksetjump)).

### PlayersResetJump

Signature: `PlayersResetJump`

Clear the saved time captured by `PlayersSetJump` (zeroes the
storage). Subsequent `PlayersSetJump` will memorize a fresh
position rather than restore.

Example:

    PlayersResetJump

Safety: T2 - clears the marker.

Related: `PlayersSetJump`.

### PlayersSetLoop

Signature: `PlayersSetLoop`

Three-call pattern first call memorizes time
position A; second call memorizes time position B; subsequently
players bounce time within the A–B range. A third call clears the
loop and players resume normal playback.

Example:

    PlayersSetLoop // first call - A position
    //...
    PlayersSetLoop // second call - B position; loop active
    //...
    PlayersSetLoop // third call - clear loop

Safety: T3 - defines and activates a playback loop across every
active cue.

Related: `PlayersSetJump`, `ProTrackSetLoop` (see
[protracks.md](./protracks.md#protracksetloop)).

### PlayersDisk

Signature: `PlayersDisk <speedMultiplier>[, <positionDelta>]`

Provides script access to the "DJ disk" control on BEYOND's Master
tab. disk action has two effects - distance
from center controls slowdown of rotation (speed control), and
position shift adds a time-shift delta to every active cue.

Parameters:
- speedMultiplier (number, 0..1): normalized speed. 1 = full speed,
 0 = full stop.
- positionDelta (number, optional): time shift in **radians**.
 Each call adds this value to every player's time position. Per
 the documentation the parameter is optional ("there is a special
 procedure for this if you plan to use it from MIDI").

Example:

    PlayersDisk 1, 0.1 // full speed, +0.1 rad time shift
    PlayersDisk 0.5 // half speed, no shift

Safety: T3 - visible time-shift and speed change across every
active cue.

Related: `PlayersDiskShift`, `MasterSpeed` (see
[general.md](./general.md#masterspeed)).

### PlayersDiskShift

Signature: `PlayersDiskShift <positionDelta>`

Apply a time-shift delta to every currently-playing cue without
changing speed. Equivalent to `Time = Time + Delta` per the help
doc. Designed for MIDI-encoder-style incremental control where the
matching `PlayersDisk` form is too heavy.

Object Tree search found no Player root or aggregate player time
property, so stored value and clamp behavior are not currently
observable through MCP readback. Representative writes for `-0.1`,
`0`, and `0.1` were transmitted without PangoLint errors, then a
final `0` delta was sent.

Parameters:
- positionDelta (number): time shift in radians (same units as
 `PlayersDisk`'s second arg). Range evidence is unverified because
 no direct readback path exposes the aggregate player time.

Example:

    PlayersDiskShift 0.1

Safety: T3: visible time shift across every active cue.

Related: `PlayersDisk`.

### RestorePlayer

Signature: `RestorePlayer <page>, <cue>, <options>, <UserID>, <Routing>, <Clock>, <param7>`

Restore a captured player state. BEYOND documentation:, this command is deprecated. The documentation says the
capture-to-script approach did not work well in practice. New scripts
should not use this command. Which player state is restored and what
the final numeric parameter means remain unverified.

Parameters:
- page (integer): captured-state page index. Indexing basis and
 bounds are unverified.
- cue (integer): captured-state cue index. Indexing basis and bounds
 are unverified.
- options (integer): options bit mask. Flag meanings and bounds are
 unverified.
- UserID (integer): caller ID. Accepted range is unverified.
- Routing (string): routing token or string. Accepted values are
 unverified.
- Clock (number): captured clock value. Units are likely seconds, but
 `0.0` behavior and bounds are unverified.
- param7 (number): final numeric parameter. Purpose, units, and
 bounds are unverified.

Example:

    RestorePlayer 1, 1, 0, 0, "", 0.0, 0

Safety: T2: visible playback change; exact effect depends on
unverified target.

Evidence note: runtime probing is blocked until inactive player
content, expected state, and a restore path are available. PangoLint
lint acceptance and Talk UDP transmission are not range evidence.

Related: `PlayersSetJump` / `PlayersResetJump` (master-player
position management - see
[timeline-editor.md](./timeline-editor.md)).
