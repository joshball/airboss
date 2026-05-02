/**
 * Resolve the developer-local source cache root.
 *
 * Thin delegator to the canonical helper at `@ab/sources/cache`. Kept here so
 * existing script imports (`from '../lib/cache'`) keep working without
 * bouncing every caller through `@ab/sources` (and dragging
 * `fast-xml-parser` etc. transitive deps in). The subpath import
 * `@ab/sources/cache` is pure-Node + `@ab/constants` only, so this delegator
 * is cheap.
 *
 * See ADR 018 (storage policy), ADR 021 (flat naming), and
 * `docs/platform/STORAGE.md`.
 */

export { defaultCacheRoot, expandHome, resolveCacheRoot } from '@ab/sources/cache';
