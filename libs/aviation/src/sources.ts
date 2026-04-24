// @ab/aviation/sources -- server-only extractor machinery.
//
// These exports transitively import `node:fs` and must not be pulled into
// client bundles. Keep them off the main barrel so `@ab/aviation` stays safe
// for `+page.ts` and other browser-reachable code.
//
// Consumers: `scripts/references/*` and any future SSR-only call sites.

export { CfrExtractor, cfrExtractor } from './sources/cfr/extract';
export {
	computeFileHash,
	type DownloadOptions,
	type DownloadResult,
	downloadFile,
	type HeadInfo,
	headCheck,
} from './sources/download';
export { allExtractors, resolveExtractors } from './sources/extractors';
// wp-hangar-non-textual additions:
export {
	type ResolvedEdition,
	type ResolveEditionOptions,
	resolveCurrentSectionalEdition,
} from './sources/sectional/resolve-edition';
export { generateSectionalThumbnail, type ThumbnailOptions, type ThumbnailResult } from './sources/thumbnail';
