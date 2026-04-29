#!/usr/bin/env bun
/**
 * One-shot cache migration to the ADR 021 flat layout.
 *
 * Walks `$AIRBOSS_HANDBOOK_CACHE` and rewrites the developer-local cache from
 * the staged-rollout layout (per-doc edition dirs + `source.<ext>` filenames +
 * per-doc manifests + handbook `_errata/` subdirs) to the flat layout:
 *
 *   handbooks/<slug>/<edition>/<edition>.pdf
 *   handbooks/<slug>/<edition>/<edition>-errata-<id>.pdf
 *   handbooks/<slug>/<edition>/manifest.json     (primary + errata[])
 *
 *   ac/<doc-id>.pdf                              (flat)
 *   acs/<doc-id>.pdf                             (flat)
 *   aim/<edition>.pdf                            (flat)
 *   regulations/cfr-<title>/<edition>.xml        (flat; -parts-<f>.xml for filtered)
 *   <flat-corpus>/manifest.json                  (per-corpus index)
 *
 * Run once:
 *
 *   bun run scripts/migrate-cache-flat.ts                # apply
 *   bun run scripts/migrate-cache-flat.ts --dry-run      # plan only
 *
 * Idempotency: re-runnable. Each rename checks for the old + new path; if both
 * exist, the new file wins and the old file is left in place as an orphan with
 * a WARNING (operator inspects). If neither exists, INFO (entry will be
 * re-downloaded on next `sources download`).
 *
 * This script lands in the same PR that delivers the new layout, and is
 * deleted in the immediately following commit. It is never run by CI.
 */

import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmdirSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { resolveCacheRoot } from './lib/cache';

interface OldDocManifest {
	corpus: string;
	doc: string;
	edition: string;
	source_url: string;
	source_filename: string;
	source_sha256: string;
	size_bytes: number;
	fetched_at: string;
	last_modified?: string;
	etag?: string;
	schema_version: number;
}

interface NewEntry {
	corpus: string;
	doc: string;
	edition: string | null;
	source_url: string;
	source_filename: string;
	source_sha256: string;
	size_bytes: number;
	fetched_at: string;
	last_modified?: string;
	etag?: string;
	schema_version: number;
}

interface Stats {
	renames: number;
	dirsRemoved: number;
	manifestsMerged: number;
	warnings: string[];
	info: string[];
}

const SCHEMA_VERSION = 1;

function isDir(p: string): boolean {
	try {
		return statSync(p).isDirectory();
	} catch {
		return false;
	}
}

function isFile(p: string): boolean {
	try {
		return statSync(p).isFile();
	} catch {
		return false;
	}
}

function readJsonOrNull<T>(path: string): T | null {
	try {
		return JSON.parse(readFileSync(path, 'utf-8')) as T;
	} catch {
		return null;
	}
}

function moveOrSkip(oldPath: string, newPath: string, stats: Stats, dryRun: boolean): 'moved' | 'skipped' | 'orphaned' {
	const oldExists = isFile(oldPath);
	const newExists = isFile(newPath);
	if (oldExists && newExists) {
		stats.warnings.push(`both old and new exist; preferring new, leaving old as orphan: old=${oldPath} new=${newPath}`);
		return 'orphaned';
	}
	if (newExists && !oldExists) {
		stats.info.push(`already migrated: ${newPath}`);
		return 'skipped';
	}
	if (!oldExists && !newExists) {
		stats.info.push(`entry missing from cache (will re-download on next sources download): ${newPath}`);
		return 'skipped';
	}
	// Old exists, new does not.
	if (dryRun) {
		console.log(`  [dry-run] mv ${oldPath} -> ${newPath}`);
	} else {
		renameSync(oldPath, newPath);
	}
	stats.renames += 1;
	return 'moved';
}

function tryRemoveEmptyDir(dir: string, stats: Stats, dryRun: boolean): void {
	try {
		const entries = readdirSync(dir);
		if (entries.length > 0) return;
		if (dryRun) {
			console.log(`  [dry-run] rmdir ${dir}`);
		} else {
			rmdirSync(dir);
		}
		stats.dirsRemoved += 1;
	} catch {
		// directory missing or not empty -- leave it
	}
}

function writeAtomic(path: string, contents: string, dryRun: boolean): void {
	if (dryRun) {
		console.log(`  [dry-run] write ${path}`);
		return;
	}
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, contents, 'utf-8');
	renameSync(tmp, path);
}

function migrateFlatCorpus(cacheRoot: string, corpus: 'ac' | 'acs', stats: Stats, dryRun: boolean): void {
	const corpusRoot = join(cacheRoot, corpus);
	if (!isDir(corpusRoot)) return;
	const entries: NewEntry[] = [];

	for (const docDir of readdirSync(corpusRoot)) {
		const docPath = join(corpusRoot, docDir);
		// New layout files (`<doc-id>.pdf`) live at the corpus root; skip them.
		if (!isDir(docPath)) continue;
		for (const editionDir of readdirSync(docPath)) {
			const editionPath = join(docPath, editionDir);
			if (!isDir(editionPath)) continue;
			const oldManifestPath = join(editionPath, 'manifest.json');
			const oldManifest = readJsonOrNull<OldDocManifest>(oldManifestPath);
			if (oldManifest === null) {
				stats.warnings.push(`${corpus}/${docDir}/${editionDir}: per-doc manifest missing or invalid`);
				continue;
			}
			const newFilename = `${oldManifest.doc}.pdf`;
			const oldPdfPath = join(editionPath, oldManifest.source_filename);
			const newPdfPath = join(corpusRoot, newFilename);
			moveOrSkip(oldPdfPath, newPdfPath, stats, dryRun);

			// Source.pdf symlink alongside the descriptive name -- best-effort cleanup.
			const oldSymlink = join(editionPath, 'source.pdf');
			if (existsSync(oldSymlink)) {
				if (dryRun) {
					console.log(`  [dry-run] rm ${oldSymlink}`);
				} else {
					try {
						// `rmSync` not available because we're avoiding additional
						// imports; renameSync to a discardable tmp + rmdir is overkill.
						// Use unlink via dynamic import to keep top imports minimal.
						// using top-level imports
						unlinkSync(oldSymlink);
					} catch {
						// no-op
					}
				}
			}

			// Build new entry. Edition is null when the old layout used 'current'.
			const newEdition =
				oldManifest.edition === 'current' || oldManifest.edition.length === 0 ? null : oldManifest.edition;
			const newEntry: NewEntry = {
				corpus: oldManifest.corpus,
				doc: oldManifest.doc,
				edition: newEdition,
				source_url: oldManifest.source_url,
				source_filename: newFilename,
				source_sha256: oldManifest.source_sha256,
				size_bytes: oldManifest.size_bytes,
				fetched_at: oldManifest.fetched_at,
				...(oldManifest.last_modified !== undefined ? { last_modified: oldManifest.last_modified } : {}),
				...(oldManifest.etag !== undefined ? { etag: oldManifest.etag } : {}),
				schema_version: SCHEMA_VERSION,
			};
			entries.push(newEntry);
			stats.manifestsMerged += 1;

			// Best-effort cleanup of empty per-doc/per-edition dirs.
			if (!dryRun) {
				try {
					// using top-level imports
					if (existsSync(oldManifestPath)) unlinkSync(oldManifestPath);
				} catch {
					// no-op
				}
			}
			tryRemoveEmptyDir(editionPath, stats, dryRun);
		}
		tryRemoveEmptyDir(docPath, stats, dryRun);
	}

	if (entries.length > 0) {
		entries.sort((a, b) => `${a.doc}@${a.edition ?? ''}`.localeCompare(`${b.doc}@${b.edition ?? ''}`));
		const corpusManifest = {
			schema_version: SCHEMA_VERSION,
			corpus,
			entries,
		};
		writeAtomic(join(corpusRoot, 'manifest.json'), `${JSON.stringify(corpusManifest, null, 2)}\n`, dryRun);
	}
}

function migrateAim(cacheRoot: string, stats: Stats, dryRun: boolean): void {
	const aimRoot = join(cacheRoot, 'aim');
	if (!isDir(aimRoot)) return;
	const entries: NewEntry[] = [];

	for (const editionDir of readdirSync(aimRoot)) {
		const editionPath = join(aimRoot, editionDir);
		if (!isDir(editionPath)) continue;
		const oldManifestPath = join(editionPath, 'manifest.json');
		const oldManifest = readJsonOrNull<OldDocManifest>(oldManifestPath);
		if (oldManifest === null) {
			stats.warnings.push(`aim/${editionDir}: per-edition manifest missing or invalid`);
			continue;
		}
		const newFilename = `${oldManifest.edition}.pdf`;
		const oldPdfPath = join(editionPath, oldManifest.source_filename);
		const newPdfPath = join(aimRoot, newFilename);
		moveOrSkip(oldPdfPath, newPdfPath, stats, dryRun);

		const oldSymlink = join(editionPath, 'source.pdf');
		if (existsSync(oldSymlink) && !dryRun) {
			try {
				// using top-level imports
				unlinkSync(oldSymlink);
			} catch {
				// no-op
			}
		}

		const newEntry: NewEntry = {
			corpus: 'aim',
			doc: oldManifest.doc,
			edition: oldManifest.edition,
			source_url: oldManifest.source_url,
			source_filename: newFilename,
			source_sha256: oldManifest.source_sha256,
			size_bytes: oldManifest.size_bytes,
			fetched_at: oldManifest.fetched_at,
			...(oldManifest.last_modified !== undefined ? { last_modified: oldManifest.last_modified } : {}),
			...(oldManifest.etag !== undefined ? { etag: oldManifest.etag } : {}),
			schema_version: SCHEMA_VERSION,
		};
		entries.push(newEntry);
		stats.manifestsMerged += 1;

		if (!dryRun) {
			try {
				// using top-level imports
				if (existsSync(oldManifestPath)) unlinkSync(oldManifestPath);
			} catch {
				// no-op
			}
		}
		tryRemoveEmptyDir(editionPath, stats, dryRun);
	}

	if (entries.length > 0) {
		entries.sort((a, b) => `${a.doc}@${a.edition ?? ''}`.localeCompare(`${b.doc}@${b.edition ?? ''}`));
		const corpusManifest = {
			schema_version: SCHEMA_VERSION,
			corpus: 'aim',
			entries,
		};
		writeAtomic(join(aimRoot, 'manifest.json'), `${JSON.stringify(corpusManifest, null, 2)}\n`, dryRun);
	}
}

function migrateRegs(cacheRoot: string, stats: Stats, dryRun: boolean): void {
	const regsRoot = join(cacheRoot, 'regulations');
	if (!isDir(regsRoot)) return;

	for (const titleDir of readdirSync(regsRoot)) {
		const titlePath = join(regsRoot, titleDir);
		if (!isDir(titlePath)) continue;
		const entries: NewEntry[] = [];

		for (const editionDir of readdirSync(titlePath)) {
			const editionPath = join(titlePath, editionDir);
			if (!isDir(editionPath)) continue;
			// Each edition dir held one or more `<slug>.xml` files plus a per-doc
			// manifest. We may not have a manifest at all (regs writers prior to
			// this WP wrote source.xml without a per-edition manifest); fall back
			// to walking *.xml files.
			const oldManifestPath = join(editionPath, 'manifest.json');
			const oldManifest = readJsonOrNull<OldDocManifest>(oldManifestPath);

			for (const fileName of readdirSync(editionPath)) {
				if (!fileName.endsWith('.xml')) continue;
				if (fileName === 'source.xml') {
					// source.xml is a symlink alias from the staged rollout; the
					// descriptive .xml file (full.xml or parts-<f>.xml) is the real
					// data. Skip the symlink.
					continue;
				}
				const oldXmlPath = join(editionPath, fileName);
				const isFiltered = fileName.startsWith('parts-');
				const newFilename = isFiltered ? `${editionDir}-${fileName}` : `${editionDir}.xml`;
				const newXmlPath = join(titlePath, newFilename);
				moveOrSkip(oldXmlPath, newXmlPath, stats, dryRun);

				const baseEntry = oldManifest;
				if (baseEntry !== null) {
					const newEntry: NewEntry = {
						corpus: 'regs',
						doc: baseEntry.doc,
						edition: baseEntry.edition,
						source_url: baseEntry.source_url,
						source_filename: newFilename,
						source_sha256: baseEntry.source_sha256,
						size_bytes: baseEntry.size_bytes,
						fetched_at: baseEntry.fetched_at,
						...(baseEntry.last_modified !== undefined ? { last_modified: baseEntry.last_modified } : {}),
						...(baseEntry.etag !== undefined ? { etag: baseEntry.etag } : {}),
						schema_version: SCHEMA_VERSION,
					};
					entries.push(newEntry);
				}
				stats.manifestsMerged += 1;
			}

			// Drop source.xml symlink if present.
			const oldSourceSymlink = join(editionPath, 'source.xml');
			if (existsSync(oldSourceSymlink) && !dryRun) {
				try {
					// using top-level imports
					unlinkSync(oldSourceSymlink);
				} catch {
					// no-op
				}
			}
			if (!dryRun) {
				try {
					// using top-level imports
					if (existsSync(oldManifestPath)) unlinkSync(oldManifestPath);
				} catch {
					// no-op
				}
			}
			tryRemoveEmptyDir(editionPath, stats, dryRun);
		}

		if (entries.length > 0) {
			entries.sort((a, b) =>
				`${a.edition ?? ''}@${a.source_filename}`.localeCompare(`${b.edition ?? ''}@${b.source_filename}`),
			);
			const corpusManifest = {
				schema_version: SCHEMA_VERSION,
				corpus: 'regs',
				entries,
			};
			writeAtomic(join(titlePath, 'manifest.json'), `${JSON.stringify(corpusManifest, null, 2)}\n`, dryRun);
		}
	}
}

function migrateHandbooks(cacheRoot: string, stats: Stats, dryRun: boolean): void {
	const handbooksRoot = join(cacheRoot, 'handbooks');
	if (!isDir(handbooksRoot)) return;

	for (const slug of readdirSync(handbooksRoot)) {
		const slugPath = join(handbooksRoot, slug);
		if (!isDir(slugPath)) continue;
		for (const editionDir of readdirSync(slugPath)) {
			const editionPath = join(slugPath, editionDir);
			if (!isDir(editionPath)) continue;

			// Primary PDF: rename source.pdf -> <edition>.pdf.
			const oldPrimary = join(editionPath, 'source.pdf');
			const newPrimary = join(editionPath, `${editionDir}.pdf`);
			moveOrSkip(oldPrimary, newPrimary, stats, dryRun);

			// Errata: <edition>/_errata/<id>.pdf -> <edition>/<edition>-errata-<id>.pdf.
			const errataDir = join(editionPath, '_errata');
			const erratumIds: string[] = [];
			if (isDir(errataDir)) {
				for (const errataFile of readdirSync(errataDir)) {
					if (!errataFile.endsWith('.pdf')) continue;
					const erratumId = errataFile.replace(/\.pdf$/i, '');
					erratumIds.push(erratumId);
					const oldErrata = join(errataDir, errataFile);
					const newErrata = join(editionPath, `${editionDir}-errata-${erratumId}.pdf`);
					moveOrSkip(oldErrata, newErrata, stats, dryRun);
				}
				tryRemoveEmptyDir(errataDir, stats, dryRun);
			}

			// Per-edition manifest: read existing (if any) and rewrite into the new
			// shape with `primary` + `errata[]`. The old manifest written by the
			// Python ingest is inline-derivative-shaped; this script owns the
			// CACHE-side manifest, which the new TS readers read. We synthesize a
			// minimal cache manifest for whatever bytes are present on disk.
			const newManifestPath = join(editionPath, 'manifest.json');
			const primaryEntry: Partial<NewEntry> = {
				corpus: 'handbooks',
				doc: slug,
				edition: editionDir,
				source_filename: `${editionDir}.pdf`,
				schema_version: SCHEMA_VERSION,
			};
			// Try to recover audit metadata from the in-repo derivative manifest.
			// (The cache previously had no per-edition manifest; the Python ingest
			// wrote audit data inline. We leave fields like sha256 + size as zeros
			// and let the next `bun run sources download` HEAD-check populate them.)
			const newManifest: {
				schema_version: number;
				corpus: 'handbooks';
				doc: string;
				edition: string | null;
				primary: Partial<NewEntry>;
				errata?: Partial<NewEntry>[];
			} = {
				schema_version: SCHEMA_VERSION,
				corpus: 'handbooks',
				doc: slug,
				edition: editionDir,
				primary: primaryEntry,
			};
			if (erratumIds.length > 0) {
				newManifest.errata = erratumIds.map((id) => ({
					corpus: 'handbooks',
					doc: slug,
					edition: editionDir,
					source_filename: `${editionDir}-errata-${id}.pdf`,
					schema_version: SCHEMA_VERSION,
				}));
			}

			// If a previous manifest exists with audit metadata, preserve sha256 etc.
			const existing = readJsonOrNull<{ source_url?: string; source_checksum?: string; fetched_at?: string }>(
				newManifestPath,
			);
			if (existing !== null) {
				if (typeof existing.source_url === 'string') primaryEntry.source_url = existing.source_url;
				if (typeof existing.source_checksum === 'string') primaryEntry.source_sha256 = existing.source_checksum;
				if (typeof existing.fetched_at === 'string') primaryEntry.fetched_at = existing.fetched_at;
			}
			writeAtomic(newManifestPath, `${JSON.stringify(newManifest, null, 2)}\n`, dryRun);
			stats.manifestsMerged += 1;
		}
	}
}

function assertNoBrokenSymlinks(cacheRoot: string, stats: Stats): void {
	function walk(dir: string): void {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return;
		}
		for (const name of entries) {
			const full = join(dir, name);
			let lst: import('node:fs').Stats;
			try {
				// using top-level imports
				lst = lstatSync(full);
			} catch {
				continue;
			}
			if (lst.isSymbolicLink() && !existsSync(full)) {
				stats.warnings.push(`broken symlink: ${full}`);
				continue;
			}
			if (lst.isDirectory()) walk(full);
		}
	}
	walk(cacheRoot);
}

async function main(): Promise<number> {
	const argv = process.argv.slice(2);
	const dryRun = argv.includes('--dry-run');

	const cacheRoot = resolveCacheRoot();
	console.log(`Migrating cache to ADR 021 flat layout: ${cacheRoot}${dryRun ? ' (dry-run)' : ''}`);

	const stats: Stats = {
		renames: 0,
		dirsRemoved: 0,
		manifestsMerged: 0,
		warnings: [],
		info: [],
	};

	migrateFlatCorpus(cacheRoot, 'ac', stats, dryRun);
	migrateFlatCorpus(cacheRoot, 'acs', stats, dryRun);
	migrateAim(cacheRoot, stats, dryRun);
	migrateRegs(cacheRoot, stats, dryRun);
	migrateHandbooks(cacheRoot, stats, dryRun);
	assertNoBrokenSymlinks(cacheRoot, stats);

	console.log('');
	console.log('Migration summary');
	console.log('=================');
	console.log(`  files renamed:     ${stats.renames}`);
	console.log(`  dirs removed:      ${stats.dirsRemoved}`);
	console.log(`  manifests merged:  ${stats.manifestsMerged}`);
	console.log(`  warnings:          ${stats.warnings.length}`);
	console.log(`  info notices:      ${stats.info.length}`);
	if (stats.warnings.length > 0) {
		console.log('');
		console.log('WARNINGS (operator review required):');
		for (const w of stats.warnings) console.log(`  ${w}`);
	}
	if (stats.info.length > 0 && process.env.AIRBOSS_MIGRATE_VERBOSE === '1') {
		console.log('');
		console.log('INFO:');
		for (const i of stats.info) console.log(`  ${i}`);
	}
	return stats.warnings.length > 0 ? 1 : 0;
}

main().then((code) => process.exit(code));
