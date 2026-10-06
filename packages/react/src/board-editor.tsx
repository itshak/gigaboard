"use client";

/**
 * `BoardEditor` — First-class accessible chess workstation board editor.
 *
 * Implements a unified, high-performance editor with `role="application"`
 * so screen readers (JAWS, NVDA, VoiceOver) bypass virtual PC cursor browse
 * mode on single-key shortcuts:
 *
 * - Single-key piece placement:
 *   - `p` / `P` (pawn: lowercase = Black, uppercase = White)
 *   - `n` / `N` (knight)
 *   - `b` / `B` (bishop)
 *   - `r` / `R` (rook)
 *   - `q` / `Q` (queen)
 *   - `k` / `K` (king)
 * - Deletion: `Backspace`, `Delete`, `x`, `X` (clears focused cell)
 * - Walk cell-by-cell: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` (orientation-aware)
 * - Row edges: `Home`, `End`
 * - Board corners: `Ctrl+Home`, `Ctrl+End`
 * - Clear board: `c` / `C`
 * - Reset starting position: `s` / `S`
 * - Toggle side to move: `t` / `T`
 * - Palette placement: `Enter` / `Space`
 * - Free drag-and-drop between squares + drag off board to delete
 */

import React, {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Coordinates } from "./components/coordinates.js";
import { gridCoord, SLOT_BASE_STYLE } from "./components/piece-layer.js";
import {
  BOARD_CELL_BB,
  BOARD_CELL_BK,
  BOARD_CELL_BN,
  BOARD_CELL_BP,
  BOARD_CELL_BQ,
  BOARD_CELL_BR,
  BOARD_CELL_WB,
  BOARD_CELL_WK,
  BOARD_CELL_WN,
  BOARD_CELL_WP,
  BOARD_CELL_WQ,
  BOARD_CELL_WR,
  type BoardCell,
  type SquareIndex,
} from "./core/index.js";
import { CSS_VARS, defaultTheme } from "./default-theme.js";
import { parseFenPlacement, STARTING_FEN } from "./fen.js";
import { algebraicOf, getSquareAtPoint } from "./lib/geometry.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type { Orientation, PieceRenderer, Theme } from "./types.js";

const PIECE_CHARS = ["", "P", "N", "B", "R", "Q", "K", "p", "n", "b", "r", "q", "k"] as const;

export function formatFenPlacement(board: Uint8Array): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    let row = "";
    for (let f = 0; f < 8; f++) {
      const cell = board[r * 8 + f] ?? 0;
      if (cell === 0) {
        empty++;
      } else {
        if (empty > 0) {
          row += String(empty);
          empty = 0;
        }
        row += PIECE_CHARS[cell] ?? "";
      }
    }
    if (empty > 0) {
      row += String(empty);
    }
    rows.push(row);
  }
  return rows.join("/");
}

function updateFenPlacement(originalFen: string, newPlacement: string): string {
  const tokens = originalFen.trim().split(/\s+/);
  if (tokens.length <= 1) {
    return newPlacement;
  }
  tokens[0] = newPlacement;
  return tokens.join(" ");
}

function pieceNameFromCell(cell: BoardCell): string {
  if (cell === 0) return "empty";
  const color = cell > 6 ? "black" : "white";
  const type = (cell - 1) % 6;
  const names = ["pawn", "knight", "bishop", "rook", "queen", "king"];
  return `${color} ${names[type] ?? "piece"}`;
}

function defaultSquareLabel(square: SquareIndex, cell: BoardCell): string {
  const sq = algebraicOf(square);
  if (cell === 0) {
    return `${sq}, empty`;
  }
  return `${sq}, ${pieceNameFromCell(cell)}`;
}

function cellFromKey(key: string): BoardCell {
  switch (key) {
    case "P":
      return BOARD_CELL_WP;
    case "N":
      return BOARD_CELL_WN;
    case "B":
      return BOARD_CELL_WB;
    case "R":
      return BOARD_CELL_WR;
    case "Q":
      return BOARD_CELL_WQ;
    case "K":
      return BOARD_CELL_WK;
    case "p":
      return BOARD_CELL_BP;
    case "n":
      return BOARD_CELL_BN;
    case "b":
      return BOARD_CELL_BB;
    case "r":
      return BOARD_CELL_BR;
    case "q":
      return BOARD_CELL_BQ;
    case "k":
      return BOARD_CELL_BK;
    default:
      return 0 as BoardCell;
  }
}

function cellFromPieceString(piece: string | null | undefined): BoardCell {
  if (!piece || piece === "erase") return 0 as BoardCell;
  if (piece.length === 2) {
    const c0 = piece[0];
    const c1 = piece[1];
    if (c0 && c1) {
      const color = c0.toLowerCase();
      const type = c1.toUpperCase();
      if (color === "w") return cellFromKey(type);
      if (color === "b") return cellFromKey(type.toLowerCase());
    }
  }
  return cellFromKey(piece);
}

function getOppositePieceString(piece: string | null | undefined): string | null {
  if (!piece || piece === "erase") return null;
  if (piece.length === 2) {
    const c0 = piece[0];
    const c1 = piece[1];
    if (c0 && c1) {
      const color = c0 === "w" ? "b" : "w";
      return `${color}${c1}`;
    }
  }
  return piece === piece.toUpperCase() ? piece.toLowerCase() : piece.toUpperCase();
}

function moveSquare(
  current: SquareIndex,
  direction: "up" | "down" | "left" | "right",
  orientation: Orientation,
): SquareIndex {
  const file = current & 7;
  const rank = current >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;

  let newCol = col;
  let newRow = row;
  switch (direction) {
    case "up":
      newRow = Math.max(0, row - 1);
      break;
    case "down":
      newRow = Math.min(7, row + 1);
      break;
    case "left":
      newCol = Math.max(0, col - 1);
      break;
    case "right":
      newCol = Math.min(7, col + 1);
      break;
  }

  const newFile = orientation === "white" ? newCol : 7 - newCol;
  const newRank = orientation === "white" ? 7 - newRow : newRow;
  return ((newRank * 8 + newFile) & 0x3f) as SquareIndex;
}

function rankEndSquare(
  current: SquareIndex,
  which: "home" | "end",
  orientation: Orientation,
): SquareIndex {
  const rank = current >> 3;
  if (orientation === "white") {
    return ((rank << 3) | (which === "home" ? 0 : 7)) as SquareIndex;
  }
  return ((rank << 3) | (which === "home" ? 7 : 0)) as SquareIndex;
}

export interface BoardEditorProps {
  /** Current FEN or placement string. */
  fen?: string;
  /** Called whenever the board placement changes. */
  onChange?: (fen: string) => void;
  /** Called when a specific square piece changes. */
  onPieceChange?: (square: SquareIndex, cell: BoardCell, algebraic: string) => void;
  /** Currently selected piece for placement (e.g. "wP", "bP", "wK", or null for eraser). */
  selectedPiece?: string | null;
  /** Callback when shortcut piece is chosen. */
  onSelectPiece?: (piece: string | null) => void;
  /** Board orientation (default "white"). */
  orientation?: Orientation;
  /** Board visual theme. */
  theme?: Theme;
  /** Piece renderer. */
  pieces?: PieceRenderer;
  /** Whether algebraic coordinates are shown. */
  showCoordinates?: boolean;
  /** Container style overrides. */
  style?: CSSProperties;
  /** Container class name. */
  className?: string;
  /** Accessible label. */
  ariaLabel?: string;
  /** Announce feedback callback (e.g. forward to useAriaLive). */
  onAnnounce?: (message: string) => void;
  /** Custom generator for square speech labels. */
  getSquareAriaLabel?: (square: SquareIndex, cell: BoardCell, algebraic: string) => string;
  /** Current focused square (controlled). */
  focusedSquare?: SquareIndex;
  /** Square focus callback. */
  onSquareFocus?: (square: SquareIndex, cell: BoardCell, algebraic: string) => void;
  /** Clear board callback. */
  onClear?: () => void;
  /** Set starting position callback. */
  onSetStartingPosition?: () => void;
  /** Toggle side to move callback. */
  onToggleSideToMove?: () => void;
}

export function BoardEditor({
  fen = "8/8/8/8/8/8/8/8 w - - 0 1",
  onChange,
  onPieceChange,
  selectedPiece,
  onSelectPiece,
  orientation = "white",
  theme = defaultTheme,
  pieces = defaultPieces,
  showCoordinates = false,
  style,
  className,
  ariaLabel = "Board editor",
  onAnnounce,
  getSquareAriaLabel,
  focusedSquare: propFocusedSquare,
  onSquareFocus,
  onClear,
  onSetStartingPosition,
  onToggleSideToMove,
}: BoardEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const liveCounter = useRef(0);
  const [board, setBoard] = useState<Uint8Array>(() => {
    try {
      return parseFenPlacement(fen);
    } catch {
      return new Uint8Array(64);
    }
  });

  const [internalFocusedSquare, setInternalFocusedSquare] = useState<SquareIndex>(
    () => (orientation === "white" ? 28 : 36) as SquareIndex, // e4 or e5
  );
  const focusedSquare = propFocusedSquare ?? internalFocusedSquare;
  const setFocusedSquare = setInternalFocusedSquare;
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);

  // Active dragging state
  const [dragging, setDragging] = useState<{
    origin: SquareIndex;
    cell: BoardCell;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    try {
      const nextBoard = parseFenPlacement(fen);
      setBoard(nextBoard);
    } catch {
      // Keep current board on parse failure
    }
  }, [fen]);

  const announce = useCallback(
    (message: string) => {
      onAnnounce?.(message);
      const region = liveRegionRef.current;
      if (region) {
        liveCounter.current++;
        region.setAttribute("data-live-id", String(liveCounter.current));
        region.textContent = "";
        void region.offsetHeight;
        region.textContent = message;
      }
    },
    [onAnnounce],
  );

  const getSquareDescription = useCallback(
    (square: SquareIndex, cell: BoardCell) => {
      const sq = algebraicOf(square);
      if (getSquareAriaLabel) {
        return getSquareAriaLabel(square, cell, sq);
      }
      return defaultSquareLabel(square, cell);
    },
    [getSquareAriaLabel],
  );

  const announceSquare = useCallback(
    (square: SquareIndex) => {
      const cell = (board[square] ?? 0) as BoardCell;
      const desc = getSquareDescription(square, cell);
      announce(desc);
      onSquareFocus?.(square, cell, algebraicOf(square));
    },
    [announce, board, getSquareDescription, onSquareFocus],
  );

  const commitBoard = useCallback(
    (nextBoard: Uint8Array) => {
      setBoard(nextBoard);
      const newPlacement = formatFenPlacement(nextBoard);
      const updatedFen = updateFenPlacement(fen, newPlacement);
      onChange?.(updatedFen);
    },
    [fen, onChange],
  );

  const placePieceAt = useCallback(
    (square: SquareIndex, cellOrCode: BoardCell | string) => {
      const targetCell =
        typeof cellOrCode === "string" ? cellFromPieceString(cellOrCode) : cellOrCode;
      const currentCell = (board[square] ?? 0) as BoardCell;
      const nextBoard = new Uint8Array(board);

      if (targetCell !== 0 && currentCell === targetCell) {
        // Toggle off
        nextBoard[square] = 0;
        commitBoard(nextBoard);
        onPieceChange?.(square, 0 as BoardCell, algebraicOf(square));
        announce(`Piece removed from ${algebraicOf(square)}`);
      } else if (targetCell !== 0) {
        nextBoard[square] = targetCell;
        commitBoard(nextBoard);
        onPieceChange?.(square, targetCell, algebraicOf(square));
        const name = pieceNameFromCell(targetCell);
        announce(`${name} placed on ${algebraicOf(square)}`);
        const char = PIECE_CHARS[targetCell] ?? "";
        const code = targetCell <= 6 ? `w${char}` : `b${char.toUpperCase()}`;
        onSelectPiece?.(code);
      } else {
        nextBoard[square] = 0;
        commitBoard(nextBoard);
        onPieceChange?.(square, 0 as BoardCell, algebraicOf(square));
        announce(`Piece removed from ${algebraicOf(square)}`);
      }
    },
    [announce, board, commitBoard, onPieceChange, onSelectPiece],
  );

  const removePieceAt = useCallback(
    (square: SquareIndex) => {
      const current = board[square] ?? 0;
      if (current === 0) {
        announce(`${algebraicOf(square)} is empty`);
        return;
      }
      const nextBoard = new Uint8Array(board);
      nextBoard[square] = 0;
      commitBoard(nextBoard);
      onPieceChange?.(square, 0 as BoardCell, algebraicOf(square));
      announce(`Piece removed from ${algebraicOf(square)}`);
    },
    [announce, board, commitBoard, onPieceChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      // 1. Arrow navigation
      if (e.key.startsWith("Arrow")) {
        if (e.shiftKey) return;
        e.preventDefault();
        const dir =
          e.key === "ArrowUp"
            ? "up"
            : e.key === "ArrowDown"
              ? "down"
              : e.key === "ArrowLeft"
                ? "left"
                : "right";
        const next = moveSquare(focusedSquare, dir, orientation);
        setFocusedSquare(next);
        announceSquare(next);
        return;
      }

      // 2. Home / End
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const next = rankEndSquare(focusedSquare, e.key === "Home" ? "home" : "end", orientation);
        setFocusedSquare(next);
        announceSquare(next);
        return;
      }

      // 3. Delete / Backspace
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "x" || e.key === "X") {
        e.preventDefault();
        removePieceAt(focusedSquare);
        return;
      }

      // 4. Clear board / Set start / Toggle side
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        if (onClear) {
          onClear();
        } else {
          commitBoard(new Uint8Array(64));
          announce("Board cleared");
        }
        return;
      }

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (onSetStartingPosition) {
          onSetStartingPosition();
        } else {
          commitBoard(parseFenPlacement(STARTING_FEN));
          announce("Starting position");
        }
        return;
      }

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        onToggleSideToMove?.();
        return;
      }

      // 5. Enter / Space: place selected piece
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (selectedPiece) {
          const piece = e.shiftKey ? getOppositePieceString(selectedPiece) : selectedPiece;
          if (piece) placePieceAt(focusedSquare, piece);
        }
        return;
      }

      // 6. Quick piece shortcuts (FEN letters: p, P, n, N, b, B, r, R, q, Q, k, K)
      const pieceCell = cellFromKey(e.key);
      if (pieceCell !== 0) {
        e.preventDefault();
        placePieceAt(focusedSquare, pieceCell);
      }
    },
    [
      announce,
      announceSquare,
      commitBoard,
      focusedSquare,
      onClear,
      onSetStartingPosition,
      onToggleSideToMove,
      orientation,
      placePieceAt,
      removePieceAt,
      selectedPiece,
    ],
  );

  // Pointer drag and drop
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // left click only
    const container = containerRef.current;
    if (!container) return;

    const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
    if (sq === null) return;

    container.focus();
    setFocusedSquare(sq);
    onSquareFocus?.(sq, (board[sq] ?? 0) as BoardCell, algebraicOf(sq));
    const cell = (board[sq] ?? 0) as BoardCell;

    if (cell === 0) {
      // Empty square clicked: place selected piece
      if (selectedPiece) {
        placePieceAt(sq, selectedPiece);
      }
      return;
    }

    // Occupied square: start drag
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({
      origin: sq,
      cell,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const container = containerRef.current;
    const originSq = dragging.origin;
    const movedCell = dragging.cell;
    setDragging(null);

    if (!container) return;
    const targetSq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);

    if (targetSq === null) {
      // Dropped off the board: delete piece
      removePieceAt(originSq);
      return;
    }

    if (targetSq === originSq) {
      // Click without drag: place selected piece if palette has one
      if (selectedPiece) {
        placePieceAt(originSq, selectedPiece);
      }
      return;
    }

    // Move piece from origin to target
    const nextBoard = new Uint8Array(board);
    nextBoard[originSq] = 0;
    nextBoard[targetSq] = movedCell;
    commitBoard(nextBoard);
    announce(`${pieceNameFromCell(movedCell)} moved to ${algebraicOf(targetSq)}`);
    setFocusedSquare(targetSq);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
    if (sq === null) return;

    setFocusedSquare(sq);
    if (selectedPiece) {
      const opp = getOppositePieceString(selectedPiece);
      if (opp) placePieceAt(sq, opp);
    }
  };

  // Build 64 squares visually
  const squareOrder = useMemo(() => {
    const squares: SquareIndex[] = [];
    if (orientation === "white") {
      for (let rank = 7; rank >= 0; rank--) {
        for (let file = 0; file < 8; file++) {
          squares.push((rank * 8 + file) as SquareIndex);
        }
      }
    } else {
      for (let rank = 0; rank < 8; rank++) {
        for (let file = 7; file >= 0; file--) {
          squares.push((rank * 8 + file) as SquareIndex);
        }
      }
    }
    return squares;
  }, [orientation]);

  const containerStyle: CSSProperties = {
    position: "relative",
    aspectRatio: "1 / 1",
    width: "100%",
    touchAction: "none",
    outline: hasKeyboardFocus ? "3px solid var(--gb-editor-focus, #d97706)" : "none",
    outlineOffset: "2px",
    borderRadius: "8px",
    ...(theme as CSSProperties),
    ...style,
  };

  return (
    <div
      ref={containerRef}
      role="application"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" container owns keyboard focus
      tabIndex={0}
      aria-label={ariaLabel}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space Backspace Delete p P n N b B r R q Q k K c C s S t T"
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        if (e.target === e.currentTarget) {
          setHasKeyboardFocus(true);
          announceSquare(focusedSquare);
        }
      }}
      onBlur={() => setHasKeyboardFocus(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragging(null)}
      onContextMenu={handleContextMenu}
      className={className}
      style={containerStyle}
      data-gb-editor="true"
      data-gb-orientation={orientation}
    >
      {/* 8x8 Board Grid */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          pointerEvents: "none",
        }}
      >
        {squareOrder.map((sq) => {
          const file = sq & 7;
          const rank = sq >> 3;
          const isLight = ((file + rank) & 1) !== 0;
          const isFocused = hasKeyboardFocus && focusedSquare === sq;

          return (
            <div
              key={sq}
              data-square={algebraicOf(sq)}
              style={{
                position: "relative",
                backgroundColor: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
                backgroundImage: `var(${isLight ? CSS_VARS.SQ_LIGHT_IMAGE : CSS_VARS.SQ_DARK_IMAGE},none)`,
                backgroundSize: `var(${CSS_VARS.SQ_IMAGE_SIZE},cover)`,
                boxShadow: isFocused ? "inset 0 0 0 3px rgba(255, 206, 76, 0.95)" : undefined,
                userSelect: "none",
              }}
            />
          );
        })}
      </div>

      {/* Piece Layer */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          pointerEvents: "none",
        }}
      >
        {squareOrder.map((sq) => {
          const cell = (board[sq] ?? 0) as BoardCell;
          if (cell === 0) return null;
          const isOrigin = dragging?.origin === sq;
          const { col, row } = gridCoord(sq, orientation);

          return (
            <div
              key={sq}
              data-piece-square={algebraicOf(sq)}
              style={{
                ...SLOT_BASE_STYLE,
                gridColumnStart: col,
                gridRowStart: row,
                opacity: isOrigin ? 0.25 : 1,
                filter: `var(${cell <= 6 ? CSS_VARS.PIECE_FILTER_WHITE : CSS_VARS.PIECE_FILTER_BLACK}, none)`,
                pointerEvents: "none",
              }}
            >
              {pieces({ cell, square: sq })}
            </div>
          );
        })}
      </div>

      {/* Dragging Piece Floating Overlay */}
      {dragging && containerRef.current ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: dragging.x - 30,
            top: dragging.y - 30,
            width: 60,
            height: 60,
            pointerEvents: "none",
            zIndex: 100,
            filter: `var(${dragging.cell <= 6 ? CSS_VARS.PIECE_FILTER_WHITE : CSS_VARS.PIECE_FILTER_BLACK}, none)`,
          }}
        >
          {pieces({ cell: dragging.cell, square: dragging.origin })}
        </div>
      ) : null}

      {/* Coordinates */}
      {showCoordinates ? <Coordinates orientation={orientation} /> : null}

      {/* Accessible Live Region */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      />
    </div>
  );
}
