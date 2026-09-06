"use client";

/**
 * Interactive analysis board backed by Stockfish.
 *
 * The `<Chessboard/>` owns game state (via `useChessGame`); this component
 * listens for position changes through the board's snapshot store and kicks
 * off a fresh Stockfish search for each unique position. The engine's
 * principal-variation head is painted as a green arrow via the board
 * model's imperative `setArrows` — `clearArrowsOnMove` is disabled so the
 * hint survives the next move-start commit instead of flickering.
 */

import type { Arrow, BoardModel, SquareIndex } from "gigaboard/core";
import { chesscom } from "gigaboard/pieces";
import type { MoveSoundOptions } from "gigaboard";
import { Chessboard, useBoardSlice, useChessGame } from "gigaboard";
import { wood } from "gigaboard/themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { StockfishEngine, type StockfishMessage } from "./stockfish-engine";

/** Starting position. Kept classical so the engine pumps out recognisable book moves. */
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A handful of interesting FENs for quick-switching, mirroring what the
 * showcase example does. Lets the visitor poke at tactical positions
 * without typing FENs by hand.
 */
const PRESETS: ReadonlyArray<readonly [string, string]> = [
  ["Start", START_FEN],
  ["Italian", "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"],
  ["Najdorf", "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6"],
  ["K+R vs K", "8/8/8/4k3/8/8/4K3/4R3 w - - 0 1"],
  ["Fool's mate", "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"],
];

/** Target search depth — balances responsiveness against analysis quality. */
const SEARCH_DEPTH = 18;

/**
 * UCI info lines below this depth are ignored. The first few plies stream
 * noisy PVs that would make the "Best line" readout jitter.
 */
const MIN_USEFUL_DEPTH = 8;

/**
 * Engine arrow colour. Matches the library's default "primary" arrow tint
 * (`defaultArrowColors.default` from `gigaboard`) so a user-drawn
 * right-click arrow on top reads as the same channel, not a second visual
 * class.
 */
const ENGINE_ARROW_COLOR = "rgba(21, 120, 27, 0.8)";

/**
 * Sound-asset overrides — the postinstall `scripts/copy-sounds.mjs` step
 * lifts the hashed MP3s shipped with gigaboard into `public/sounds/`
 * with stable filenames, which we reference here. Without this override the
 * library would try to resolve its bundled asset paths against Next's
 * static root and 404.
 */
const SOUND_SOURCES = {
  moveSelf: "/sounds/move-self.mp3",
  moveOpponent: "/sounds/move-opponent.mp3",
  capture: "/sounds/capture.mp3",
  castle: "/sounds/castle.mp3",
  moveCheck: "/sounds/move-check.mp3",
  promote: "/sounds/promote.mp3",
  gameEnd: "/sounds/game-end.mp3",
} as const;

export function AnalysisBoard() {
  // The engine is allocated once, at mount, with the starting FEN. Preset
  // picks go through `game.load(nextFen)` instead of re-seeding the hook —
  // re-seeding would dispose the engine mid-effect and every effect still
  // holding the old `game` reference (including our Stockfish subscriber)
  // would throw on the next tick.
  const game = useChessGame({ fen: START_FEN });

  if (!game) {
    return (
      <section style={loadingShellStyle}>
        <span style={{ color: "#6b7280" }}>Loading engine…</span>
      </section>
    );
  }
  return <LiveAnalysisBoard game={game} />;
}

/**
 * Inner component that runs once the `BoardModel` has resolved. Split out
 * so the subscription hooks (`useBoardSlice`) can depend on a non-null
 * model without tripping the rules-of-hooks guard.
 */
function LiveAnalysisBoard({ game }: { readonly game: BoardModel }) {
  // Engine ownership lives inside the mount effect — not in render and
  // not in a `useRef(new StockfishEngine())`. React strict-mode in dev
  // invokes effects twice: mount → cleanup → remount. If construction
  // ran at render time, the cleanup would terminate the engine, but the
  // remount would see the (now-dead) ref and skip recreating it, leaving
  // the UI glued to a zombie worker that never replies.
  const engineRef = useRef<StockfishEngine | null>(null);

  // Wake up only when the position itself changes — arrow draws, selection
  // flips, and premove queue churn must not re-trigger the engine.
  const positionHash = useBoardSlice(game, (s) => s.hash);
  const isGameOver = useBoardSlice(game, (s) => s.isGameOver);
  const turn = useBoardSlice(game, (s) => s.turn);
  const historyPly = useBoardSlice(game, (s) => s.historyPly);
  const historyLength = useBoardSlice(game, (s) => s.historyLength);
  const inCheck = useBoardSlice(game, (s) => s.inCheck);
  const lastAnalyzedHashRef = useRef<typeof positionHash | null>(null);

  const [evalCp, setEvalCp] = useState<number | null>(null);
  const [mateIn, setMateIn] = useState<string | null>(null);
  const [depth, setDepth] = useState<number>(0);
  const [bestLine, setBestLine] = useState<string>("");
  const [flipped, setFlipped] = useState<boolean>(false);

  // Construct / destroy the worker with the component lifecycle.
  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    return () => {
      engine.terminate();
      engineRef.current = null;
    };
  }, []);

  // Subscribe the engine to a handler that closes over the current turn —
  // the cp score is relative to side-to-move, and we display it
  // White-positive so the sign doesn't flip as the game progresses.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const handler = (msg: StockfishMessage) => {
      if (msg.depth !== undefined) {
        if (msg.depth < MIN_USEFUL_DEPTH) return;
        setDepth(msg.depth);
      }
      if (msg.positionEvaluation !== undefined) {
        const cp = Number(msg.positionEvaluation);
        // UCI reports cp from side-to-move's POV; normalise to White-positive.
        setEvalCp((turn === 0 ? 1 : -1) * (cp / 100));
        setMateIn(null);
      }
      if (msg.possibleMate !== undefined) {
        // Mate scores carry the side-to-move sign too — match the cp case
        // so the readout stays White-positive.
        const signed = (turn === 0 ? 1 : -1) * Number(msg.possibleMate);
        setMateIn(String(signed));
        setEvalCp(null);
      }
      if (msg.pv !== undefined) setBestLine(msg.pv);
    };
    engine.onMessage(handler);
    return () => engine.onMessage(null);
  }, [turn]);

  // Kick off (or restart) analysis whenever the position identity changes.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isGameOver) {
      lastAnalyzedHashRef.current = positionHash;
      engine.stop();
      return;
    }
    if (lastAnalyzedHashRef.current === positionHash) return;
    lastAnalyzedHashRef.current = positionHash;
    setBestLine("");
    setDepth(0);
    engine.evaluatePosition(game.engine.fen(), SEARCH_DEPTH);
    // `positionHash` drives this effect — a new hash means a new position,
    // which means a fresh search. Reading `game.engine.fen()` is the
    // intentional side-effect (and why biome flags positionHash as extra).
  }, [positionHash, game, isGameOver]);

  // Paint the best move as the single "managed" arrow on the board.
  // `setManagedArrows` replaces only the managed subset — whatever the
  // user has drawn by right-click is preserved. An empty list clears
  // the engine hint without touching user drawings. The board's own
  // reflex-clearing hooks (click-to-dismiss / on-move) touch only user
  // arrows, so the hint persists until the engine produces a new PV.
  useEffect(() => {
    const bestUci = bestLine.split(" ")[0];
    const arrow = bestUci ? uciToArrow(bestUci, ENGINE_ARROW_COLOR) : null;
    game.setManagedArrows(arrow ? [arrow] : []);
  }, [game, bestLine]);

  const displayedEval = useMemo(() => {
    if (mateIn !== null) return `#${mateIn}`;
    if (evalCp === null) return "–";
    const signed = evalCp.toFixed(2);
    return evalCp > 0 ? `+${signed}` : signed;
  }, [evalCp, mateIn]);

  const sound: MoveSoundOptions = useMemo(
    () => ({ enabled: true, volume: 0.55, sources: SOUND_SOURCES }),
    [],
  );

  return (
    <section style={layoutStyle}>
      <div style={boardColumnStyle}>
        <div style={boardRowStyle}>
          <EvalBar cp={evalCp} mateIn={mateIn} flipped={flipped} />
          <div style={boardSquareStyle}>
            <Chessboard
              game={game}
              orientation={flipped ? "black" : "white"}
              theme={wood}
              pieces={chesscom}
              sound={sound}
              style={{
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
              }}
            />
          </div>
        </div>
        <Toolbar
          onUndo={() => game.undo()}
          onRedo={() => game.redo()}
          onFlip={() => setFlipped((f) => !f)}
          onReset={() => game.load(START_FEN)}
          canUndo={historyPly > 0}
          canRedo={historyPly < historyLength}
        />
      </div>

      <aside style={sidePanelStyle}>
        <StatusCard
          displayedEval={displayedEval}
          depth={depth}
          turn={turn}
          inCheck={inCheck}
          isGameOver={isGameOver}
          historyPly={historyPly}
          historyLength={historyLength}
        />
        <BestLineCard line={bestLine} />
        <PresetsCard onPick={(fen) => game.load(fen)} />
        <p style={helperTextStyle}>
          Drag pieces or click-to-move to analyse. The green arrow is Stockfish's suggested move;
          the evaluation is in pawns, White-positive.
        </p>
      </aside>
    </section>
  );
}

/* ------------------------------------------------------------------- *
 *                           Sub-components                            *
 * ------------------------------------------------------------------- */

interface EvalBarProps {
  readonly cp: number | null;
  readonly mateIn: string | null;
  readonly flipped: boolean;
}

/**
 * Vertical eval bar rendered flush against the board — lichess-style.
 * White pools at the bottom, black at the top; `flipped` mirrors the
 * board's orientation so "up" always means the side sitting at the top
 * of the board.
 */
function EvalBar({ cp, mateIn, flipped }: EvalBarProps) {
  const whiteRatio =
    mateIn !== null ? (Number(mateIn) >= 0 ? 0.98 : 0.02) : cp === null ? 0.5 : sigmoid(cp * 0.4);
  const whitePct = whiteRatio * 100;
  const blackPct = 100 - whitePct;

  // When the board is flipped, white should appear at the top so the bar
  // still reads "taller = advantage for the side on your end".
  const whiteAtBottom = !flipped;

  return (
    <div style={evalBarShell}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: `${whiteAtBottom ? blackPct : whitePct}%`,
          background: whiteAtBottom ? "#1a1d24" : "#f1f1f1",
          transition: "height 180ms ease-out",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${whiteAtBottom ? whitePct : blackPct}%`,
          background: whiteAtBottom ? "#f1f1f1" : "#1a1d24",
          transition: "height 180ms ease-out",
        }}
      />
    </div>
  );
}

interface StatusCardProps {
  readonly displayedEval: string;
  readonly depth: number;
  readonly turn: number;
  readonly inCheck: boolean;
  readonly isGameOver: boolean;
  readonly historyPly: number;
  readonly historyLength: number;
}

function StatusCard({
  displayedEval,
  depth,
  turn,
  inCheck,
  isGameOver,
  historyPly,
  historyLength,
}: StatusCardProps) {
  const turnLabel = turn === 0 ? "White" : "Black";
  const state = isGameOver
    ? "Game over"
    : inCheck
      ? `${turnLabel} — check`
      : `${turnLabel} to move`;
  const dotColor = isGameOver ? "#ef4444" : inCheck ? "#f59e0b" : "#22c55e";

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.55rem" }}>
        <strong style={{ fontSize: "1.8rem", fontVariantNumeric: "tabular-nums" }}>
          {displayedEval}
        </strong>
        <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
          depth {depth || "—"} / {SEARCH_DEPTH}
        </span>
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.85rem",
          color: "#cfd3da",
        }}
      >
        <Dot color={dotColor} />
        <span>{state}</span>
        <span style={{ color: "#6b7280", marginLeft: "auto" }}>
          ply {historyPly}/{historyLength}
        </span>
      </div>
    </div>
  );
}

function Dot({ color }: { readonly color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}

function BestLineCard({ line }: { readonly line: string }) {
  const trimmed = line.slice(0, 80);
  return (
    <div style={card}>
      <h3 style={cardTitle}>Principal variation</h3>
      <div
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.8rem",
          color: trimmed ? "#cfd3da" : "#6b7280",
          lineHeight: 1.5,
          wordBreak: "break-all",
          minHeight: "2.5em",
        }}
      >
        {trimmed || "Engine thinking…"}
      </div>
    </div>
  );
}

function PresetsCard({ onPick }: { readonly onPick: (fen: string) => void }) {
  return (
    <div style={card}>
      <h3 style={cardTitle}>Presets</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {PRESETS.map(([name, fen]) => (
          <button key={name} type="button" style={buttonGhost} onClick={() => onPick(fen)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToolbarProps {
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onFlip: () => void;
  readonly onReset: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

function Toolbar({ onUndo, onRedo, onFlip, onReset, canUndo, canRedo }: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.4rem",
        flexWrap: "wrap",
        justifyContent: "center",
        marginTop: "1rem",
      }}
    >
      <button type="button" style={buttonGhost} onClick={onUndo} disabled={!canUndo}>
        ← Undo
      </button>
      <button type="button" style={buttonGhost} onClick={onRedo} disabled={!canRedo}>
        Redo →
      </button>
      <button type="button" style={buttonGhost} onClick={onFlip}>
        ⇅ Flip
      </button>
      <button type="button" style={buttonPrimary} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- *
 *                              Helpers                                *
 * ------------------------------------------------------------------- */

/** LERF square index from an algebraic pair like "e2". Returns `null` on garbage input. */
function squareFromAlgebraic(sq: string): SquareIndex | null {
  if (sq.length !== 2) return null;
  const file = sq.charCodeAt(0) - 0x61; // 'a' = 0
  const rank = Number(sq[1]) - 1;
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return (rank * 8 + file) as SquareIndex;
}

/**
 * Build an `Arrow` from a UCI move. The `managed` flag is not set here —
 * `game.setManagedArrows` stamps it at write time, so callers don't have
 * to think about ownership.
 *
 * Returns `null` if the move is malformed (defensive — Stockfish is
 * trusted, but the PV string can race with a `ucinewgame`).
 */
function uciToArrow(uci: string, color: string): Arrow | null {
  if (uci.length < 4) return null;
  const from = squareFromAlgebraic(uci.slice(0, 2));
  const to = squareFromAlgebraic(uci.slice(2, 4));
  if (from === null || to === null) return null;
  return { from, to, color };
}

/**
 * Logistic curve for cp → eval-bar fill. The input is pre-scaled so that
 * ±2 pawns maps to roughly ±0.8 fill — comfortable without hiding small
 * differences near equality.
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/* ------------------------------------------------------------------- *
 *                              Styles                                 *
 * ------------------------------------------------------------------- */

const layoutStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 300px",
  gap: "1.5rem",
  alignItems: "start",
  maxWidth: "1100px",
  margin: "0 auto",
} as const;

const boardColumnStyle = {
  minWidth: 0,
} as const;

const boardRowStyle = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "stretch",
} as const;

const boardSquareStyle = {
  flex: 1,
  aspectRatio: "1 / 1",
  minWidth: 0,
} as const;

const evalBarShell = {
  position: "relative" as const,
  width: "22px",
  borderRadius: "6px",
  overflow: "hidden",
  background: "#0b0e14",
  border: "1px solid #2a2f3a",
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
};

const sidePanelStyle = {
  display: "grid",
  gap: "0.85rem",
  minWidth: 0,
} as const;

const card = {
  background: "#151821",
  border: "1px solid #232836",
  borderRadius: "10px",
  padding: "0.85rem 1rem",
  color: "#cfd3da",
} as const;

const cardTitle = {
  margin: "0 0 0.5rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "#6b7280",
};

const helperTextStyle = {
  margin: 0,
  fontSize: "0.78rem",
  color: "#6b7280",
  lineHeight: 1.55,
};

const loadingShellStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "480px",
  background: "#151821",
  border: "1px solid #232836",
  borderRadius: "10px",
  maxWidth: "1100px",
  margin: "0 auto",
} as const;

const buttonPrimary = {
  background: "#3a7bfd",
  border: "1px solid #3a7bfd",
  color: "white",
  padding: "0.4rem 0.85rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 500,
} as const;

const buttonGhost = {
  background: "transparent",
  border: "1px solid #2a2f3a",
  color: "#cfd3da",
  padding: "0.4rem 0.75rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.82rem",
} as const;
