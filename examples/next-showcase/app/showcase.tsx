"use client";

import type { LegalTargetStyle, MoveSoundOptions, Orientation } from "gigaboard";
import { Chessboard, useChessGame } from "gigaboard";
import type { PackedMove } from "gigaboard/core";
import { alpha, cburnett, merida, neo } from "gigaboard/pieces";
import { chesscom } from "gigaboard/pieces/chesscom";
import type { Theme } from "gigaboard/themes";
import { blue, brown, green, wood } from "gigaboard/themes";
import { useCallback, useMemo, useState } from "react";
import { Controls } from "./controls";
import { MoveLog } from "./move-log";
import { StatusPanel } from "./status-panel";

/** Registries keyed by the string shown in the pickers. */
export const THEMES = { brown, green, blue, wood } as const satisfies Record<string, Theme>;
export type ThemeName = keyof typeof THEMES;

export const PIECE_SETS = { neo, chesscom, alpha, cburnett, merida } as const;
export type PieceSetName = keyof typeof PIECE_SETS;

/**
 * Explicit sound sources — the postinstall script (`scripts/copy-sounds.mjs`)
 * copies the shipped .mp3 assets from the gigaboard package into
 * `public/sounds/` with stable filenames, and this map wires them up.
 *
 * Without this override the library would try to fetch the hashed asset names
 * baked into the bundle (e.g. `move-self-66AY7WGX.mp3`), which 404 against the
 * consumer app's static-file root.
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

/** A handful of interesting FENs to load via the "preset" dropdown. */
export const FEN_PRESETS = {
  Start: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "Italian Game": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "Sicilian — Najdorf": "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
  "Endgame — K+R vs K": "8/8/8/4k3/8/8/4K3/4R3 w - - 0 1",
  "Fool's Mate": "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
} as const;
export type PresetName = keyof typeof FEN_PRESETS;

export interface ShowcaseConfig {
  themeName: ThemeName;
  pieceSetName: PieceSetName;
  orientation: Orientation;
  showCoordinates: boolean;
  legalTargets: LegalTargetStyle;
  highlightLastMove: boolean;
  allowDrag: boolean;
  allowDrawingArrows: boolean;
  allowPremove: boolean;
  showCheckHighlight: boolean;
  showIllegalFlash: boolean;
  animationEnabled: boolean;
  animationDurationMs: number;
  soundEnabled: boolean;
  soundVolume: number;
}

const DEFAULT_CONFIG: ShowcaseConfig = {
  themeName: "green",
  pieceSetName: "neo",
  orientation: "white",
  showCoordinates: true,
  legalTargets: "rings",
  highlightLastMove: true,
  allowDrag: true,
  allowDrawingArrows: true,
  allowPremove: false,
  showCheckHighlight: true,
  showIllegalFlash: true,
  animationEnabled: true,
  animationDurationMs: 60,
  soundEnabled: true,
  soundVolume: 0.6,
};

export function Showcase() {
  const [config, setConfig] = useState<ShowcaseConfig>(DEFAULT_CONFIG);
  // Bumping this remounts the board with a fresh FEN (cleanest way to let
  // `useChessGame`'s `fen` option re-seed the engine).
  const [fen, setFen] = useState<string>(FEN_PRESETS.Start);
  const [gameKey, setGameKey] = useState<number>(0);
  const [moves, setMoves] = useState<PackedMove[]>([]);

  const game = useChessGame({ fen });

  const onMove = useCallback((move: PackedMove) => {
    setMoves((prev) => [...prev, move]);
  }, []);

  const reloadWith = useCallback((nextFen: string) => {
    setFen(nextFen);
    setMoves([]);
    setGameKey((k) => k + 1);
  }, []);

  const sound: boolean | MoveSoundOptions = useMemo(() => {
    if (!config.soundEnabled) return false;
    return {
      enabled: true,
      volume: config.soundVolume,
      sources: SOUND_SOURCES,
    };
  }, [config.soundEnabled, config.soundVolume]);

  const animation = config.animationEnabled
    ? { durationMs: config.animationDurationMs }
    : { durationMs: 0 };

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 320px",
        gap: "1.5rem",
        alignItems: "start",
      }}
    >
      <div>
        <div
          style={{
            aspectRatio: "1 / 1",
            maxWidth: "640px",
            width: "100%",
            marginInline: "auto",
          }}
        >
          <Chessboard
            key={gameKey}
            game={game}
            orientation={config.orientation}
            theme={THEMES[config.themeName]}
            pieces={PIECE_SETS[config.pieceSetName]}
            showCoordinates={config.showCoordinates}
            showLegalTargets={config.legalTargets}
            highlightLastMove={config.highlightLastMove}
            allowDrag={config.allowDrag}
            allowDrawingArrows={config.allowDrawingArrows}
            allowPremove={config.allowPremove}
            showCheckHighlight={config.showCheckHighlight}
            showIllegalFlash={config.showIllegalFlash}
            animation={animation}
            sound={sound}
            onMove={onMove}
            style={{
              borderRadius: "10px",
              overflow: "hidden",
              boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: "1rem",
          }}
        >
          <PresetButtons onPick={reloadWith} />
        </div>
        <div style={{ marginTop: "1rem" }}>
          <StatusPanel
            game={game}
            onUndo={() => game?.undo()}
            onRedo={() => game?.redo()}
            onReset={() => reloadWith(FEN_PRESETS.Start)}
          />
        </div>
      </div>

      <aside style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
        <Controls config={config} onChange={setConfig} />
        <FenPanel currentFen={fen} onLoad={reloadWith} />
        <MoveLog moves={moves} />
      </aside>
    </section>
  );
}

function PresetButtons({ onPick }: { readonly onPick: (fen: string) => void }) {
  return (
    <>
      {(Object.keys(FEN_PRESETS) as PresetName[]).map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(FEN_PRESETS[name])}
          style={{
            background: "#1a1d24",
            border: "1px solid #2a2f3a",
            color: "#cfd3da",
            padding: "0.4rem 0.75rem",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          {name}
        </button>
      ))}
    </>
  );
}

function FenPanel({
  currentFen,
  onLoad,
}: {
  readonly currentFen: string;
  readonly onLoad: (fen: string) => void;
}) {
  const [draft, setDraft] = useState(currentFen);
  return (
    <div
      style={{
        background: "#151821",
        border: "1px solid #232836",
        borderRadius: "8px",
        padding: "0.85rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#cfd3da" }}>FEN</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        rows={3}
        style={{
          width: "100%",
          background: "#0b0e14",
          color: "#cfd3da",
          border: "1px solid #2a2f3a",
          borderRadius: "6px",
          padding: "0.5rem",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.8rem",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button type="button" onClick={() => onLoad(draft.trim())} style={buttonPrimaryStyle}>
          Load
        </button>
        <button type="button" onClick={() => setDraft(currentFen)} style={buttonGhostStyle}>
          Revert
        </button>
      </div>
    </div>
  );
}

export const buttonPrimaryStyle = {
  background: "#3a7bfd",
  border: "1px solid #3a7bfd",
  color: "white",
  padding: "0.4rem 0.85rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 500,
} as const;

export const buttonGhostStyle = {
  background: "transparent",
  border: "1px solid #2a2f3a",
  color: "#cfd3da",
  padding: "0.4rem 0.85rem",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "0.85rem",
} as const;
