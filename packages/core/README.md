# @ultrachess/core

Framework-agnostic state machine and engine adapter for [Ultra Chess React](https://github.com/yahorbarkouski/ultrachess-react).

Zero React, zero DOM. This package owns the `ultrachess` engine handle and exposes a `useSyncExternalStore`-compatible snapshot store that the React layer (and future targets — React Native, Jazz CRDT) consume.

## Status

`1.0.0` — published to npm. See [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for design notes.

## Size budget

< 6 KB gzip. Enforced in CI via `size-limit`.
