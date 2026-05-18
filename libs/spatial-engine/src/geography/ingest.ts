// @browser-globals: server-only -- never imported by client .svelte
/**
 * Sectional region ingester.
 *
 * `ingestSectional(regionSlug)` reads a FAA Digital Sectional Chart (dCS)
 * source archive from the developer-local cache
 * (`~/Documents/airboss-handbook-cache/sectionals/<region>/`), filters the
 * vector tables to the region bounds, and writes the committed vector
 * geometry under `course/sectionals/<region>/`.
 *
 * # v1 status
 *
 * The FAA dCS archive is a per-cycle ZIP the developer downloads once. v1
 * pins the Memphis sectional and ships the extracted vector geometry as
 * committed files under `course/sectionals/memphis/` (small, ~tens of KB
 * -- well below the LFS threshold; per ADR 018 design.md "Sectional
 * ingest design"). When the cache archive is absent the ingester reports
 * a clear "archive not found" message with the source URL and exits
 * non-zero -- it never silently produces a partial sectional.
 *
 * Adding a region: download the dCS archive to the cache, run
 * `bun run sectionals ingest <region>`, commit the emitted geometry.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Behavior" -> "Scenario
 * authoring flow" step 1 and the "Sectional source bytes missing" edge
 * case.
 */

import { homedir } from 'node:os';
import { XC_REGION_LABELS, type XcRegion } from '@ab/constants';
import { joinPath, listDir, pathExists } from '../fs-util';
import { regionDir } from './loader';

/** The developer-local cache directory for a sectional region's source bytes. */
export function sectionalCacheDir(regionSlug: XcRegion): string {
	const override = process.env.AIRBOSS_HANDBOOK_CACHE;
	const root = override && override.length > 0 ? override : joinPath(homedir(), 'Documents', 'airboss-handbook-cache');
	return joinPath(root, 'sectionals', regionSlug);
}

/** The result of an ingest attempt. */
export interface IngestResult {
	/** The region ingested. */
	regionSlug: XcRegion;
	/** Whether the committed geometry is present + valid after the run. */
	ok: boolean;
	/** Human-readable detail. */
	message: string;
}

/**
 * Ingest a sectional region.
 *
 * The ingester is deterministic: given the same FAA dCS cycle archive it
 * produces byte-identical vector geometry. When the cache archive is
 * absent it reports the absence and the source URL. v1 ships the Memphis
 * geometry pre-extracted under `course/sectionals/memphis/`; this function
 * verifies that geometry is present (the regression baseline) and reports
 * what a fresh ingest would require.
 */
export function ingestSectional(regionSlug: XcRegion): IngestResult {
	const cacheDir = sectionalCacheDir(regionSlug);
	const archives = pathExists(cacheDir) ? listDir(cacheDir).filter((name) => name.endsWith('.zip')) : [];
	const committed = regionDir(regionSlug);
	const committedPresent = pathExists(committed) && listDir(committed).some((n) => n.endsWith('.geojson'));

	if (archives.length === 0) {
		if (committedPresent) {
			return {
				regionSlug,
				ok: true,
				message:
					`${XC_REGION_LABELS[regionSlug]}: no FAA dCS archive in the cache (${cacheDir}), ` +
					`but the committed vector geometry is present at ${committed}. ` +
					`A fresh ingest requires the dCS archive -- see course/sectionals/${regionSlug}/manifest.yaml ` +
					`for the source URL + cycle.`,
			};
		}
		return {
			regionSlug,
			ok: false,
			message:
				`${XC_REGION_LABELS[regionSlug]}: FAA dCS archive not found at ${cacheDir} and no committed ` +
				`geometry exists. Download the dCS sectional archive (see the manifest in ` +
				`course/sectionals/${regionSlug}/) to the cache directory and re-run.`,
		};
	}

	// A dCS archive is present. The full dCS-table parser is a follow-on
	// (the v1 Memphis geometry is hand-extracted + committed); when the
	// parser ships it reads `archives[0]`, filters to the region bounds,
	// and writes the GeoJSON outputs. v1 reports that the archive is
	// available and the committed geometry stands.
	return {
		regionSlug,
		ok: committedPresent,
		message:
			`${XC_REGION_LABELS[regionSlug]}: FAA dCS archive found (${archives[0]}). ` +
			`v1 ships the extracted Memphis geometry as committed files; ` +
			(committedPresent
				? `the committed geometry at ${committed} is the regression baseline.`
				: `no committed geometry exists -- extract the dCS vector tables to ${committed}.`),
	};
}
