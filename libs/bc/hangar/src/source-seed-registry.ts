/**
 * Static seed catalog for hangar sources.
 *
 * The hangar BC owns operational source state in `hangar.source` rows, but the
 * citation surface (every `Reference.sources[].sourceId` in
 * `libs/aviation/src/references/aviation.ts`) needs a stable, in-process list
 * of valid source ids before any DB row exists. This module is that list -
 * the seed catalog the validator gates against and the legacy extraction
 * pipeline (`scripts/references/extract.ts`, `scripts/references/validate.ts`)
 * uses to locate downloaded binaries.
 *
 * Predecessor: `libs/aviation/src/sources/registry.ts`, retired alongside the
 * in-repo `data/sources/` tree per ADR 018. Lives next to the `hangar.source`
 * schema so the legacy `PENDING_DOWNLOAD` sentinel and the static catalog sit
 * with the live state machine. See the 2026-05-01 sources-content-pipeline
 * architecture review, finding "MINOR: apps/hangar form actions read
 * PENDING_DOWNLOAD from the legacy registry".
 *
 * `path` on each entry resolves through the developer-local cache root
 * (default `~/Documents/airboss-handbook-cache/`, override via
 * `AIRBOSS_HANDBOOK_CACHE`) per ADR 018 - not the in-repo `data/sources/`
 * tree the legacy registry used.
 */

import { join } from 'node:path';
import type { Source } from '@ab/aviation';
import { REFERENCE_SOURCE_TYPES, type ReferenceSourceType, resolveCacheRoot } from '@ab/constants';

/** Sentinel used for registry entries whose binary has not been downloaded. */
export const PENDING_DOWNLOAD = 'pending-download';

/**
 * Build the on-disk path for a seed source binary. Locates the file under
 * `<cacheRoot>/<type>/<basename>` per ADR 018; the legacy in-repo
 * `data/sources/<type>/<basename>` layout is gone.
 *
 * Resolution is lazy (`resolveCacheRoot` is read at call time, not at module
 * load) so tests that swap `AIRBOSS_HANDBOOK_CACHE` see the change. The
 * `ensureExists: false` flag keeps this side-effect-free for static use; the
 * cache root is created lazily by the ingest pipelines that actually write
 * binaries there.
 */
function seedPath(type: ReferenceSourceType, basename: string): string {
	return join(resolveCacheRoot({ ensureExists: false }), type, basename);
}

export const SOURCES: readonly Source[] = [
	{
		id: 'cfr-14',
		type: REFERENCE_SOURCE_TYPES.CFR,
		title: '14 CFR - Aeronautics and Space',
		version: 'revised-2026-01-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'xml',
		path: seedPath(REFERENCE_SOURCE_TYPES.CFR, 'cfr-14.xml'),
		url: 'https://www.govinfo.gov/bulkdata/CFR/2026/title-14/CFR-2026-title14.xml',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'aim-current',
		type: REFERENCE_SOURCE_TYPES.AIM,
		title: 'FAA Aeronautical Information Manual',
		version: '2026-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.AIM, 'aim-current.pdf'),
		url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'phak-current',
		type: REFERENCE_SOURCE_TYPES.PHAK,
		title: "Pilot's Handbook of Aeronautical Knowledge",
		version: '2023',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.PHAK, 'phak-current.pdf'),
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'afh-current',
		type: REFERENCE_SOURCE_TYPES.AFH,
		title: 'Airplane Flying Handbook',
		version: '2021',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.AFH, 'afh-current.pdf'),
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'ifh-current',
		type: REFERENCE_SOURCE_TYPES.IFH,
		title: 'Instrument Flying Handbook',
		version: '2012',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.IFH, 'ifh-current.pdf'),
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_flying_handbook',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'pcg-current',
		type: REFERENCE_SOURCE_TYPES.PCG,
		title: 'Pilot/Controller Glossary',
		version: '2026-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.PCG, 'pcg-current.pdf'),
		url: 'https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/',
		checksum: PENDING_DOWNLOAD,
	},
	// Additional sources cited by the 175 ported airboss-firc entries.
	// Added pre-extractor: sourceId-in-registry check must pass, but the
	// binary files and parsers for these sources land in follow-on WPs.
	{
		id: 'cfr-49',
		type: REFERENCE_SOURCE_TYPES.CFR,
		title: '49 CFR - Transportation',
		version: 'revised-2026-01-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'xml',
		path: seedPath(REFERENCE_SOURCE_TYPES.CFR, 'cfr-49.xml'),
		url: 'https://www.govinfo.gov/bulkdata/CFR/2026/title-49/CFR-2026-title49.xml',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'ac-61-83k',
		type: REFERENCE_SOURCE_TYPES.AC,
		title: 'Advisory Circular 61-83K (FIRC)',
		version: '61-83K',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.AC, 'ac-61-83k.pdf'),
		url: 'https://www.faa.gov/documentlibrary/media/advisory_circular/ac_61-83k.pdf',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'acs-current',
		type: REFERENCE_SOURCE_TYPES.ACS,
		title: 'Airman Certification Standards',
		version: '2026-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.ACS, 'acs-current.pdf'),
		url: 'https://www.faa.gov/training_testing/testing/acs/',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'faa-safety-current',
		type: REFERENCE_SOURCE_TYPES.FAA_SAFETY,
		title: 'FAASTeam / FAA Safety publications',
		version: '2026-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'html',
		path: seedPath(REFERENCE_SOURCE_TYPES.FAA_SAFETY, 'faa-safety-current.html'),
		url: 'https://www.faasafety.gov/',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'gajsc-current',
		type: REFERENCE_SOURCE_TYPES.GAJSC,
		title: 'GA Joint Steering Committee publications',
		version: '2026-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'html',
		path: seedPath(REFERENCE_SOURCE_TYPES.GAJSC, 'gajsc-current.html'),
		url: 'https://www.gajsc.org/',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'ntsb-current',
		type: REFERENCE_SOURCE_TYPES.NTSB,
		title: 'NTSB accident reports + safety recommendations',
		version: '2026-annual',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'csv',
		path: seedPath(REFERENCE_SOURCE_TYPES.NTSB, 'ntsb-current.csv'),
		url: 'https://www.ntsb.gov/Pages/AviationQuery.aspx',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'usc',
		type: REFERENCE_SOURCE_TYPES.AUTHORED,
		title: 'United States Code (aviation-relevant titles)',
		version: 'current',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'html',
		path: seedPath(REFERENCE_SOURCE_TYPES.AUTHORED, 'usc.html'),
		url: 'https://uscode.house.gov/',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'icao-annexes',
		type: REFERENCE_SOURCE_TYPES.AUTHORED,
		title: 'ICAO Annexes to the Convention on International Civil Aviation',
		version: 'current',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'pdf',
		path: seedPath(REFERENCE_SOURCE_TYPES.AUTHORED, 'icao-annexes.pdf'),
		url: 'https://www.icao.int/publications/pages/annexes-booklets.aspx',
		checksum: PENDING_DOWNLOAD,
	},
	{
		id: 'faa-gov',
		type: REFERENCE_SOURCE_TYPES.AUTHORED,
		title: 'FAA.gov reference pages (non-document citations)',
		version: 'current',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'html',
		path: seedPath(REFERENCE_SOURCE_TYPES.AUTHORED, 'faa-gov.html'),
		url: 'https://www.faa.gov/',
		checksum: PENDING_DOWNLOAD,
	},
];

export function getSeedSource(id: string): Source | undefined {
	return SOURCES.find((s) => s.id === id);
}

export function getSeedSourcesByType(type: ReferenceSourceType): readonly Source[] {
	return SOURCES.filter((s) => s.type === type);
}

/**
 * Returns true when a source's binary is expected to be on disk - i.e.
 * `checksum` and `downloadedAt` have real values, not the sentinel. Lets
 * validators distinguish "never downloaded" from "downloaded but absent".
 */
export function isSeedSourceDownloaded(source: Source): boolean {
	return source.checksum !== PENDING_DOWNLOAD && source.downloadedAt !== PENDING_DOWNLOAD;
}
