import { describe, expect, it } from "vitest";
import { PACKAGE_VERSION } from "../src/index.js";
import { SERVER_PACKAGE_VERSION } from "../src/server.js";
import { CANVAS_RENDERER_VERSION } from "../src/renderers/canvas.js";

describe("@ultrachess/react smoke", () => {
  it("exports the package version placeholder", () => {
    expect(PACKAGE_VERSION).toBe("0.0.0");
  });

  it("exports the server entry placeholder", () => {
    expect(SERVER_PACKAGE_VERSION).toBe("0.0.0");
  });

  it("exports the canvas renderer placeholder", () => {
    expect(CANVAS_RENDERER_VERSION).toBe("0.0.0");
  });
});
