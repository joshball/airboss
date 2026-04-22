// Public barrel for `@ab/aviation/sources`. Exposes the source registry,
// the per-source metadata helpers, and the source-extractor dispatch used by
// `scripts/references/extract.ts`. Consumers that only need the reference
// types should keep importing from `@ab/aviation` itself.
export type { SourceExtractor } from './extractors';
export { allExtractors, resolveExtractors } from './extractors';
export type { SourceMeta } from './meta';
export { isSourceMeta, metaPathFor } from './meta';
export { getSource, getSourcesByType, isSourceDownloaded, PENDING_DOWNLOAD, SOURCES } from './registry';
