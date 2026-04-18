/**
 * Vitest setup for the React package. Registers `@testing-library`
 * matchers and ensures automatic cleanup between tests.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
