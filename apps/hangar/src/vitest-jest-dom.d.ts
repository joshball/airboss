/// <reference types="@testing-library/jest-dom" />

/**
 * Global type augmentation for Vitest's `expect` to surface
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`,
 * `toHaveTextContent`, etc.) inside hangar's Svelte component tests.
 *
 * Runtime registration lives in the workspace's `vitest.setup.dom.ts`. This
 * `.d.ts` makes the matchers visible to hangar's svelte-check pass via
 * tsconfig include of `src/**\/*.ts`. Without it, svelte-check surfaces
 * `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`
 * even though the matcher is registered at test-runtime.
 *
 * Lives under `apps/hangar/src/` because hangar is currently the only app
 * with inline `.svelte.test.ts` files using the matchers; if other apps
 * grow tests using these matchers, copy this file into their `src/` (the
 * one-line `import 'vitest'` triggers the augmentation per-tsconfig).
 */
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
	interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
	interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
