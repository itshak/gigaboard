# Design: pointer-follow hot path without animation sacrifice

- The pre-mounted DragLayer hides 12 slots. Track the last displayed piece
  in a ref and change opacity only for the outgoing and incoming slots.
  The wrapper remains compositor-promoted; hide does not remount anything.
- `Chessboard.dragGeometryCache?: boolean` defaults false. When opted in,
  `useDrag` caches the parent's left/top/width upon the first transform
  write within a gesture, avoiding a layout read on each pointer move.
  Scroll (capture), window resize and ResizeObserver invalidate the cache;
  pointerdown/pointerup/cancel/end/unmount reset it. Drop square hit-testing
  is always live. DOM moves without scroll/resize are a documented reason
  to leave the optional optimization off.
- No new React state in the pointer loop. 2px remains app-controlled; 120ms
  belongs to the host animation setting; CSS/WAAPI runs independently.
- Test geometry by changing board position/size in a real browser, verify
  ghost pointer centering, independent model FEN, one callback per move,
  no stale drag artifact, keyboard/click/promotion compatibility, and
  preserve reduced-motion behavior.
- Measure saved layout reads and event/DOM proxies, not photon latency.
  ScreenCaptureKit/Tauri native work remains in automated-board-feel-lab.
