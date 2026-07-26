import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without this, DOM trees from earlier tests in the same file accumulate (React Testing
// Library does not clean up automatically outside of Jest's global afterEach hook).
afterEach(() => {
  cleanup();
});
