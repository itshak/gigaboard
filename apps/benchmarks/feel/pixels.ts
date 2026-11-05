/**
 * Rendered-pixel oracle, independent of the DOM/board-model assertions.
 * Playwright screenshots are usable for correctness, NOT for high-FPS
 * input-to-photon latency; capturing them can alter the measured timing.
 */
import type { Page } from "@playwright/test";

export interface PixelRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface PixelDiff {
  readonly changedPixels: number;
  readonly totalPixels: number;
  readonly changedFraction: number;
  readonly centroidX: number | null;
  readonly centroidY: number | null;
}

export async function changedPixels(
  page: Page,
  previous: Buffer,
  current: Buffer,
  region: PixelRegion,
  channelDeltaThreshold = 60,
): Promise<PixelDiff> {
  return page.evaluate(async ({ b64a, b64b, region, threshold }) => {
    const decode = async (encoded: string): Promise<ImageData> => {
      const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("FeelLab pixel oracle: no 2d context");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      bitmap.close();
      return data;
    };
    const a = await decode(b64a);
    const b = await decode(b64b);
    if (a.width !== b.width || a.height !== b.height) {
      throw new Error("FeelLab oracle: screenshot dimensions differ");
    }
    const left = Math.max(0, Math.floor(region.x));
    const top = Math.max(0, Math.floor(region.y));
    const right = Math.min(a.width, Math.ceil(region.x + region.width));
    const bottom = Math.min(a.height, Math.ceil(region.y + region.height));
    if (left >= right || top >= bottom) throw new Error("FeelLab oracle: empty ROI");
    let changed = 0, sumX = 0, sumY = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const o = (y * a.width + x) * 4;
        const diff = Math.abs(a.data[o]! - b.data[o]!) +
          Math.abs(a.data[o + 1]! - b.data[o + 1]!) +
          Math.abs(a.data[o + 2]! - b.data[o + 2]!);
        if (diff >= threshold) {
          changed++;
          sumX += x;
          sumY += y;
        }
      }
    }
    const total = (right - left) * (bottom - top);
    return {
      changedPixels: changed,
      totalPixels: total,
      changedFraction: changed / total,
      centroidX: changed ? sumX / changed : null,
      centroidY: changed ? sumY / changed : null,
    };
  }, {
    b64a: previous.toString("base64"),
    b64b: current.toString("base64"),
    region,
    threshold: channelDeltaThreshold,
  });
}

export async function squareRegion(page: Page, square: string): Promise<PixelRegion> {
  return page.evaluate((name) => {
    const board = document.querySelector<HTMLElement>("#bench-board");
    const squareEl = document.querySelector<HTMLElement>('[data-square="' + name + '"]');
    if (!board || !squareEl) throw new Error("FeelLab: missing board/square " + name);
    const outer = board.getBoundingClientRect();
    const rect = squareEl.getBoundingClientRect();
    const scale = window.devicePixelRatio;
    return {
      x: (rect.left - outer.left) * scale,
      y: (rect.top - outer.top) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  }, square);
}
