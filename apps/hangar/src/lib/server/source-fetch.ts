/**
 * Binary-visual source fetch pipeline (wp-hangar-non-textual).
 *
 * Drives the per-job steps documented in
 * docs/work-packages/hangar-non-textual/design.md#fetch-pipeline:
 *
 *   1. resolve edition from the upstream index HTML
 *   2. if resolvedUrl + editionDate + sha match DB: no-change; return
 *   3. download resolvedUrl -> tmp
 *   4. compute sha256 + sizeBytes
 *   5. drift check (same edition date, different sha => fail)
 *   6. archive previous edition directory (respects ARCHIVE_RETENTION)
 *   7. move tmp -> data/sources/<type>/<id>/<edition>/chart.zip
 *   8. read archive manifest (entries + sizes)
 *   9. generate thumbnail
 *  10. write meta.json sidecar
 *  11. update hangar.source row (checksum, media, edition, ...) + audit
 *
 * Kept subprocess-free so the handler is straightforward to unit-test:
 * resolver + downloader + generator + dbWriter are each injected, with
 * plausible defaults that use the library helpers from @ab/aviation.
 */

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { AUDIT_OPS, auditWrite } from '@ab/audit';
import type { SourceEdition, SourceMedia, SourceMeta } from '@ab/aviation';
import {
	computeFileHash,
	downloadFile,
	generateSectionalThumbnail,
	type ResolvedEdition,
	type ResolveEditionOptions,
	resolveCurrentSectionalEdition,
	type ThumbnailOptions,
	type ThumbnailResult,
} from '@ab/aviation/sources';
import {
	AUDIT_TARGETS,
	type ReferenceSourceType,
	SECTIONAL_CADENCE_DAYS,
	SOURCE_ACTION_LIMITS,
	SOURCE_KIND_BY_TYPE,
	SOURCE_KINDS,
} from '@ab/constants';
import { db, type HangarSourceEdition, type HangarSourceMedia, type HangarSourceRow, hangarSource } from '@ab/db';
import type { JobContext } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { eq } from 'drizzle-orm';

const log = createLogger('hangar:source-fetch');

// -------- contracts --------

export type ResolverFn = (opts: ResolveEditionOptions) => Promise<ResolvedEdition>;

export type DownloaderFn = (url: string, destPath: string) => Promise<{ sha256: string; fileSize: number }>;

export type ThumbnailFn = (opts: ThumbnailOptions) => Promise<ThumbnailResult>;

export interface ArchiveEntry {
	name: string;
	sizeBytes: number;
}

export type ArchiveReaderFn = (archivePath: string) => Promise<readonly ArchiveEntry[]>;

export type DbUpdaterFn = (id: string, patch: Partial<HangarSourceRow>) => Promise<void>;

/**
 * A resolved `hangar.source` row + its locator-shape hints. The locator
 * carries operator-authored fields that parameterise the fetch: `region`,
 * `index_url`, `cadence_days`. They live under `locator_shape` rather
 * than spreading them across top-level columns so future non-textual
 * families (plates, airport diagrams) can add their own axes without a
 * schema change.
 */
export interface LocatorShape {
	region?: string;
	index_url?: string;
	cadence_days?: number;
	kind?: string;
}

export interface SectionalFetchInput {
	/** The loaded `hangar.source` row. */
	row: HangarSourceRow;
	/** Repo root for resolving relative paths (injected by handler). */
	repoRoot: string;
	/** Fetch HTML (lets tests swap in a fixture). */
	fetchHtml: (url: string) => Promise<string>;
}

export interface SectionalFetchHooks {
	resolver?: ResolverFn;
	downloader?: DownloaderFn;
	thumbnail?: ThumbnailFn;
	readArchive?: ArchiveReaderFn;
	dbUpdate?: DbUpdaterFn;
	/** Inject now() for deterministic meta.json timestamps. */
	now?: () => Date;
}

export interface SectionalFetchOutcome {
	kind: 'fetched' | 'no-change' | 'drift';
	editionDate: string;
	resolvedUrl: string;
	sha256: string;
	sizeBytes: number;
	thumbnailPath: string;
	generator: string;
	archiveEntries: readonly ArchiveEntry[];
}

// -------- default adapters --------

async function defaultDownloader(url: string, destPath: string): Promise<{ sha256: string; fileSize: number }> {
	const result = await downloadFile(url, destPath);
	return { sha256: result.sha256, fileSize: result.fileSize };
}

/**
 * Minimal local-archive reader. Parses the zip end-of-central-directory
 * record and central directory entries to enumerate names + uncompressed
 * sizes. Does not extract bytes. Intentionally does not depend on a zip
 * library so no new prod dependency lands with this WP.
 *
 * Supports the common "no zip64, no multi-disk" case; real FAA sectional
 * archives are small enough that zip32 is fine. Oversized archives throw
 * a clear "zip64 not supported" error so the operator knows to upgrade
 * the reader, not that we silently mis-reported the manifest.
 */
async function defaultReadArchive(archivePath: string): Promise<readonly ArchiveEntry[]> {
	const buf = await readFile(archivePath);
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

	// Find End Of Central Directory record (signature 0x06054b50) within the
	// last ~64 KiB of the file (comment field is at most 0xFFFF).
	const EOCD_SIG = 0x06054b50;
	let eocdOffset = -1;
	const scanStart = Math.max(0, buf.byteLength - 0xffff - 22);
	for (let i = buf.byteLength - 22; i >= scanStart; i -= 1) {
		if (view.getUint32(i, true) === EOCD_SIG) {
			eocdOffset = i;
			break;
		}
	}
	if (eocdOffset < 0) {
		throw new Error(`zip: end-of-central-directory not found in ${archivePath}`);
	}

	const totalEntries = view.getUint16(eocdOffset + 10, true);
	const cdOffset = view.getUint32(eocdOffset + 16, true);
	if (cdOffset === 0xffffffff) {
		throw new Error(`zip: zip64 central directory not supported (${archivePath})`);
	}

	const entries: ArchiveEntry[] = [];
	const CENTRAL_SIG = 0x02014b50;
	let p = cdOffset;
	for (let i = 0; i < totalEntries; i += 1) {
		if (view.getUint32(p, true) !== CENTRAL_SIG) {
			throw new Error(`zip: central directory signature mismatch at offset ${p}`);
		}
		const uncompressedSize = view.getUint32(p + 24, true);
		const nameLen = view.getUint16(p + 28, true);
		const extraLen = view.getUint16(p + 30, true);
		const commentLen = view.getUint16(p + 32, true);
		const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
		entries.push({ name, sizeBytes: uncompressedSize });
		p += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}

async function defaultDbUpdate(id: string, patch: Partial<HangarSourceRow>): Promise<void> {
	await db
		.update(hangarSource)
		.set({ ...patch, updatedAt: new Date(), dirty: true })
		.where(eq(hangarSource.id, id));
}

// -------- helpers --------

function parseLocatorShape(raw: Record<string, unknown> | null | undefined): LocatorShape {
	if (!raw) return {};
	const out: LocatorShape = {};
	if (typeof raw.region === 'string') out.region = raw.region;
	if (typeof raw.index_url === 'string') out.index_url = raw.index_url;
	if (typeof raw.cadence_days === 'number') out.cadence_days = raw.cadence_days;
	if (typeof raw.kind === 'string') out.kind = raw.kind;
	return out;
}

function editionsEqual(a: HangarSourceEdition | null | undefined, dateString: string, resolvedUrl: string): boolean {
	if (!a) return false;
	return a.effectiveDate === dateString && a.resolvedUrl === resolvedUrl;
}

async function defaultFetchHtml(url: string): Promise<string> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`fetch-index: HTTP ${res.status} for ${url}`);
	}
	return await res.text();
}

function sectionalRootFor(repoRoot: string, type: string, id: string): string {
	return resolve(repoRoot, 'data', 'sources', type, id);
}

function editionDirFor(root: string, editionDate: string): string {
	return join(root, editionDate);
}

/**
 * Rotate previous edition directories so the latest ARCHIVE_RETENTION are
 * preserved; the rest are removed. Called before creating the new edition
 * directory so operators never lose the active edition.
 */
async function rotateArchives(sourceRoot: string, currentEdition: string): Promise<readonly string[]> {
	let names: readonly string[];
	try {
		names = await readdir(sourceRoot);
	} catch {
		return [];
	}
	const existing = names
		.filter((n) => n !== currentEdition && /^\d{4}-\d{2}-\d{2}$/.test(n))
		.sort()
		.reverse(); // newest first
	const keep = existing.slice(0, SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION - 1);
	const prune = existing.slice(SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION - 1);
	for (const name of prune) {
		await rm(join(sourceRoot, name), { recursive: true, force: true });
	}
	return keep;
}

// -------- main pipeline --------

export async function runSectionalFetch(
	ctx: JobContext,
	input: SectionalFetchInput,
	hooks: SectionalFetchHooks = {},
): Promise<SectionalFetchOutcome> {
	const row = input.row;
	const resolver = hooks.resolver ?? resolveCurrentSectionalEdition;
	const downloader = hooks.downloader ?? defaultDownloader;
	const thumbnailFn = hooks.thumbnail ?? generateSectionalThumbnail;
	const readArchive = hooks.readArchive ?? defaultReadArchive;
	const dbUpdate = hooks.dbUpdate ?? defaultDbUpdate;
	const now = hooks.now ?? (() => new Date());

	const locator = parseLocatorShape(row.locatorShape);
	if (!locator.region) throw new Error(`locator_shape.region is required for binary-visual source '${row.id}'`);
	if (!locator.index_url) throw new Error(`locator_shape.index_url is required for binary-visual source '${row.id}'`);

	// Step 1: resolve edition.
	await ctx.logEvent(`resolving edition for ${locator.region} via ${locator.index_url}`);
	await ctx.reportProgress({ step: 1, total: 7, message: 'resolving edition' });
	const edition = await resolver({
		region: locator.region,
		indexUrl: locator.index_url,
		urlTemplate: row.url,
		fetchHtml: input.fetchHtml,
		now,
	});
	await ctx.logEvent(`edition resolved: ${edition.effectiveDate} -> ${edition.resolvedUrl}`);
	await auditWrite({
		actorId: ctx.job.actorId,
		op: AUDIT_OPS.UPDATE,
		targetType: AUDIT_TARGETS.HANGAR_SOURCE_EDITION_RESOLVED,
		targetId: row.id,
		metadata: {
			jobId: ctx.job.id,
			effectiveDate: edition.effectiveDate,
			editionNumber: edition.editionNumber,
			resolvedUrl: edition.resolvedUrl,
		},
	});

	const sourceRoot = sectionalRootFor(input.repoRoot, row.type, row.id);
	const editionDir = editionDirFor(sourceRoot, edition.effectiveDate);
	const archivePath = join(editionDir, 'chart.zip');
	const thumbPath = join(editionDir, 'thumb.jpg');
	const metaPath = join(editionDir, 'meta.json');
	const recordedArchivePath = relative(input.repoRoot, archivePath);
	const recordedThumbPath = relative(input.repoRoot, thumbPath);

	// Step 2: short-circuit if edition + on-disk sha match.
	if (editionsEqual(row.edition, edition.effectiveDate, edition.resolvedUrl) && row.media) {
		try {
			const s = await stat(archivePath);
			if (s.isFile() && s.size === row.sizeBytes) {
				const existingSha = await computeFileHash(archivePath);
				if (existingSha === row.checksum) {
					await ctx.logEvent('no change (edition + bytes match)');
					return {
						kind: 'no-change',
						editionDate: edition.effectiveDate,
						resolvedUrl: edition.resolvedUrl,
						sha256: existingSha,
						sizeBytes: s.size,
						thumbnailPath: row.media.thumbnailPath,
						generator: row.media.generator,
						archiveEntries: row.media.archiveEntries,
					};
				}
			}
		} catch {
			// Fall through -- force a fresh download.
		}
	}

	// Step 3: download.
	await ctx.reportProgress({ step: 2, total: 7, message: 'downloading' });
	const tmpPath = `${archivePath}.downloading`;
	await mkdir(editionDir, { recursive: true });
	await ctx.logEvent(`downloading ${edition.resolvedUrl}`);
	const dl = await downloader(edition.resolvedUrl, tmpPath);
	await ctx.logEvent(`downloaded ${dl.fileSize} bytes (sha256=${dl.sha256.slice(0, 16)}...)`);

	// Step 5: drift check.
	if (
		row.edition &&
		row.edition.effectiveDate === edition.effectiveDate &&
		row.checksum &&
		row.checksum !== dl.sha256
	) {
		await auditWrite({
			actorId: ctx.job.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_SOURCE_EDITION_DRIFT,
			targetId: row.id,
			metadata: {
				jobId: ctx.job.id,
				effectiveDate: edition.effectiveDate,
				priorSha: row.checksum,
				newSha: dl.sha256,
			},
		});
		await ctx.logEvent(
			`edition-drift: same edition date (${edition.effectiveDate}) but sha differs (prior=${row.checksum.slice(0, 16)}, new=${dl.sha256.slice(0, 16)})`,
		);
		await rm(tmpPath, { force: true });
		throw new Error(
			`edition-drift: ${row.id} prior sha ${row.checksum} differs from new sha ${dl.sha256} for edition ${edition.effectiveDate}`,
		);
	}

	// Step 6: rotate archives before committing the new edition dir.
	const keptArchives = await rotateArchives(sourceRoot, edition.effectiveDate);
	await ctx.logEvent(`archive retention: kept ${keptArchives.length} previous edition(s)`);

	// Step 7: move tmp -> archivePath.
	await rename(tmpPath, archivePath);

	// Step 8: archive manifest.
	await ctx.reportProgress({ step: 3, total: 7, message: 'reading archive manifest' });
	let archiveEntries: readonly ArchiveEntry[] = [];
	try {
		archiveEntries = await readArchive(archivePath);
		await ctx.logEvent(`archive manifest: ${archiveEntries.length} entries`);
	} catch (err) {
		await ctx.logStderr(`archive manifest read failed: ${err instanceof Error ? err.message : String(err)}`);
		archiveEntries = [];
	}

	// Step 9: thumbnail.
	await ctx.reportProgress({ step: 4, total: 7, message: 'generating thumbnail' });
	const thumbnail = await thumbnailFn({
		archivePath,
		outPath: thumbPath,
		recordedPath: recordedThumbPath,
	});
	await ctx.logEvent(
		`thumbnail generated (${thumbnail.generator}, ${thumbnail.thumbnailSizeBytes} bytes, sha=${thumbnail.thumbnailSha256.slice(0, 16)})`,
	);
	await auditWrite({
		actorId: ctx.job.actorId,
		op: AUDIT_OPS.UPDATE,
		targetType: AUDIT_TARGETS.HANGAR_SOURCE_THUMBNAIL_GENERATED,
		targetId: row.id,
		metadata: {
			jobId: ctx.job.id,
			generator: thumbnail.generator,
			sizeBytes: thumbnail.thumbnailSizeBytes,
		},
	});

	// Step 10: meta.json sidecar.
	const meta: SourceMeta & { edition: SourceEdition; media: SourceMedia } = {
		sourceId: row.id,
		version: edition.effectiveDate,
		url: edition.resolvedUrl,
		checksum: dl.sha256,
		downloadedAt: now().toISOString(),
		format: 'geotiff-zip',
		sizeBytes: dl.fileSize,
		edition: {
			effectiveDate: edition.effectiveDate,
			editionNumber: edition.editionNumber,
			resolvedUrl: edition.resolvedUrl,
			resolvedAt: edition.resolvedAt,
		},
		media: {
			thumbnailPath: recordedThumbPath,
			thumbnailSha256: thumbnail.thumbnailSha256,
			thumbnailSizeBytes: thumbnail.thumbnailSizeBytes,
			archiveEntries: archiveEntries.map((e) => ({ name: e.name, sizeBytes: e.sizeBytes })),
			generator: thumbnail.generator,
		},
	};
	await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

	// Step 11: update DB row.
	await ctx.reportProgress({ step: 5, total: 7, message: 'updating registry row' });
	const media: HangarSourceMedia = {
		thumbnailPath: recordedThumbPath,
		thumbnailSha256: thumbnail.thumbnailSha256,
		thumbnailSizeBytes: thumbnail.thumbnailSizeBytes,
		archiveEntries: archiveEntries.map((e) => ({ name: e.name, sizeBytes: e.sizeBytes })),
		generator: thumbnail.generator,
	};
	const editionRow: HangarSourceEdition = {
		effectiveDate: edition.effectiveDate,
		editionNumber: edition.editionNumber,
		resolvedUrl: edition.resolvedUrl,
		resolvedAt: edition.resolvedAt,
	};
	await dbUpdate(row.id, {
		checksum: dl.sha256,
		sizeBytes: dl.fileSize,
		downloadedAt: now().toISOString(),
		path: relative(input.repoRoot, archivePath),
		version: edition.effectiveDate,
		media,
		edition: editionRow,
	});

	await auditWrite({
		actorId: ctx.job.actorId,
		op: AUDIT_OPS.UPDATE,
		targetType: AUDIT_TARGETS.HANGAR_SOURCE,
		targetId: row.id,
		metadata: {
			jobId: ctx.job.id,
			outcome: 'fetched',
			kind: 'binary-visual',
			editionDate: edition.effectiveDate,
			checksum: dl.sha256,
			sizeBytes: dl.fileSize,
		},
	});

	await ctx.reportProgress({ step: 7, total: 7, message: 'done' });
	return {
		kind: 'fetched',
		editionDate: edition.effectiveDate,
		resolvedUrl: edition.resolvedUrl,
		sha256: dl.sha256,
		sizeBytes: dl.fileSize,
		thumbnailPath: recordedThumbPath,
		generator: thumbnail.generator,
		archiveEntries,
	};
}

// -------- binary-visual handler glue --------

export interface BinaryVisualFetchOptions {
	repoRoot: string;
	fetchHtml?: (url: string) => Promise<string>;
	hooks?: SectionalFetchHooks;
	loadSource?: (id: string) => Promise<HangarSourceRow | null>;
}

async function defaultLoadSource(id: string): Promise<HangarSourceRow | null> {
	const [row] = await db.select().from(hangarSource).where(eq(hangarSource.id, id)).limit(1);
	return row ?? null;
}

/**
 * Entry point the fetch handler calls when it sees a `binary-visual` source.
 * Returns the outcome structure so the handler can set `job.result` + log
 * a summary.
 */
export async function handleBinaryVisualFetch(
	ctx: JobContext,
	sourceId: string,
	options: BinaryVisualFetchOptions,
): Promise<SectionalFetchOutcome> {
	const loadSource = options.loadSource ?? defaultLoadSource;
	const row = await loadSource(sourceId);
	if (!row) throw new Error(`hangar.source not found: ${sourceId}`);
	if (SOURCE_KIND_BY_TYPE[row.type as ReferenceSourceType] !== SOURCE_KINDS.BINARY_VISUAL) {
		throw new Error(`source '${sourceId}' is not a binary-visual kind; got type='${row.type}'`);
	}

	return await runSectionalFetch(
		ctx,
		{
			row,
			repoRoot: options.repoRoot,
			fetchHtml: options.fetchHtml ?? defaultFetchHtml,
		},
		options.hooks,
	);
}

/**
 * Helper exported for diff-handler use: label a binary-visual diff row as
 * "new edition E2; prior E1" rather than emitting a verbatim-text diff.
 */
export function formatEditionDiff(prior: SourceEdition | null, current: SourceEdition | null): string {
	if (!prior && !current) return 'no edition metadata on either side';
	if (!prior) {
		return `new edition ${current?.effectiveDate ?? '?'}${current?.editionNumber ? ` (#${current.editionNumber})` : ''}; no prior edition recorded`;
	}
	if (!current) return `prior edition ${prior.effectiveDate}; no current edition recorded`;
	if (prior.effectiveDate === current.effectiveDate && prior.resolvedUrl === current.resolvedUrl) {
		return `no edition change (both are ${current.effectiveDate})`;
	}
	return `new edition ${current.effectiveDate}${current.editionNumber ? ` (#${current.editionNumber})` : ''}; prior was ${prior.effectiveDate}${prior.editionNumber ? ` (#${prior.editionNumber})` : ''}`;
}

// Re-export cadence for form defaults.
export { SECTIONAL_CADENCE_DAYS };

// Silence unused-var warning when log gated out in prod builds; kept for debug hooks.
void log;
void basename;
void dirname;
