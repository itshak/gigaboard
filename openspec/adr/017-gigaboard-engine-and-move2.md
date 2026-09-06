# ADR-017: Gigaboard Pure-JS Engine Architecture & 16-Bit Move2 Wire Format

**Date:** 2026-09-06  
**Status:** Accepted  
**Change:** `gigaboard-engine-and-move2`  

---

## 1. Context

Upstream `ultrachess-react` relied on a WebAssembly (WASM) chess engine compiled from Rust/C (`@ultrachess/core`). While fast in synthetic microbenchmarks, the WASM architecture introduced significant operational and UX drawbacks:

1. **Asynchronous Mount Delay**: Compiling and instantiating WASM modules is inherently asynchronous. React components mounting via `useChessGame` were forced through an intermediate `game === null` state, causing blank boards, flash-of-unstyled-content, or hydration mismatches on frame 0.
2. **Bundler & Deployment Friction**: Packaging `.wasm` binaries requires custom Vite, Webpack, or Next.js asset configurations, and requires specific `Content-Type: application/wasm` server headers and permissive Content Security Policies (`script-src 'wasm-unsafe-eval'`).
3. **SSR Incompatibility**: Static site generation and React Server Components (RSC) cannot synchronously execute streaming WASM instantiation without bundling heavy polyfills.
4. **Move Representation Inconsistencies**: Packed moves previously used a 32-bit layout incompatible with the modern 16-bit `Move2` format used across fast chess backends.
5. **Castling & Input Restrictions**: Users were restricted to two-square King moves for castling, and canceling an incomplete drag cleared piece selection, impeding fluid click-to-move play.

---

## 2. Decision

### A. Pure JS/TS Bitboard Engine Adapter (`gigachess`)
- Adopt `gigachess` via [`createGigachessAdapter(fen?)`](file:///Users/ais/Projects/gigaboard/packages/core/src/adapters/gigachess.ts).
- Initialization is purely synchronous (<0.5 ms), completely eliminating WASM loading and enabling immediate frame-0 interactive rendering in `<Chessboard game={game} />`.
- Attacks, rays, and Zobrist tables are preloaded or calculated on demand with zero top-level `await`.
- Differential test suites ([`vs-gigachess.test.ts`](file:///Users/ais/Projects/gigaboard/packages/core/test/differential/vs-gigachess.test.ts)) verify 1,000 random legal games on every commit.

### B. Standardized 16-Bit `Move2` Binary Wire Format
Standardize `PackedMove` across all core state machines, callbacks, and history stacks to the 16-bit Move2 bitfield:
- **Bits 0..5**: `from` square index (0..63)
- **Bits 6..11**: `to` square index (0..63)
- **Bits 12..15**: promotion piece code (0 = None, 1 = Knight, 2 = Bishop, 3 = Rook, 4 = Queen)
- Export canonical helpers [`packMove`](file:///Users/ais/Projects/gigaboard/packages/core/src/types.ts) and [`unpackMove`](file:///Users/ais/Projects/gigaboard/packages/core/src/types.ts).

### C. Zero-BigInt 64-Bit Zobrist Cache Indexing
Update `legal-move-index.ts` to accept Polyglot/gigachess `{ lo: number, hi: number }` 32-bit integer pairs alongside `bigint`, eliminating heap allocations on hot transposition and legal-move cache lookups.

### D. Dual-Input Castling with Canonical King-Captures-Rook State
- Accept both human gestures for castling:
  1. Two-square King destination: `e1g1`, `e1c1` (or `e8g8`, `e8c8`).
  2. King dropped directly onto the Rook: `e1h1`, `e1a1` (or `e8h8`, `e8a8`), including Chess960 Rook positions.
- In both cases, the board model canonicalizes and records the move as King-captures-Rook (`e1h1`, `e1a1`), while `animation-planner.ts` plans coordinated simultaneous glides for King and Rook via Web Animations API (WAAPI) on the compositor thread.

### E. Drag Abort Selection Retention
Dropping a dragged piece back onto its starting square or on an invalid square does not deselect the piece. Legal move indicators and active selection remain alive, enabling immediate click-to-move follow-up.

### F. Accessible Promotion Dialog & Focus Management
- Reorder promotion choices to chess.com standard: Queen, Knight, Rook, Bishop.
- Auto-focus Queen on open; support keyboard arrow navigation (`ArrowRight`/`ArrowDown` forward, `ArrowLeft`/`ArrowUp` backward, `Home`/`End` bounds).
- Include polite `aria-live` speech announcements on active piece focus.
- Add `getPromotionPieceAriaLabel`, `getSquareAriaLabel`, and `onSquareFocus` localization props.

---

## 3. Consequences

- **Performance**: Zero async gap on mount; 1 commit per move, 0 commits during drag. Bundle size interactive footprint remains well under 16 KB gzip.
- **Compatibility**: Works across React 18/19, Next.js App Router (SSR & client components), Node.js, and browser environments without WASM flags.
- **Accessibility**: Complete WAI-ARIA grid compliance, screen-reader parity, and full keyboard control.
