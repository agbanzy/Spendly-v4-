import { vi } from "vitest";

// Module-scoped spy used by both the vi.mock factory in
// payment-provider-routing.test.ts (which can't reference top-level
// test-file vars due to mock hoisting) and the test bodies.
export const warnSpy = vi.fn();
