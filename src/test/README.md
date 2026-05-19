# Extension-Host Tests

This folder owns VS Code extension-host tests that run through `vscode-test`.

## Responsibilities

- Launch the VS Code extension-host test runner from `runTests.ts`.
- Keep extension-host suites under `suite/`.
- Cover VS Code integration behavior that cannot run as a pure Vitest test.

Vitest tests belong under `tests/`. Do not add pure module tests here.
