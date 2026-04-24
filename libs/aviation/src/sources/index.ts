// Public barrel for `@ab/aviation/sources`. Exposes the source registry,
// the per-source metadata helpers, and the source-extractor dispatch used by
// `scripts/references/extract.ts`. Consumers that only need the reference
// types should keep importing from `@ab/aviation` itself.

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
export { getSource, getSourcesByType, isSourceDownloaded, PENDING_DOWNLOAD, SOURCES } from './registry';
export {
	type ResolvedEdition,
	type ResolveEditionOptions,
	resolveCurrentSectionalEdition,
} from './sectional/resolve-edition';
export { generateSectionalThumbnail, type ThumbnailOptions, type ThumbnailResult } from './thumbnail';
