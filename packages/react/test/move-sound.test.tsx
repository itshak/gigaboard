/**
 * `useMoveSound` tests.
 *
 * happy-dom lacks `HTMLAudioElement`, so we install a tracking `Audio`
 * stub on `globalThis` before each test. The stub records `.play()`
 * calls so assertions can verify *which* cue fired for a given move.
 */

import { act, render } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMoveSound } from "../src/hooks/use-move-sound.js";
import { makeBoardModel } from "./helpers.js";

/** A minimal, trackable `HTMLAudioElement` substitute. */
class AudioStub {
  static plays: Array<{ url: string; volume: number }> = [];
  static instances: AudioStub[] = [];

  src: string;
  volume = 1;
  currentTime = 0;
  preload = "";

  constructor(src: string) {
    this.src = src;
    AudioStub.instances.push(this);
  }

  play(): Promise<void> {
    AudioStub.plays.push({ url: this.src, volume: this.volume });
    return Promise.resolve();
  }

  static reset(): void {
    AudioStub.plays = [];
    AudioStub.instances = [];
  }

  /** The last URL played (for quick-last-cue assertions). */
  static lastUrl(): string | undefined {
    return AudioStub.plays.at(-1)?.url;
  }
}

/** Infer a cue name from a URL by matching its file stem. */
function cueOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  const match = url.match(/([a-z-]+)(?:-[A-Z0-9]+)?\.mp3/i);
  return match?.[1];
}

/** Minimal consumer: mounts `useMoveSound` against a model. */
function SoundProbe({
  model,
  options,
}: {
  model: BoardModel | null;
  options?: Parameters<typeof useMoveSound>[1];
}) {
  useMoveSound(model, options);
  return null;
}

describe("useMoveSound", () => {
  beforeEach(() => {
    AudioStub.reset();
    vi.stubGlobal("Audio", AudioStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allocates a pool on mount when enabled", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} />);
      // 7 keys × 4 pool size = 28 instances.
      expect(AudioStub.instances.length).toBe(28);
    } finally {
      model.dispose();
    }
  });

  it("allocates nothing when disabled", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} options={{ enabled: false }} />);
      expect(AudioStub.instances.length).toBe(0);
    } finally {
      model.dispose();
    }
  });

  it("plays moveSelf for a plain move", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(12 as never, 28 as never); // e2 → e4
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("move-self");
    } finally {
      model.dispose();
    }
  });

  it("plays capture for a capture move", async () => {
    // Set up a position where white can capture on e5.
    const model = await makeBoardModel(
      "rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1",
    );
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(27 as never, 36 as never); // d4 × e5
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("capture");
    } finally {
      model.dispose();
    }
  });

  it("plays castle for O-O", async () => {
    const model = await makeBoardModel(
      "r3k2r/pppqppbp/2np1np1/8/8/2NP1NP1/PPPQPPBP/R3K2R w KQkq - 0 1",
    );
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(4 as never, 6 as never); // e1 → g1 (castles kingside)
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("castle");
    } finally {
      model.dispose();
    }
  });

  it("plays moveCheck when the move delivers check", async () => {
    const model = await makeBoardModel(
      "rnbqkbnr/ppp2ppp/8/3pp3/8/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 1",
    );
    try {
      render(<SoundProbe model={model} />);
      // Bishop from c1 is blocked; use Qd2→h6+? That isn't check. Use a simple
      // position where a move gives check.
      model.load("4k3/8/8/8/8/8/8/4K2R w K - 0 1");
      render(<SoundProbe model={model} />);
      AudioStub.reset();
      act(() => {
        // Re-allocate the pool since we re-rendered with a new model.
      });
      // The second probe's pool is fresh — now play a rook-check: Rh8+.
      act(() => {
        model.tryMove(7 as never, 63 as never); // h1 → h8 (check on e8 king)
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("move-check");
    } finally {
      model.dispose();
    }
  });

  it("plays promote for a promotion move", async () => {
    const model = await makeBoardModel("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(48 as never, 56 as never, 4 /* Queen */ as never); // a7 → a8=Q
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("promote");
    } finally {
      model.dispose();
    }
  });

  it("plays gameEnd when the move ends the game (checkmate)", async () => {
    // Back-rank mate: White plays Rd8#
    const model = await makeBoardModel("6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1");
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(3 as never, 59 as never); // d1 → d8 (mate)
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("game-end");
    } finally {
      model.dispose();
    }
  });

  it("does NOT play on undo", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} />);
      act(() => {
        model.tryMove(12 as never, 28 as never); // e2 → e4
      });
      const after = AudioStub.plays.length;
      act(() => {
        model.undo();
      });
      expect(AudioStub.plays.length).toBe(after);
    } finally {
      model.dispose();
    }
  });

  it("respects custom sources — the overridden key uses the provided URL", async () => {
    const model = await makeBoardModel();
    try {
      render(
        <SoundProbe
          model={model}
          options={{ sources: { moveSelf: "https://example.com/custom.mp3" } }}
        />,
      );
      act(() => {
        model.tryMove(12 as never, 28 as never);
      });
      expect(AudioStub.lastUrl()).toBe("https://example.com/custom.mp3");
    } finally {
      model.dispose();
    }
  });

  it("perspective=0 plays moveSelf for white's move and moveOpponent for black's", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} options={{ perspective: 0 }} />);
      act(() => {
        model.tryMove(12 as never, 28 as never); // white e2-e4
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("move-self");
      act(() => {
        model.tryMove(52 as never, 36 as never); // black e7-e5
      });
      expect(cueOf(AudioStub.lastUrl())).toBe("move-opponent");
    } finally {
      model.dispose();
    }
  });

  it("applies the volume setting", async () => {
    const model = await makeBoardModel();
    try {
      render(<SoundProbe model={model} options={{ volume: 0.25 }} />);
      act(() => {
        model.tryMove(12 as never, 28 as never);
      });
      const play = AudioStub.plays.at(-1);
      expect(play?.volume).toBe(0.25);
    } finally {
      model.dispose();
    }
  });

  it("does nothing when the model is null", () => {
    render(<SoundProbe model={null} />);
    expect(AudioStub.plays.length).toBe(0);
  });
});
