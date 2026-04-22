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
