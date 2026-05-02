// Public barrel for `@ab/aviation/sources`. Exposes per-source metadata
// helpers, the source-extractor dispatch used by
// `scripts/references/extract.ts`, the binary-visual download helpers, and
// the sectional thumbnail/edition machinery. Consumers that only need the
// reference types should keep importing from `@ab/aviation` itself.
//
// The legacy seed catalog (PENDING_DOWNLOAD, SOURCES, getSource,
// getSourcesByType, isSourceDownloaded) moved to `@ab/bc-hangar` next to the
// `hangar.source` schema that owns the live state machine.

// wp-hangar-non-textual additions:
export {
	computeFileHash,
	type DownloadOptions,
	type DownloadResult,
	downloadFile,
	type HeadInfo,
} from './download';
export type { SourceExtractor } from './extractors';
export { allExtractors, resolveExtractors } from './extractors';
export type { SourceMeta } from './meta';
export { isSourceMeta, metaPathFor } from './meta';
export {
	type ResolvedEdition,
	type ResolveEditionOptions,
	resolveCurrentSectionalEdition,
} from './sectional/resolve-edition';
export { generateSectionalThumbnail, type ThumbnailOptions, type ThumbnailResult } from './thumbnail';
