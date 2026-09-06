## 1. Core Engine Adapter & Move2 Types

- [x] 1.1 Add `gigachess` dependency to `packages/core` and implement `createGigachessAdapter` with synchronous initialization
- [x] 1.2 Update `PackedMove` in `packages/core/src/types.ts` to conform to 16-bit `Move2` wire format (`from: 6b | to: 6b | promo: 4b`)
- [x] 1.3 Update `legal-move-index.ts` to index positions using zero-BigInt `{ lo: number, hi: number }` Zobrist pairs

## 2. Interaction: Dual-Input Castling, Click-to-Move & Drag Retention

- [x] 2.1 Update `board-model.ts` move resolution to accept both King 2-square jumps (`e1g1`/`e1c1`) and King-onto-Rook (`e1h1`/`e1a1`), canonically committing King-captures-Rook
- [x] 2.2 Refactor `animation-planner.ts` to identify castling from King-captures-Rook moves and output coordinated King (`g1`/`c1`) and Rook (`f1`/`d1`) animation descriptors
- [x] 2.3 Verify `onMove` callback emits canonical King-captures-Rook moves (`e1h1`, `e1a1`, `e8h8`, `e8a8`) and test with unit tests
- [x] 2.4 Update `useDrag` and `chessboard.tsx` so when a drag is released on the origin square or aborted, the square remains selected for subsequent click-to-move execution

## 3. Accessibility & Promotion Overlay

- [x] 3.1 Upgrade `PromotionOverlay` with Arrow key navigation (`ArrowDown`/`ArrowRight`/`ArrowUp`/`ArrowLeft`/`Home`/`End`), auto-focus on open, focus trapping, and Chess.com order (`Q, N, R, B`)
- [x] 3.2 Add active piece speech announcement via `aria-live` and support `getPromotionPieceAriaLabel` for multi-language (Russian, Hebrew, English) screen-reader support
- [x] 3.3 Add `getSquareAriaLabel` and `onSquareFocus` props to `<Chessboard />` so BlindBase can pipe localized speech and custom announcements directly into the native grid

## 4. Synchronous React Lifecycle & Rebranding

- [x] 4.1 Refactor `useChessGame` in `packages/react/src/hooks/use-chess-game.ts` to instantiate the board synchronously on frame 0
- [x] 4.2 Update package naming and references to `gigaboard` across `package.json`, exports, and build configurations

## 5. Verification & Validation

- [x] 5.1 Run `bun run typecheck` across all workspace packages and verify zero TypeScript errors
- [x] 5.2 Run `bun run test` across core and react packages and verify all unit tests pass
- [x] 5.3 Verify that cold-mount long task is 0 ms and castling animations glide smoothly
- [x] 5.4 Test promotion overlay and grid navigation with keyboard and VoiceOver / NVDA emulation
