// @ab/help -- server-only barrel.
//
// Every value export in this file resolves to a module that statically
// imports `@ab/db/connection` (the live `postgres` driver). Re-exporting
// these from the runtime barrel (`./index.ts`) would drag `postgres` into
// the browser bundle via Vite's deps optimizer, which crashes hydration
// with `ReferenceError: Buffer is not defined`.
//
// Consumers: `+server.ts` (the palette POST endpoint each app mounts),
// `+page.server.ts` / `+layout.server.ts` consumers that pre-load injected
// results, scripts, and server-side tests. Import as
// `from '@ab/help/server'`.
//
// The runtime barrel (`./index.ts`) keeps every browser-safe value export
// (helpRegistry, search, searchGrouped, parseQuery, in-process loaders for
// aviation refs / external tools / help pages) and `type`-only re-exports of
// the server-only modules.

export { loadAimSections } from './loaders/aim-sections';
export { loadPaletteInjected } from './loaders/all';
export { loadCards } from './loaders/cards';
export { loadCfrSections } from './loaders/cfr-sections';
export { loadCourses } from './loaders/courses';
export { handlePaletteSearch } from './loaders/endpoint';
export { loadHandbookSections } from './loaders/handbook-sections';
export { loadKnowledgeNodes } from './loaders/knowledge-nodes';
export { loadPlans } from './loaders/plans';
export { loadReps } from './loaders/reps';
