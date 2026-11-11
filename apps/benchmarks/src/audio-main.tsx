/**
 * Production-build Playwright fixture: a REAL interactive Chessboard controlled
 * by a React host, mirroring BlindBase's onMove -> accepted FEN -> GigaBoard
 * acknowledgment, including its always-present managedArrows prop.
 *
 * Test-only in apps/benchmarks; never shipped in the published library.
 * The onCue probe records semantic keys, not physical loudspeaker output.
 */
import { Chess } from "chess.js";
import {
  Chessboard,
  type MoveSoundKey,
  type MoveSoundOptions,
  type PositionTransition,
} from "gigaboard";
import {
  type Arrow,
  type BoardModel,
  createBoardModel,
  createGigachessAdapter,
  type SquareIndex,
} from "gigaboard/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type ArrowMode = "none" | "empty" | "populated";
type CuePolicy = "default" | "san-priority";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function square(name: string): SquareIndex {
  return (name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8) as SquareIndex;
}

interface AudioE2EApi {
  readonly ready: true;
  fen(): string;
  controlledFen(): string;
  cues(): MoveSoundKey[];
  moveCount(): number;
  clearCues(): void;
  reset(fen?: string): Promise<void>;
  externalMove(uci: string, includeTransition?: boolean): void;
  rejectNextMove(): void;
  setArrows(mode: ArrowMode): void;
  setEnabled(enabled: boolean): void;
  setCuePolicy(policy: CuePolicy): void;
}

declare global {
  interface Window {
    __gbAudioE2E__?: AudioE2EApi;
  }
}

function AudioFixture() {
  const [model, setModel] = useState<BoardModel | null>(null);
  const [controlledFen, setControlledFen] = useState(START);
  const [arrowMode, setArrowMode] = useState<ArrowMode>("empty");
  const [enabled, setEnabled] = useState(true);
  const [cuePolicy, setCuePolicy] = useState<CuePolicy>("san-priority");
  const [positionTransition, setPositionTransition] = useState<PositionTransition | null>(null);
  const controlledFenRef = useRef(START);
  const rejectNextRef = useRef(false);
  const cuesRef = useRef<MoveSoundKey[]>([]);
  const acceptedMovesRef = useRef(0);

  useEffect(() => {
    const next = createBoardModel(createGigachessAdapter());
    controlledFenRef.current = next.engine.fen();
    setControlledFen(controlledFenRef.current);
    setModel(next);
    return () => next.dispose();
  }, []);

  const sound = useMemo<MoveSoundOptions>(
    () => ({
      enabled,
      trigger: "position",
      cuePolicy,
      onCue: (key) => {
        cuesRef.current.push(key);
      },
    }),
    [enabled, cuePolicy],
  );

  const managedArrows = useMemo<readonly Arrow[] | undefined>(() => {
    if (arrowMode === "none") return undefined;
    if (arrowMode === "empty") return [];
    return [{ from: square("a1"), to: square("a4"), color: "#e44" }];
  }, [arrowMode]);

  const onMove = useCallback(() => {
    if (model === null) return;
    if (rejectNextRef.current) {
      rejectNextRef.current = false;
      model.load(controlledFenRef.current);
      return;
    }
    acceptedMovesRef.current++;
    controlledFenRef.current = model.engine.fen();
    setPositionTransition(null);
    setControlledFen(controlledFenRef.current);
  }, [model]);

  useEffect(() => {
    if (model === null) return;
    const api: AudioE2EApi = {
      ready: true,
      fen: () => model.engine.fen(),
      controlledFen: () => controlledFenRef.current,
      cues: () => cuesRef.current.slice(),
      moveCount: () => acceptedMovesRef.current,
      clearCues: () => {
        cuesRef.current = [];
      },
      async reset(fen = START) {
        rejectNextRef.current = false;
        model.load(fen);
        controlledFenRef.current = fen;
        setPositionTransition(null);
        setControlledFen(fen);
        acceptedMovesRef.current = 0;
        // Let the host FEN render settle before clearing any artificial
        // reset cue; assertions concern subsequent real user interactions.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        cuesRef.current = [];
      },
      externalMove(uci, includeTransition = false) {
        const move = new Chess(controlledFenRef.current);
        const played = move.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          ...(uci.length === 5 ? { promotion: uci[4] } : {}),
        });
        if (played === null) throw new Error(`Illegal test move: ${uci}`);
        const after = move.fen();
        controlledFenRef.current = after;
        setPositionTransition(includeTransition ? { uci, direction: "forward" } : null);
        setControlledFen(after);
        acceptedMovesRef.current++;
      },
      rejectNextMove: () => {
        rejectNextRef.current = true;
      },
      setArrows: setArrowMode,
      setEnabled,
      setCuePolicy,
    };
    window.__gbAudioE2E__ = api;
    return () => {
      if (window.__gbAudioE2E__ === api) delete window.__gbAudioE2E__;
    };
  }, [model]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <h1>Controlled board audio — browser E2E fixture</h1>
      <p>
        Actual pointer/keyboard inputs. Captured onCue keys are semantic evidence, not speaker
        audibility.
      </p>
      <div id="audio-board" style={{ width: 400, height: 400 }}>
        <Chessboard
          game={model}
          fallbackFen={START}
          {...(model === null ? {} : { positionFen: controlledFen })}
          positionTransition={positionTransition}
          {...(managedArrows === undefined ? {} : { managedArrows })}
          onMove={onMove}
          sound={sound}
          animation={{ durationMs: 0 }}
        />
      </div>
    </main>
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("Missing audio test root");
createRoot(root).render(<AudioFixture />);
