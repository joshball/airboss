/**
 * Vitest setup -- DOM project only.
 *
 * Registers `@testing-library/jest-dom` matchers (`.toBeInTheDocument`,
 * `.toHaveAttribute`, `.toHaveTextContent`, ...) on Vitest's `expect`.
 * Wired in `vitest.config.ts` for the `unit-dom` project so Svelte
 * component tests can use the standard testing-library matcher set.
 */
import '@testing-library/jest-dom/vitest';
