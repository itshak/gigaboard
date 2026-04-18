import { describe, expect, it } from "vitest";
import { PACKAGE_VERSION } from "../src/index.js";
import { brown } from "../src/brown.js";
import { blue } from "../src/blue.js";
import { green } from "../src/green.js";
import { wood } from "../src/wood.js";

describe("@ultrachess/themes smoke", () => {
  it("exports the package version placeholder", () => {
    expect(PACKAGE_VERSION).toBe("0.0.0");
  });

  it("ships frozen theme records", () => {
    for (const theme of [brown, blue, green, wood]) {
      expect(Object.isFrozen(theme)).toBe(true);
    }
  });
});
