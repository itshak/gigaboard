# @gigaboard/core

Framework-agnostic state machine and engine adapter for Gigaboard.

Zero React, zero DOM. This package owns the `gigachess` engine adapter and exposes a `useSyncExternalStore`-compatible snapshot store that the React layer (and future targets — React Native, Jazz CRDT) consume.

## Status

`1.0.0` — published to npm. See [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for design notes.

## Size budget

< 6 KB gzip. Enforced in CI via `size-limit`.
