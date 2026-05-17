// @browser-globals: server-only -- never imported by client .svelte
/**
 * CFR navigation tree (Title -> Chapter -> Subchapter -> Part) -- decoupled
 * sidecar to the regulations content corpus.
 *
 * Why a sidecar:
 *   The content pipeline (`ingest.ts` -> `derivative-writer.ts`) keeps a flat
 *   per-Part `manifest.json` + `sections.json`. The structural skeleton above
 *   the Part level (Chapter, Subchapter) is what canonical eCFR URLs encode
 *   (`/chapter-I/subchapter-F/part-91`) but it has no place in the existing
 *   manifest shape. Rather than enrich the manifest schema -- which the
 *   library renderers don't care about -- we emit a small sidecar
 *   `nav-tree.yaml` per edition. Loaders read it lazily; the URL builder
 *   uses it; everything else ignores it.
 *
 *   Authoring-relevant, ~10KB, lives inline in `regulations/cfr-<title>/<edition>/`.
 *   Re-emitted on every ingest (idempotent via `writeIfChanged`).
 *
 * Public surface (browser-safe reader API):
 *   - {@link getCfrNavTree}          -- lazy-load + cache the parsed YAML.
 *   - {@link findChapterForPart}     -- (titleNumber, partNumber) -> { chapter, subchapter }.
 *   - {@link buildEcfrUrl}           -- canonical URL builder for any structural level.
 *   - {@link logUnmappedParts}       -- one-shot warn surface for parts missing a chapter mapping.
 *   - {@link bustNavTreeCache}       -- invalidate the reader cache after a write.
 *
 * The ingest-time writer (`writeCfrNavTree`) lives in the server-only
 * `nav-tree-writer.ts`. It reaches `node:fs` via `write-if-changed.ts`, and
 * keeping it out of this module is what lets the `@ab/sources` runtime barrel
 * stay browser-safe: a production `vite build` follows dynamic-import edges
 * too, so a deferred `await import('../io/write-if-changed.ts')` inside this
 * module would still pull `node:fs` into the client bundle as a lazy chunk
 * and crash the build. See `nav-tree-writer.ts` for the full rationale.
 */

import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// Browser-safe lazy Node built-in loader.
//
// `@ab/sources` is imported from .svelte components (RenderedLesson, etc.)
// so this module is bundled into the browser. Top-level
// `import 'node:fs'` would fail Vite externalization. Resolve fs/path
// lazily at function-call time via `process.getBuiltinModule`, hidden
// from the static analyzer. See libs/constants/src/source-cache.ts for
// the canonical pattern.
// ---------------------------------------------------------------------------

interface NodeFs {
	existsSync(path: string): boolean;
	readFileSync(path: string, encoding: 'utf8'): string;
	readdirSync(path: string): string[];
	statSync(path: string): { isDirectory(): boolean };
}
interface NodePath {
	join(...parts: string[]): string;
}
type GetBuiltinModule = (spec: string) => unknown;
let cachedFs: NodeFs | null = null;
let cachedPath: NodePath | null = null;

function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`nav-tree: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
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
function pathJoin(...parts: string[]): string {
	return nodePath().join(...parts);
}

const ECFR_BASE = 'https://www.ecfr.gov';
const NAV_TREE_FILENAME = 'nav-tree.yaml';

export type CfrTitleNumber = 14 | 49;

export interface CfrNavSubchapter {
	readonly id: string;
	readonly name: string;
	readonly parts: readonly string[];
}
export interface CfrNavChapter {
	readonly id: string;
	readonly name: string;
	readonly subchapters: readonly CfrNavSubchapter[];
	readonly directParts: readonly string[];
}
export interface CfrNavTree {
	readonly title: CfrTitleNumber;
	readonly titleName: string;
	readonly editionDate: string;
	readonly chapters: readonly CfrNavChapter[];
}

export interface PartLocation {
	readonly chapter: CfrNavChapter;
	readonly subchapter: CfrNavSubchapter | null;
}

function fromYamlShape(parsed: unknown, fallbackTitle: CfrTitleNumber): CfrNavTree | null {
	if (parsed === null || typeof parsed !== 'object') return null;
	const obj = parsed as Record<string, unknown>;
	const titleRaw = obj.title;
	const title: CfrTitleNumber =
		titleRaw === 14 || titleRaw === '14' ? 14 : titleRaw === 49 || titleRaw === '49' ? 49 : fallbackTitle;
	const titleName = typeof obj['title-name'] === 'string' ? obj['title-name'] : '';
	const editionDate = typeof obj['edition-date'] === 'string' ? obj['edition-date'] : '';
	const chaptersRaw = Array.isArray(obj.chapters) ? obj.chapters : [];
	const chapters: CfrNavChapter[] = [];
	for (const cRaw of chaptersRaw) {
		if (cRaw === null || typeof cRaw !== 'object') continue;
		const c = cRaw as Record<string, unknown>;
		const id = typeof c.id === 'string' ? c.id : null;
		const name = typeof c.name === 'string' ? c.name : '';
		if (id === null) continue;
		const subRaw = Array.isArray(c.subchapters) ? c.subchapters : [];
		const subchapters: CfrNavSubchapter[] = [];
		for (const sRaw of subRaw) {
			if (sRaw === null || typeof sRaw !== 'object') continue;
			const s = sRaw as Record<string, unknown>;
			const sId = typeof s.id === 'string' ? s.id : null;
			if (sId === null) continue;
			const sName = typeof s.name === 'string' ? s.name : '';
			const partsRaw = Array.isArray(s.parts) ? s.parts : [];
			const parts = partsRaw.filter((p): p is string => typeof p === 'string');
			subchapters.push({ id: sId, name: sName, parts });
		}
		const directRaw = Array.isArray(c['direct-parts']) ? c['direct-parts'] : [];
		const directParts = directRaw.filter((p): p is string => typeof p === 'string');
		chapters.push({ id, name, subchapters, directParts });
	}
	return { title, titleName, editionDate, chapters };
}

// ---------------------------------------------------------------------------
// Loader (lazy + cached)
// ---------------------------------------------------------------------------

const NAV_TREE_CACHE = new Map<string, CfrNavTree | null>();
const NAV_TREE_LATEST_CACHE = new Map<CfrTitleNumber, CfrNavTree | null>();

function makeCacheKey(title: CfrTitleNumber, editionDate: string): string {
	return `${title}::${editionDate}`;
}

/**
 * Invalidate the in-memory reader cache for one (title, edition) so the next
 * `getCfrNavTree` call re-reads from disk. Called by `writeCfrNavTree` in
 * `nav-tree-writer.ts` after emitting fresh YAML.
 */
export function bustNavTreeCache(title: CfrTitleNumber, editionDate: string): void {
	NAV_TREE_CACHE.delete(makeCacheKey(title, editionDate));
	NAV_TREE_LATEST_CACHE.delete(title);
}

/**
 * Repo-relative root for committed CFR derivatives. Mirrors the convention
 * used by `seed-references-from-manifest`. Override via `AIRBOSS_REGS_ROOT`
 * for tests that emit YAML to a tmpdir.
 */
function regsRoot(): string {
	const proc = typeof process !== 'undefined' ? process : undefined;
	const override = proc?.env?.AIRBOSS_REGS_ROOT;
	if (override !== undefined && override.length > 0) return override;
	const cwd = typeof proc?.cwd === 'function' ? proc.cwd() : '.';
	return pathJoin(cwd, 'regulations');
}

/**
 * Resolve the latest edition directory for a title. The directory layout is
 * `regulations/cfr-<title>/<YYYY-MM-DD>/`; we pick the alphabetically-greatest
 * edition (ISO dates sort lexicographically).
 */
function findLatestEditionDate(title: CfrTitleNumber, root: string): string | null {
	const fs = nodeFs();
	const titleDir = pathJoin(root, `cfr-${title}`);
	if (!fs.existsSync(titleDir)) return null;
	let latest: string | null = null;
	for (const entry of fs.readdirSync(titleDir)) {
		const full = pathJoin(titleDir, entry);
		if (!fs.statSync(full).isDirectory()) continue;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(entry)) continue;
		if (latest === null || entry > latest) latest = entry;
	}
	return latest;
}

/**
 * Lazy-load + cache the parsed nav-tree YAML for a given title (latest
 * edition by default, or a specific date when provided). Returns null
 * when the YAML is missing or malformed -- callers must fall back to
 * shortcut URLs in that case.
 */
export function getCfrNavTree(titleNumber: CfrTitleNumber, editionDate?: string): CfrNavTree | null {
	const root = regsRoot();
	const date = editionDate ?? findLatestEditionDate(titleNumber, root);
	if (date === null) return null;

	const key = makeCacheKey(titleNumber, date);
	if (NAV_TREE_CACHE.has(key)) return NAV_TREE_CACHE.get(key) ?? null;

	const fs = nodeFs();
	const path = pathJoin(root, `cfr-${titleNumber}`, date, NAV_TREE_FILENAME);
	if (!fs.existsSync(path)) {
		NAV_TREE_CACHE.set(key, null);
		return null;
	}
	let parsed: unknown;
	try {
		parsed = parseYaml(fs.readFileSync(path, 'utf8'));
	} catch {
		NAV_TREE_CACHE.set(key, null);
		return null;
	}
	const tree = fromYamlShape(parsed, titleNumber);
	NAV_TREE_CACHE.set(key, tree);
	if (editionDate === undefined) NAV_TREE_LATEST_CACHE.set(titleNumber, tree);
	return tree;
}

/**
 * (titleNumber, partNumber) -> chapter + (optional) subchapter the part lives
 * under. Returns null when the title has no nav-tree on disk OR the part is
 * not represented in the YAML.
 */
export function findChapterForPart(titleNumber: CfrTitleNumber, partNumber: string): PartLocation | null {
	const tree = getCfrNavTree(titleNumber);
	if (tree === null) return null;
	for (const chapter of tree.chapters) {
		if (chapter.directParts.includes(partNumber)) {
			return { chapter, subchapter: null };
		}
		for (const sub of chapter.subchapters) {
			if (sub.parts.includes(partNumber)) {
				return { chapter, subchapter: sub };
			}
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

export interface BuildEcfrUrlArgs {
	readonly chapter?: string;
	readonly subchapter?: string;
	readonly part?: string;
	readonly section?: string;
}

/**
 * Construct a canonical `https://www.ecfr.gov/current/...` URL for any
 * structural level of a CFR title. When `chapter` / `subchapter` are
 * omitted but `part` is provided, the URL falls back to the eCFR
 * "shortcut" form (`/title-14/part-91`) which redirects to the canonical
 * form server-side.
 */
export function buildEcfrUrl(titleNumber: CfrTitleNumber, args: BuildEcfrUrlArgs): string {
	const segments: string[] = [`/title-${titleNumber}`];
	if (args.chapter !== undefined && args.chapter.length > 0) {
		segments.push(`/chapter-${args.chapter}`);
		if (args.subchapter !== undefined && args.subchapter.length > 0) {
			segments.push(`/subchapter-${args.subchapter}`);
		}
	}
	if (args.part !== undefined && args.part.length > 0) {
		segments.push(`/part-${args.part}`);
		if (args.section !== undefined && args.section.length > 0) {
			segments.push(`/section-${args.section}`);
		}
	}
	return `${ECFR_BASE}/current${segments.join('')}`;
}

/**
 * Build the canonical eCFR URL for a (titleNumber, partNumber) by looking
 * up the chapter/subchapter context in the nav-tree YAML. Falls back to
 * the shortcut form when the part has no mapping.
 */
export function buildPartUrl(titleNumber: CfrTitleNumber, partNumber: string): string {
	const loc = findChapterForPart(titleNumber, partNumber);
	if (loc === null) return buildEcfrUrl(titleNumber, { part: partNumber });
	return buildEcfrUrl(titleNumber, {
		chapter: loc.chapter.id,
		subchapter: loc.subchapter?.id,
		part: partNumber,
	});
}

/**
 * Build the canonical eCFR URL for a section. `sectionCode` is the dotted
 * form (e.g. `91.103`). Falls back to shortcut form when the part has no
 * chapter mapping.
 */
export function buildSectionUrl(titleNumber: CfrTitleNumber, partNumber: string, sectionCode: string): string {
	const loc = findChapterForPart(titleNumber, partNumber);
	const dotted = sectionCode.includes('.') ? sectionCode : `${partNumber}.${sectionCode}`;
	if (loc === null) {
		return buildEcfrUrl(titleNumber, { part: partNumber, section: dotted });
	}
	return buildEcfrUrl(titleNumber, {
		chapter: loc.chapter.id,
		subchapter: loc.subchapter?.id,
		part: partNumber,
		section: dotted,
	});
}

/**
 * Walk a list of `(titleNumber, partNumber)` pairs and emit a single warn
 * line listing parts that have no chapter mapping. Run once at startup to
 * surface authoring gaps without spamming per-render.
 */
export function logUnmappedParts(
	pairs: ReadonlyArray<{ title: CfrTitleNumber; part: string }>,
	logger: { warn: (message: string) => void } = console,
): void {
	const missing: string[] = [];
	for (const { title, part } of pairs) {
		if (findChapterForPart(title, part) === null) missing.push(`${title} CFR Part ${part}`);
	}
	if (missing.length === 0) return;
	logger.warn(`[cfr-nav-tree] ${missing.length} part(s) missing chapter mapping: ${missing.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Test-only surface
// ---------------------------------------------------------------------------

export const __nav_tree_internal__ = {
	fromYamlShape,
	clearCache(): void {
		NAV_TREE_CACHE.clear();
		NAV_TREE_LATEST_CACHE.clear();
	},
};
