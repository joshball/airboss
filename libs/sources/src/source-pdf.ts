/**
 * Local-cache PDF resolution for the flightbag reader's "Source" panel.
 *
 * The source-document cache (per ADR 018) lives at `~/Documents/airboss-handbook-cache/`
 * by default. Each corpus owns a subdirectory there:
 *
 *   handbooks/<doc-slug>/<edition>/<edition>.pdf  (e.g. ifh/FAA-H-8083-15B/FAA-H-8083-15B.pdf)
 *   ac/ac-<doc>-<rev>.pdf                          (e.g. ac/ac-61-65-j.pdf)
 *   acs/<slug>.pdf                                 (e.g. acs/faa-s-acs-6.pdf)
 *
 * AIM and CFR have no canonical FAA PDF (AIM is HTML-only on FAA's site, CFR
 * is queryable HTML at eCFR), so they intentionally have no entry here.
 *
 * # Browser safety
 *
 * `@ab/sources` is browser-bundled. Like `@ab/constants/source-cache.ts`, the
 * cache-existence check uses `process.getBuiltinModule('node:fs')` lazily so
 * the static analyzer never sees a `node:fs` import and the browser bundle
 * stays clean. Functions that touch the filesystem only run on the server
 * (page loaders / asset endpoints) -- the browser loads the module but never
 * executes those code paths.
 */

import { REFERENCE_KINDS, type ReferenceKind, resolveCacheRoot, SOURCE_CACHE } from '@ab/constants';

/**
 * Per-corpus cache subpath for a reference's source PDF.
 *
 * Returned path is relative to the cache root and uses forward slashes.
 * `null` is returned for kinds that have no canonical FAA PDF (AIM, CFR --
 * neither is published as a single download).
 */
export interface SourcePdfDescriptor {
	/** Cache subpath the streamer route serves: `<corpus>/<rest>`. */
	readonly cacheRelPath: string;
	/** Suggested filename for `Content-Disposition` headers. */
	readonly filename: string;
}

/**
 * Resolve where the canonical PDF for a reference would live in the cache.
 * Pure (no fs access) so the path can be computed in browser-safe code paths;
 * existence checks happen in `cachedSourcePdfExists` (server-only).
 *
 * Returns `null` when the corpus has no canonical PDF (AIM, CFR), or when the
 * input shape can't be turned into a stable filename (defensive default).
 */
export function describeSourcePdf(args: {
	kind: ReferenceKind;
	documentSlug: string;
	edition: string;
}): SourcePdfDescriptor | null {
	const { kind, documentSlug, edition } = args;
	switch (kind) {
		case REFERENCE_KINDS.HANDBOOK: {
			// `<root>/handbooks/<slug>/<edition>/<edition>.pdf` -- mirrors the ingest
			// layout. Edition is the full FAA shape (e.g. `FAA-H-8083-15B`).
			const filename = `${edition}.pdf`;
			return {
				cacheRelPath: `${SOURCE_CACHE.HANDBOOKS}/${documentSlug}/${edition}/${filename}`,
				filename,
			};
		}
		case REFERENCE_KINDS.AC: {
			// AC slug is `ac-<doc>` (e.g. `ac-61-65`); edition string carries the
			// revision letter at the end (`AC 61-65J`). Cache filename convention:
			// `ac-<doc>-<revLower>.pdf`.
			const slugMatch = /^ac-(.+)$/.exec(documentSlug);
			const docPart = slugMatch?.[1] ?? documentSlug;
			const revMatch = /([A-Za-z])$/.exec(edition);
			const rev = revMatch?.[1] ?? '';
			const suffix = rev ? `-${rev.toLowerCase()}` : '';
			const filename = `ac-${docPart}${suffix}.pdf`;
			return {
				cacheRelPath: `${SOURCE_CACHE.AC}/${filename}`,
				filename,
			};
		}
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS: {
			// ACS/PTS publication slug is the cache filename stem.
			const filename = acsCacheFilename(documentSlug);
			return { cacheRelPath: `${SOURCE_CACHE.ACS}/${filename}`, filename };
		}
		case REFERENCE_KINDS.AIM:
		case REFERENCE_KINDS.CFR:
		case REFERENCE_KINDS.PCG:
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
		case REFERENCE_KINDS.SAFO:
		case REFERENCE_KINDS.INFO:
			// SAFO / InFO bulletins are short HTML / text artifacts, not PDFs in
			// the sense the cache layout encodes. The flightbag reader streams
			// them from the markdown corpus directly; no source PDF descriptor
			// to surface here yet. When per-bulletin PDFs land, add the cache
			// shape alongside AC's pattern.
			return null;
		default: {
			const exhaustive: never = kind;
			void exhaustive;
			return null;
		}
	}
}

/**
 * ACS publication slug -> cache filename mapping. The slug authored in the
 * registry (e.g. `ppl-airplane-6c`) does not always match the cache filename
 * the FAA distributes (e.g. `faa-s-acs-6.pdf`). Until we have a registry-
 * driven mapping, we default to `<slug>.pdf` and let the existence check
 * fail loudly on a fresh dev box rather than guessing.
 */
function acsCacheFilename(slug: string): string {
	return `${slug}.pdf`;
}

type NodeFs = { existsSync: (p: string) => boolean };
type NodePath = { join: (...parts: string[]) => string; resolve: (...parts: string[]) => string };

let cachedFs: NodeFs | null = null;
let cachedPath: NodePath | null = null;

type GetBuiltinModule = (spec: string) => unknown;

function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`source-pdf: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

function nodeFs(): NodeFs {
	if (!cachedFs) cachedFs = loadBuiltin<NodeFs>('node:fs');
	return cachedFs;
}

function nodePath(): NodePath {
	if (!cachedPath) cachedPath = loadBuiltin<NodePath>('node:path');
	return cachedPath;
}

/**
 * Server-only: check whether a cache-relative path exists on disk under the
 * resolved cache root. Returns `false` when the file is missing, the cache
 * root doesn't resolve, or the runtime isn't Node-shaped (browsers).
 *
 * The `cacheRelPath` must be a forward-slashed path that already includes the
 * per-corpus subdirectory. Path-traversal segments (`..`) are rejected even
 * though the streamer also enforces this -- the resolver shouldn't emit them.
 */
export function cachedSourcePdfExists(cacheRelPath: string): boolean {
	if (typeof process === 'undefined') return false;
	if (cacheRelPath.includes('..')) return false;
	try {
		const path = nodePath();
		const root = resolveCacheRoot({ ensureExists: false });
		const abs = path.resolve(root, cacheRelPath);
		// Defense in depth: refuse anything outside the cache root.
		if (!abs.startsWith(root)) return false;
		return nodeFs().existsSync(abs);
	} catch {
		return false;
	}
}

/**
 * Resolve a cache-relative path back to its absolute on-disk path. Mirrors
 * the path-traversal guard in `cachedSourcePdfExists`. Returns `null` when
 * the path escapes the cache root or when the resolution fails. Server-only.
 */
export function resolveCachedSourcePdfPath(cacheRelPath: string): string | null {
	if (typeof process === 'undefined') return null;
	if (cacheRelPath.includes('..')) return null;
	try {
		const path = nodePath();
		const root = resolveCacheRoot({ ensureExists: false });
		const abs = path.resolve(root, cacheRelPath);
		if (!abs.startsWith(root)) return null;
		return abs;
	} catch {
		return null;
	}
}
