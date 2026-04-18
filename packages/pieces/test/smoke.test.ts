import { describe, expect, it } from "vitest";
import { PACKAGE_VERSION } from "../src/index.js";

describe("@ultrachess/pieces smoke", () => {
  it("exports the package version placeholder", () => {
    expect(PACKAGE_VERSION).toBe("0.0.0");
  });
});
