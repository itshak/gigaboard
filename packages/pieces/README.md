# @gigaboard/pieces

Tree-shakeable SVG piece sets for Gigaboard.

Import each set from its sub-path so the rest tree-shake out:

```ts
import { cburnett } from "@gigaboard/pieces/cburnett";
```

## Status

`0.0.0` — scaffolding. Sets land in M6.

## Size budget

Each set < 2 KB gzip. Enforced in CI via `size-limit`.
