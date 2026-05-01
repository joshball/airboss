/**
 * Resolve the developer-local source cache root.
 *
 * Thin re-export so script entry points can keep their existing
 * `import { resolveCacheRoot } from '../lib/cache.ts'` path while the actual
 * implementation lives in `@ab/constants/source-cache`. See ADR 018.
 */

export { defaultCacheRoot, expandHome, resolveCacheRoot, SOURCE_CACHE } from '@ab/constants';
