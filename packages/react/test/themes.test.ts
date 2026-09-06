import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  blue,
  brown,
  cafeCreme,
  canvas,
  chesscomBlue,
  chesscomGreen,
  darkWood,
  deuteranopia,
  espresso,
  green,
  highContrast,
  ic,
  leather,
  marble,
  neon,
  newspaper,
  olive,
  pink,
  purple,
  themes,
  tritanopia,
  walnut,
  wood,
} from "../src/themes/index.js";

const REQUIRED_CORE_KEYS = [
  "--gb-sq-light",
  "--gb-sq-dark",
  "--gb-last-move",
  "--gb-selected",
  "--gb-legal-target",
  "--gb-legal-target-capture",
  "--gb-check",
  "--gb-coord-light",
  "--gb-coord-dark",
] as const;

describe("Theme Catalog (Unit Tests)", () => {
  it("exports all 22 theme objects and registry mapping", () => {
    expect(Object.keys(themes).length).toBeGreaterThanOrEqual(21);
    expect(themes.blue).toBe(blue);
    expect(themes.brown).toBe(brown);
    expect(themes.green).toBe(green);
    expect(themes.wood).toBe(wood);
    expect(themes.newspaper).toBe(newspaper);
    expect(themes.espresso).toBe(espresso);
    expect(themes.cafeCreme).toBe(cafeCreme);
    expect(themes.canvas).toBe(canvas);
    expect(themes.leather).toBe(leather);
    expect(themes.marble).toBe(marble);
    expect(themes.walnut).toBe(walnut);
    expect(themes.darkWood).toBe(darkWood);
    expect(themes.neon).toBe(neon);
    expect(themes.olive).toBe(olive);
    expect(themes.pink).toBe(pink);
    expect(themes.purple).toBe(purple);
    expect(themes.ic).toBe(ic);
    expect(themes.highContrast).toBe(highContrast);
    expect(themes.chesscomGreen).toBe(chesscomGreen);
    expect(themes.chesscomBlue).toBe(chesscomBlue);
    expect(themes.deuteranopia).toBe(deuteranopia);
    expect(themes.tritanopia).toBe(tritanopia);
  });

  it("every theme is frozen and defines valid core CSS variables", () => {
    for (const [name, theme] of Object.entries(themes)) {
      expect(Object.isFrozen(theme), `Theme ${name} should be frozen`).toBe(true);
      for (const key of REQUIRED_CORE_KEYS) {
        const val = theme[key];
        expect(val, `Theme ${name} missing ${key}`).toBeDefined();
        expect(typeof val, `Theme ${name}[${key}] should be string`).toBe("string");
        expect(val.trim().length, `Theme ${name}[${key}] should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  describe("Textured and Patterned Themes", () => {
    it("newspaper theme defines valid SVG hatching patterns and piece filters", () => {
      expect(newspaper["--gb-sq-light-image"]).toContain("data:image/svg+xml");
      expect(newspaper["--gb-sq-dark-image"]).toContain("data:image/svg+xml");
      expect(newspaper["--gb-sq-image-size"]).toBeDefined();
      expect(newspaper["--gb-sq-blend-mode"]).toBeDefined();
      expect(newspaper["--gb-piece-filter-white"]).toBeDefined();
      expect(newspaper["--gb-piece-filter-black"]).toBeDefined();

      // Extract and verify SVG content
      const match = newspaper["--gb-sq-light-image"]?.match(/data:image\/svg\+xml,([^"]+)/);
      expect(match).toBeDefined();
      const decodedSvg = decodeURIComponent(match![1]);
      expect(decodedSvg).toContain("<svg");
      expect(decodedSvg).toContain("</svg>");
    });

    it("espresso and cafeCreme define valid grain/texture data-URIs", () => {
      for (const theme of [espresso, cafeCreme]) {
        expect(theme["--gb-sq-light-image"]).toContain("data:image/svg+xml");
        expect(theme["--gb-sq-dark-image"]).toContain("data:image/svg+xml");
        expect(theme["--gb-sq-image-size"]).toBeDefined();
        expect(theme["--gb-sq-blend-mode"]).toBeDefined();
      }
    });

    it("tactile themes define valid pattern or gradient textures", () => {
      expect(canvas["--gb-sq-light-image"]).toContain("data:image/svg+xml");
      expect(leather["--gb-sq-light-image"]).toContain("data:image/svg+xml");
      expect(marble["--gb-sq-light-image"]).toContain("linear-gradient");
      expect(walnut["--gb-sq-light-image"]).toContain("linear-gradient");
      expect(darkWood["--gb-sq-light-image"]).toContain("linear-gradient");
    });
  });

  describe("Accessibility and Colorblind Themes", () => {
    it("highContrast defines outline filters for both white and black pieces", () => {
      expect(highContrast["--gb-piece-filter-white"]).toContain("drop-shadow");
      expect(highContrast["--gb-piece-filter-black"]).toContain("drop-shadow");
      expect(highContrast["--gb-sq-light"]).toBe("#ffffff");
      expect(highContrast["--gb-sq-dark"]).toBe("#000000");
    });

    it("deuteranopia avoids red/green square colors and provides high-contrast cues", () => {
      // Uses blue dark square
      expect(deuteranopia["--gb-sq-dark"]).toBe("#3b6998");
      expect(deuteranopia["--gb-piece-filter-white"]).toBeDefined();
      expect(deuteranopia["--gb-piece-filter-black"]).toBeDefined();
      expect(deuteranopia["--gb-last-move"]).toContain("255, 191, 0");
    });

    it("tritanopia avoids blue/yellow confusion and provides distinct violet highlights", () => {
      expect(tritanopia["--gb-sq-light"]).toBe("#d6ece5");
      expect(tritanopia["--gb-sq-dark"]).toBe("#c75d5d");
      expect(tritanopia["--gb-piece-filter-white"]).toBeDefined();
      expect(tritanopia["--gb-piece-filter-black"]).toBeDefined();
      expect(tritanopia["--gb-last-move"]).toContain("160, 32, 240");
    });
  });

  describe("Bundle Size Budget (<350 bytes/theme gzipped)", () => {
    const distThemesDir = path.resolve(__dirname, "../dist/themes");

    it("each compiled theme bundle in dist/themes/*.js is under 350 bytes gzipped", () => {
      if (!fs.existsSync(distThemesDir)) {
        // If dist hasn't been built in this environment yet, skip gracefully
        return;
      }
      const files = fs.readdirSync(distThemesDir).filter((f) => f.endsWith(".js"));
      expect(files.length).toBeGreaterThanOrEqual(21);

      for (const file of files) {
        const filePath = path.join(distThemesDir, file);
        const content = fs.readFileSync(filePath);
        const gzipped = zlib.gzipSync(content);
        expect(
          gzipped.byteLength,
          `Theme ${file} gzipped size ${gzipped.byteLength}B exceeds 350B budget`,
        ).toBeLessThan(350);
      }
    });
  });
});
