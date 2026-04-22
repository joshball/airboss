/**
 * Source registry.
 *
 * The list of authoritative source corpora the extraction pipeline knows
 * how to route. Each entry names a downloaded file under `data/sources/`,
 * its canonical download URL, version string, and an SHA-256 checksum the
 * validator uses to detect drift.
 *
 * Binary files under `data/sources/` are gitignored (per reference-system
 * architecture decision #2). `*.meta.json` files next to each binary are
 * committed so a fresh clone can re-download and verify.
 *
 * Files on disk do not have to be present for the registry to load -- the
 * `path` points to where the binary will live once downloaded. Until then
 * the `checksum` and `downloadedAt` fields carry the sentinel value
 * `PENDING_DOWNLOAD`.
 */

import { REFERENCE_SOURCE_TYPES, type ReferenceSourceType } from '@ab/constants';
import type { Source } from '../schema/source';

/** Sentinel used for registry entries whose binary has not been downloaded. */
export const PENDING_DOWNLOAD = 'pending-download';

export const SOURCES: readonly Source[] = [
	{
		id: 'cfr-14',
		type: REFERENCE_SOURCE_TYPES.CFR,
		title: '14 CFR - Aeronautics and Space',
		version: 'revised-2026-01-01',
		downloadedAt: PENDING_DOWNLOAD,
		format: 'xml',
		path: 'data/sources/cfr/cfr-14.xml',
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
		path: 'data/sources/aim/aim-current.pdf',
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
		path: 'data/sources/phak/phak-current.pdf',
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
		path: 'data/sources/afh/afh-current.pdf',
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
		path: 'data/sources/ifh/ifh-current.pdf',
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
		path: 'data/sources/pcg/pcg-current.pdf',
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
		path: 'data/sources/cfr/cfr-49.xml',
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
		path: 'data/sources/ac/ac-61-83k.pdf',
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
		path: 'data/sources/acs/acs-current.pdf',
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
		path: 'data/sources/faa-safety/faa-safety-current.html',
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
		path: 'data/sources/gajsc/gajsc-current.html',
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
		path: 'data/sources/ntsb/ntsb-current.csv',
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
		path: 'data/sources/usc/usc.html',
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
		path: 'data/sources/icao/annexes.pdf',
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
		path: 'data/sources/faa-gov/index.html',
		url: 'https://www.faa.gov/',
		checksum: PENDING_DOWNLOAD,
	},
];

export function getSource(id: string): Source | undefined {
	return SOURCES.find((s) => s.id === id);
}

export function getSourcesByType(type: ReferenceSourceType): readonly Source[] {
	return SOURCES.filter((s) => s.type === type);
}

/**
 * Returns true when a source's binary is expected to be on disk -- i.e.
 * `checksum` and `downloadedAt` have real values, not the sentinel. Lets
 * validators distinguish "never downloaded" from "downloaded but absent".
 */
export function isSourceDownloaded(source: Source): boolean {
	return source.checksum !== PENDING_DOWNLOAD && source.downloadedAt !== PENDING_DOWNLOAD;
}
