---
category: Network
order: 27
---
# Network

Network commands send raw UDP datagrams, Talk UDP packets to BEYOND's own Talk interface, and OSC messages. These enable inter-application communication and control of remote BEYOND instances or OSC-capable devices. The Talk UDP target and OSC endpoints are configured in BEYOND's network settings.

## Commands

### Hello

Signature: `Hello`

Send a connectivity-ping. Per BEYOND export comment: "answer will
be Hello!" - BEYOND replies with the literal string `Hello!` over
the Talk bus, useful for verifying the script-to-BEYOND command
channel is alive without any side effect.

Casing is parser-insensitive - `Hello`, `hello`, and `HELLO` all
work.

Example:

    Hello // BEYOND replies "Hello!"

Safety: T0 - pure no-op ping.

Related: `Echo` (controls reply verbosity).

## Talk-bus reply verbosity

### Echo

Signature: `Echo <mode>`

Set how verbose BEYOND's Talk-bus replies are. Per BEYOND export
comment: "0-none, 1-ok/error, 2-echo of input plus ok/error."

This affects every subsequent command sent over the Talk bus, not
just the next one - it's a session-state setting that persists
until changed.

Parameters:
- mode (integer, 0..2):
 - `0` - none (BEYOND sends no reply at all).
 - `1` - ok/error (default; BEYOND sends a brief status reply).
 - `2` - echo of input plus ok/error (BEYOND echoes the command
 text back along with the status).

Example:

    Echo 0 // silent - no replies
    Echo 1 // brief status replies
    Echo 2 // verbose: input echo + status

Safety: T0 - Talk-bus reply mode only.

Related: `Hello`, Talk UDP (see [network.md](./network.md)).

## External notification

### Password

Signature: `Password "<password>"`

**Authenticate the TCP Talk Server client connection.** Per
BEYOND documentation: "Password protection can be enabled
for the TCP Talk Server. The password must be defined in the
BEYOND.INI file under the General section. If the provided
password matches, commands from the client will be accepted. No
password by default. `[General] TcpTalkServerPassword=12345`."

Per BEYOND export example: `password "enter pasword here"` (note
Pangolin's typo in the example string; preferred command name is
`Password` and PangoScript parsing is case-insensitive).

**Verified 2026-05-06**: this command is unrelated to the
LockScreen feature. Setting `Password "TestPass"` does NOT enable
`LockScreen` - that requires a separate UI-side password in
Configuration/Security. The `Password` command supplies an auth
value to compare against BEYOND.INI; it does NOT set a password
on the BEYOND side.

When Talk-server password protection is configured but the client
hasn't authenticated, BEYOND rejects subsequent commands until a
matching `Password "..."` call.

Parameters:
- password (string): auth password value.

Example:

    Password "session-2026" // supply Talk-server auth credential

Safety: T2 - sends a sensitive credential over Talk UDP. Use
`Echo 0` if scripts include this command to avoid the auth value
appearing in reply echoes.

Related: BEYOND.INI `[General] TcpTalkServerPassword=...`,
`LockScreen` / `UnLockScreen` (separate UI security; see those
entries).

### Version

Signature: `Version`

Send BEYOND's executable version string over the Talk bus to
whichever client requested it. Per BEYOND export comment: `version
| remote server will get exe file version`. Casing is
parser-insensitive - `Version`, `version`, and `VERSION` all work.

Useful for client tooling that needs to detect which BEYOND build
is running before deciding which command set / parameter shapes to
use. The reply lands on the same Talk-bus reply stream controlled
by `Echo`.

Example:

    Version // BEYOND replies with version string

Safety: T0 - pure Talk-bus reply, no side effect on BEYOND state.

Related: `Hello` (connectivity ping - see
[network.md](./network.md#hello)), `Echo`
(controls Talk-bus reply verbosity - see
[network.md](./network.md#echo)).

### LockScreen

Signature: `LockScreen`

Lock the BEYOND application UI. **Verified 2026-05-06**:

- **Requires a UI-side password** set via BEYOND's
 Configuration → Security panel. Without it, the call surfaces
 a notification ("Lock screen: Please set password in
 Configuration/Security to avoid lockup") and `Status.Locked`
 stays at 0.
- With the UI password set, `LockScreen` engages immediately and
 `Status.Locked` transitions from 0 → 1.

The PangoScript `Password "..."` command is **NOT** the right
input here - that's the unrelated TCP Talk Server auth (see
`Password` below).

Lock state is observable at `Status.Locked` (1 = locked, 0 =
unlocked).

Example:

    LockScreen // lock the UI (UI password must be set)

Safety: T2 - blocks operator UI input. Do not call mid-show
without an automated unlock path.

Related: `UnLockScreen`, BEYOND Configuration → Security panel.

### Pub

Signature: `Pub "<channel>", "<value>"` (4 overloads - string-string,
string-string-int, string-string-int-int, string-float)

**Status: prototype, T0, no observable effect in BEYOND 2030.**

Probed live 2026-05-06 with a staged runtime probe:
- All four signature shapes parsed and ran without error.
- Zero OSC traffic on the reply stream.
- Zero notification panel entries.
- No log output.
- Combined with `SubProp` it did not propagate values into bound
 properties (in either argument order).

Best-guess intent: publish a value onto a named channel, presumably
for delivery to subscribers (Sub*, an external broker, or another
script). Wiring is missing in the build we tested.

### PubObject

Signature: `PubObject "<channel>", "<objectPath>"` (2 overloads - 
2-arg and 3-arg with format hint)

**Status: prototype, T0, no observable effect in BEYOND 2030.**

Best-guess intent: publish a serialized snapshot of a BEYOND object
(e.g. `Master`) onto a channel, perhaps as JSON. Parsed without error
but produced nothing observable.

### StartTalkClient

Signature: `StartTalkClient`
Signature: `StartUdpTalkClient` (alias)

Start BEYOND's Talk UDP client - the outbound side that lets BEYOND
forward PangoScript commands to a remote endpoint. Less commonly used
than the server side; useful for setups where BEYOND is the
controller and another BEYOND (or compatible receiver) is the
target.

Example:

    StartTalkClient

Safety: T1 - opens an outbound UDP socket.

Related: `StopTalkClient`, `StartTalkServer`.

### StartTalkServer

Signature: `StartTalkServer`
Signature: `StartUdpTalkServer` (alias)

Start BEYOND's Talk UDP server - the listener that receives
PangoScript commands from external programs (Lasershow Designer,
custom MIDI controllers, scripting tools, etc.). Uses the port
configured in BEYOND's Settings (typically 16062).

Example:

    StartTalkServer

Safety: T1 - opens a UDP listener; no laser-output effect.

Related: `StopTalkServer`, `StartTalkClient`.

### StopTalkClient

Signature: `StopTalkClient`
Signature: `StopUdpTalkClient` (alias)

Stop BEYOND's Talk UDP client.

Example:

    StopTalkClient

Safety: T1 - closes the outbound socket.

Related: `StartTalkClient`.

### StopTalkServer

Signature: `StopTalkServer`
Signature: `StopUdpTalkServer` (alias)

Stop BEYOND's Talk UDP server. After this call BEYOND will not
respond to incoming PangoScript over UDP until `StartTalkServer`
is called again.

Example:

    StopTalkServer

Safety: T1 - closes the UDP listener. Can disconnect external
programs that are mid-session over UDP, but doesn't affect laser
output.

Related: `StartTalkServer`.

## Client (BEYOND-as-sender)

### SubJson

Signature: `SubJson "<channel>", "<arg>"` (1 overload)

**Status: prototype, T0, no observable effect in BEYOND 2030.**

Best-guess intent: subscribe to JSON-formatted updates on a channel.
Second-argument purpose unknown.

### SubProp

Signature: `SubProp "<channel>", "<propertyPath>"` (1 overload)

**Status: prototype, T0, no observable effect in BEYOND 2030.**

Best-guess intent: bind a BEYOND object property to a Pub/Sub channel,
either as the inbound write target (Pub→property) or the outbound
publish source (property→Pub). Both directions probed; neither
worked. Argument order was tested both ways; neither worked.

### UnLockScreen

Signature: `UnLockScreen`

Unlock the BEYOND UI - inverse of `LockScreen`. **Verified
2026-05-06**: zero-arg form releases the lock without requiring
the lock-screen password to be supplied. After `LockScreen` (with
a UI-side password set), bare `UnLockScreen` transitioned
`Status.Locked` from 1 → 0.

**Security implication**: script-driven unlocks bypass the lock
password gate. Operator-typed unlocks via the lock dialog still
require the password, but Talk-bus / scripted unlocks do not.
Pair this with TCP Talk Server `Password` auth (BEYOND.INI
`[General] TcpTalkServerPassword`) if the deployment needs to
gate scripted access.

Example:

    UnLockScreen // restore operator access (no password needed)

Safety: T2 - restores operator UI access.

Related: `LockScreen`, `Status.Locked` readback.
