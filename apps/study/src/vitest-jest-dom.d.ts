/// <reference types="@testing-library/jest-dom" />

/**
 * Global type augmentation for Vitest's `expect` to surface
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`,
 * `toHaveTextContent`, etc.) inside the study app's Svelte component tests.
 *
 * Runtime registration lives in the workspace's `vitest.setup.dom.ts`. This
 * `.d.ts` makes the matchers visible to svelte-check via tsconfig include of
 * `src/**\/*.ts`. Without it, svelte-check surfaces
 * `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`
 * even though the matcher is registered at test-runtime.
 *
 * Mirrors the file at `apps/hangar/src/vitest-jest-dom.d.ts`. Add a copy in any
 * other app's `src/` once it grows inline `.svelte.test.ts` files using these
 * matchers.
 */
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
	interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
	interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
