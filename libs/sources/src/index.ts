/**
 * `@ab/sources` -- the canonical-corpus reference lib.
 *
 * Phase 1: URI parser + rule-engine validator + lesson Markdown walker for the
 * `airboss-ref:` identifier scheme. Source of truth: ADR 019.
 *
 * Phase 2: registry constants table, per-corpus resolver registration,
 * lifecycle state machine, and the production `RegistryReader` assembly.
 *
 * Phase 3: real `regs` `CorpusResolver` registered by side effect when this
 * module is imported.
 */

// Side-effect import: registers the `regs` CorpusResolver.
import './regs/index.ts';

export { productionRegistry } from './registry/index.ts';
export { NULL_REGISTRY } from './registry-stub.ts';
export * from './types.ts';
