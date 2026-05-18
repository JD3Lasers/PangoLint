# Knowledge Modules

This folder owns source-backed knowledge used by PangoLint:

- raw command catalog parsing,
- bundled command knowledge loading,
- curated knowledge validation helpers,
- known expression-function metadata for hover/sidebar surfaces,
- known-property index loading and merging.

Knowledge modules may read bundled extension data and should stay independent
from VS Code UI concerns. Generated data still lives under `data/pangoscript/`;
do not hand-edit generated JSON outputs.
