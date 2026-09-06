## Purpose

Provides a unified single package distribution (`gigaboard`) with subpath exports for interactive React components, headless chess modeling, server-rendered static boards, tree-shakable piece sets, and themes.

## ADDED Requirements

### Requirement: Root Package Entry Point
The package SHALL provide interactive React components (`Chessboard`) and hooks (`useChessGame`, `useAnimation`, `useDrag`, `useArrowGesture`) from the root import path `gigaboard`.

#### Scenario: Importing interactive chessboard
- **WHEN** a consumer imports `{ Chessboard, useChessGame }` from `'gigaboard'`
- **THEN** the interactive React chessboard component and game state hook are loaded with full TypeScript definitions and zero monorepo package friction

### Requirement: Headless Core Subpath Isolation
The package SHALL provide headless engine adapters, state stores, Move2 bitfield utilities, and board models from `gigaboard/core` without loading React or DOM browser APIs.

#### Scenario: Headless node or worker consumption
- **WHEN** an environment imports `{ createGigachessAdapter, BoardModel, BoardStore }` from `'gigaboard/core'`
- **THEN** pure bitboard logic and headless state management execute cleanly without importing React or evaluating `window` / `document` globals

### Requirement: Server Component Static Board Subpath
The package SHALL provide a React Server Component static board from `gigaboard/server` that renders pure HTML/CSS without shipping client JavaScript.

#### Scenario: Static SSR rendering
- **WHEN** a Next.js or React Server Component imports `{ StaticChessboard }` from `'gigaboard/server'`
- **THEN** a static board with exact hydration-parity HTML markup is rendered with zero client-side bundle impact

### Requirement: Tree-Shakable Piece Sets Subpath
The package SHALL provide individual SVG piece set modules through `gigaboard/pieces/<set>` (including `neo`, `cburnett`, `merida`, `alpha`, `chesscom`) maintaining independent tree-shaking budgets (~660 bytes per set).

#### Scenario: Selecting a piece set
- **WHEN** a consumer imports `{ neo }` from `'gigaboard/pieces/neo'`
- **THEN** only the Neo piece asset definitions are bundled into the client build without importing unreferenced piece sets

### Requirement: Zero-Runtime Theme Subpath
The package SHALL provide CSS custom-property theme styles through `gigaboard/themes/<theme>` (including `green`, `brown`, `blue`, `wood`) maintaining independent tree-shaking budgets (~205 bytes per theme).

#### Scenario: Applying a theme stylesheet
- **WHEN** a consumer imports `'gigaboard/themes/brown.css'` or references the Brown theme definition
- **THEN** only the `--gb-*` CSS custom properties for that theme are loaded into the client bundle

### Requirement: Accessibility and Performance Invariance
The consolidated single package SHALL maintain all accessibility semantics (WAI-ARIA grid, roving tabindex, keyboard navigation parity, LiveRegion move announcements) and performance guarantees (1 commit per move, 0 React renders per drag frame, and <16KB gz interactive root bundle).

#### Scenario: Keyboard move with live screen reader announcement
- **WHEN** a user navigates the board via arrow keys and commits a move with Enter or Space
- **THEN** the piece navigates via roving tabindex and the move SAN is announced to assistive technologies via the ARIA live region without exceeding 1 React commit
