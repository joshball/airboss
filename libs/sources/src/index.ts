/**
 * `@ab/sources` -- the canonical-corpus reference lib.
 *
 * Phase 1 (this WP): URI parser + rule-engine validator + lesson Markdown
 * walker for the `airboss-ref:` identifier scheme. Source of truth: ADR 019.
 *
 * Phase 2+ (later WPs): the registry constants table, per-corpus resolvers,
 * and the renderer pipeline. Those land in this same lib without changing
 * the surface exported here.
 */

export { productionRegistry } from './registry/index.ts';
export { NULL_REGISTRY } from './registry-stub.ts';
export * from './types.ts';
