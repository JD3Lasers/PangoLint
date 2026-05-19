# Diagnostics Modules

This folder owns the focused diagnostic rules used by `../diagnostics.ts`.

- `pangoDiagnostic.ts`: shared diagnostic shape and construction.
- `diagnosticLimits.ts`: max-diagnostic replacement behavior.
- `propertyPathDiagnostics.ts`: Object Tree and schema property typo hints.
- `commandDiagnostics.ts`: command lookup and argument-count warnings.
- `controlFlowDiagnostics.ts`: Goto, loop, For range, and terminal `exit` checks.
- `beyondCompatibilityDiagnostics.ts`: warnings backed by observed BEYOND parser behavior.
- `variableReadDiagnostics.ts`: local Var, string-label, Goto, and unused-label checks.
- `pangoscriptTextSearch.ts`: string-aware PangoScript token scanning.
- `stringDistance.ts`: typo distance calculation shared by language and MCP search.
