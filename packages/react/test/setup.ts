/**
 * Vitest setup for the React package. Registers `@testing-library`
 * matchers and ensures automatic cleanup between tests.
 */

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
