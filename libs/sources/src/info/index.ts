/**
 * Phase 10 -- `info` corpus public surface.
 */

import { registerCorpusResolver } from '../registry/corpus-resolver.ts';
import { INFO_RESOLVER } from './resolver.ts';

registerCorpusResolver(INFO_RESOLVER);

export { formatInfoCitation } from './citation.ts';
export { INFO_INGEST_REVIEWER_ID, runInfoIngest, runInfoIngestCli } from './ingest.ts';
export { formatInfoLocator, parseInfoLocator } from './locator.ts';
export { INFO_CORPUS, INFO_RESOLVER } from './resolver.ts';
export {
	INFO_SEED_REVIEWER_ID,
	type InfoSeedOptions,
	type InfoSeedReport,
	seedInfoFromManifest,
} from './seed.ts';
export { __info_seed_mapping_internal__, getInfoSeedMapping, listInfoSeedMappings } from './seed-mapping.ts';
export { getInfoLiveUrl } from './url.ts';
