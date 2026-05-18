# Language Modules

This folder owns PangoScript language behavior that can be exercised without
live BEYOND networking:

- parsing and syntax-shape preservation,
- diagnostics and quick language analysis,
- formatting and semantic-token classification,
- label/navigation helpers,
- color and property-path recognition.

Pure language modules should not import `vscode`. Provider modules may import
`vscode` only when they translate pure language behavior into VS Code API
objects.
