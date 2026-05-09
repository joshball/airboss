/// <reference types="@testing-library/jest-dom" />

/**
 * Global type augmentation for Vitest's `expect` to surface
 * `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveAttribute`,
 * `toHaveTextContent`, etc.) inside study's Svelte component tests.
 *
 * Runtime registration lives in the workspace's `vitest.setup.dom.ts`. This
 * `.d.ts` makes the matchers visible to study's svelte-check pass via
 * tsconfig include of `src/**\/*.ts`. Without it, svelte-check surfaces
 * `Property 'toBeInTheDocument' does not exist on type 'Assertion<HTMLElement>'`
 * even though the matcher is registered at test-runtime.
 *
 * Mirrors `apps/hangar/src/vitest-jest-dom.d.ts`. Added in the
 * course-reader-and-editor WP Phase 2 when the first study-app
 * `.svelte.test.ts` file using the matchers landed
 * (`apps/study/src/lib/components/KnowledgeNodeBody.svelte.test.ts`).
 */
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
	interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
	interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
