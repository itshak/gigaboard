import { describe, expect, it } from "vitest";
import { blue, brown, green, PACKAGE_VERSION, themes, wood } from "../src/index.js";

describe("@gigaboard/themes", () => {
  it("exports a semver-looking version string", () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("ships frozen theme records", () => {
    for (const theme of [brown, blue, green, wood]) {
      expect(Object.isFrozen(theme)).toBe(true);
    }
  });

  it("every theme defines the core board CSS variables", () => {
    const required = [
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

    for (const [name, theme] of Object.entries({ brown, blue, green, wood })) {
      for (const key of required) {
        expect(theme[key], `${name} missing ${key}`).toBeDefined();
      }
    }
  });

  it("the theme registry includes all four built-ins", () => {
    expect(Object.keys(themes).sort()).toEqual(["blue", "brown", "green", "wood"]);
  });

  it("green matches the chess.com default palette", () => {
    expect(green["--gb-sq-light"]).toBe("#eeeed2");
    expect(green["--gb-sq-dark"]).toBe("#769656");
  });
});
