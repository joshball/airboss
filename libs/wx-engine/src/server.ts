// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/wx-engine/server` -- server-only barrel.
 *
 * Source of truth: [docs/work-packages/wx-engine/spec.md](
 *   ../../../docs/work-packages/wx-engine/spec.md
 * ) "Browser-safety" section.
 *
 * Every value re-exported here resolves to a module that either performs
 * filesystem I/O (engine bundle writer, knowledge-node resolver) or carries
 * large scenario literals that have no business in a browser bundle. The
 * runtime barrel `./index.ts` re-exports the *types* of these modules for
 * ergonomic `import type { ... }` consumption.
 *
 * Phase A populates this barrel with the Zod schema, geometry helpers,
 * `advanceTruth`, the scenario registry, and the engine entrypoint (truth-
 * only output; products / charts / commentary stubbed for Phase B / C / D).
 */

// Phase A re-exports land in the next commits (A.3 truth + schema + geometry
// + advance, A.4 scenario registry + frontal-xc-march, A.5 engine entrypoint
// + bundle writer). The barrel is intentionally empty in the scaffold
// commit so the lib structure is reviewable in isolation.
export {};
