---
category: Starting exe files
order: 25
---
# Starting exe files

Starting exe file commands launch external executables or shell commands from within a PangoScript. These allow BEYOND to trigger companion applications, batch files, or system-level actions as part of a show sequence.

## Commands

### RunApp

Signature: `RunApp "<file>", "<parameters>"[, <showCmd>]`

Launch an external Windows application via `ShellExecuteW`. Per
documentation (line 1267).

**This command is disabled by default.** Per Pangolin documentation:

> IMPORTANT: This command is disabled by default because of
> security reasons. If you going to use this command, enable it
> in "Configuration" dialog, "Security" tab.

The internal call is:

 ShellExecuteW(0, nil, PWideChar(File), PWideChar(Parameters), nil, round(ShowCmd))

`ShowCmd` is optional; default is `SW_SHOWNORMAL` (1). See
Microsoft's `ShowWindow` documentation for the full set of
SW_* values.

Parameters:
- file (string): full path to the Windows executable.
- parameters (string): command-line parameters to pass to the
 executable.
- showCmd (integer, optional): `ShowWindow` SW_* value. Default 1
 (SW_SHOWNORMAL).

Example:

    RunApp "C:\Windows\Notepad.exe", "", 1
    RunApp "C:\Windows\Notepad.exe", "C:\notes.txt", 1

Safety: T4 - launches arbitrary executables. Disabled by default;
operator must explicitly opt in via Configuration → Security.
