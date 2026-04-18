import { describe, expect, it } from "vitest";
import { PACKAGE_VERSION, brown, blue, green, wood, themes } from "../src/index.js";

describe("@ultrachess/themes", () => {
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
      "--ucr-sq-light",
      "--ucr-sq-dark",
      "--ucr-last-move",
      "--ucr-selected",
      "--ucr-legal-target",
      "--ucr-legal-target-capture",
      "--ucr-check",
      "--ucr-coord-light",
      "--ucr-coord-dark",
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
    expect(green["--ucr-sq-light"]).toBe("#eeeed2");
    expect(green["--ucr-sq-dark"]).toBe("#769656");
  });
});
