/**
 * Giga Crownless — original, cross-free Staunton-inspired chess piece family.
 *
 * Twelve SVG images are generated once as data URLs, then pooled by
 * createImagePieceSet. Importing this optional set does not change the
 * default board or fetch any third-party artwork over the network.
 *
 * Design: faceted diamond finial for the king (no cross), five queen
 * jewels, crisp battlements, mitred bishop, sculpted knight and heavy
 * double-rim bases. Distinct ink/etching palettes retain contrast on
 * light and dark squares. Original vector geometry, MIT.
 *
 * Note: Consumers using a restrictive CSP must allow img-src data:.
 */
import { createImagePieceSet, type PieceUrlTable } from "../create-image-piece-set.js";

export type GigaCrownlessRole = "P" | "N" | "B" | "R" | "Q" | "K";
export type GigaCrownlessSide = "w" | "b";

interface Glyph { readonly silhouette: string; readonly engraving: string; }

const GLYPHS: Record<GigaCrownlessRole, Glyph> = {
  "P": {
    "silhouette": "<circle cx=\"32\" cy=\"16\" r=\"9\"/><path d=\"M25 28 Q32 25 39 28 L42 33 Q38 36 38 40 L44 49 H20 L26 40 Q26 36 22 33 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<path d=\"M24 32 Q32 35 40 32\"/><path d=\"M17 53 H47\"/>"
  },
  "N": {
    "silhouette": "<path d=\"M16 49 C17 43 22 38 20 33 L13 35 Q8 34 9 29 L14 24 L12 21 L20 18 L24 9 L29 17 L35 14 C44 19 47 27 44 35 L40 42 L46 49 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<circle cx=\"21\" cy=\"23\" r=\"1.6\"/><path d=\"M30 19 Q39 26 37 35 L33 41\"/><path d=\"M15 30 L20 30\"/><path d=\"M18 53 H47\"/>"
  },
  "B": {
    "silhouette": "<path d=\"M32 8 C41 15 45 24 43 32 Q42 37 37 40 L41 44 L46 49 H18 L23 44 L27 40 Q22 37 21 32 C19 24 23 15 32 8 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<path d=\"M23 31 L41 20\"/><path d=\"M25 41 Q32 44 39 41\"/><path d=\"M19 53 H45\"/>"
  },
  "R": {
    "silhouette": "<path d=\"M13 12 H21 V19 H27 V12 H37 V19 H43 V12 H51 V25 H47 L44 46 L48 49 H16 L20 46 L17 25 H13 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<path d=\"M17 25 H47\"/><path d=\"M22 42 Q32 45 42 42\"/><path d=\"M28 32 V37 M36 32 V37\"/><path d=\"M17 53 H47\"/>"
  },
  "Q": {
    "silhouette": "<circle cx=\"13\" cy=\"16\" r=\"3.5\"/><circle cx=\"23\" cy=\"10\" r=\"3.5\"/><circle cx=\"32\" cy=\"15\" r=\"3.5\"/><circle cx=\"41\" cy=\"10\" r=\"3.5\"/><circle cx=\"51\" cy=\"16\" r=\"3.5\"/><path d=\"M14 22 L20 34 L20 39 Q32 44 44 39 L44 34 L50 22 L40 27 L32 21 L24 27 Z\"/><path d=\"M24 40 L20 49 H44 L40 40 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<path d=\"M20 36 Q32 40 44 36\"/><path d=\"M25 28 L27 34 M39 28 L37 34\"/><path d=\"M18 53 H46\"/>"
  },
  "K": {
    "silhouette": "<polygon points=\"32,6 39,13 32,20 25,13\"/><path d=\"M17 26 Q19 20 24 24 L32 29 L40 24 Q45 20 47 26 L44 37 Q41 40 40 43 L46 49 H18 L24 43 Q23 40 20 37 Z\"/><path d=\"M15 49 Q32 46 49 49 L52 54 Q52 57 48 57 H16 Q12 57 12 54 Z\"/>",
    "engraving": "<path d=\"M22 36 Q32 42 42 36\"/><path d=\"M32 29 V37\"/><path d=\"M18 53 H46\"/>"
  }
};

const COLORS: Record<GigaCrownlessSide, { fill: string; outline: string; etch: string }> = {
  "w": {
    "fill": "#f8f1e5",
    "outline": "#202b39",
    "etch": "#647786"
  },
  "b": {
    "fill": "#263443",
    "outline": "#101721",
    "etch": "#d8e3dc"
  }
};

/** Editable source SVG for one piece, useful for producing standalone image assets. */
export function gigaCrownlessSvg(role: GigaCrownlessRole, side: GigaCrownlessSide): string {
  const palette = COLORS[side];
  const glyph = GLYPHS[role];
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img">',
    '<g fill="' + palette.fill + '" stroke="' + palette.outline + '" stroke-width="2.7" stroke-linejoin="round" stroke-linecap="round">',
    glyph.silhouette,
    "</g>",
    '<g fill="none" stroke="' + palette.etch + '" stroke-width="2.05" stroke-linecap="round" stroke-linejoin="round">',
    glyph.engraving,
    "</g></svg>",
  ].join("");
}

function imageUrl(role: GigaCrownlessRole, side: GigaCrownlessSide): string {
  return "data:image/svg+xml," + encodeURIComponent(gigaCrownlessSvg(role, side));
}

const urls: PieceUrlTable = Object.freeze({
  1: imageUrl("P", "w"), 2: imageUrl("N", "w"),
  3: imageUrl("B", "w"), 4: imageUrl("R", "w"),
  5: imageUrl("Q", "w"), 6: imageUrl("K", "w"),
  7: imageUrl("P", "b"), 8: imageUrl("N", "b"),
  9: imageUrl("B", "b"), 10: imageUrl("R", "b"),
  11: imageUrl("Q", "b"), 12: imageUrl("K", "b"),
});

/** Select via pieces={gigaCrownless} or gigaboard/pieces/giga-crownless. */
export const gigaCrownless = createImagePieceSet(urls);
