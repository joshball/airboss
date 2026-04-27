/**
 * Query API surface for `@ab/sources` registry.
 *
 * Source of truth: ADR 019 §2.3 (12-function query API). The renderer
 * (Phase 4), annual diff job (Phase 5), and ingestion phases (Phase 3+)
 * all consume this surface.
 *
 * Phase 2 implements every function; per-corpus content lands in later
 * phases. Functions that scan lessons (`findLessonsCiting*`) are backed by
 * a lazy reverse index (`reverse-index.ts`); the index rebuilds on demand
 * per process.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { LESSON_CONTENT_PATHS } from '../check.ts';
import { parseLesson } from '../lesson-parser.ts';
import type { Edition, EditionId, LessonId, SourceEntry, SourceId } from '../types.ts';
import { getCorpusResolver } from './corpus-resolver.ts';
import { getEditionsMap } from './editions.ts';
import { getSources } from './sources.ts';

// ---------------------------------------------------------------------------
// Pin-stripping helper
// ---------------------------------------------------------------------------

/**
 * Strip `?at=...` from a `SourceId`-shaped string, leaving the canonical
 * pin-agnostic key. Keys in `SOURCES` are pin-agnostic; queries against the
 * registry must strip pins from caller input.
 */
export function stripPin(raw: string): string {
	const queryStart = raw.indexOf('?');
	return queryStart === -1 ? raw : raw.slice(0, queryStart);
}

// ---------------------------------------------------------------------------
// Static queries (ADR 019 §2.3)
// ---------------------------------------------------------------------------

/**
 * Resolve an identifier to its `SourceEntry`. Strips `?at=` from the input
 * before lookup. Returns null when the entry is unknown.
 */
export function resolveIdentifier(id: SourceId): SourceEntry | null {
	const stripped = stripPin(id) as SourceId;
	return getSources()[stripped] ?? null;
}

/** Boolean form of `resolveIdentifier`. */
export function hasEntry(id: SourceId): boolean {
	return resolveIdentifier(id) !== null;
}

/**
 * Return the immediate (one-level-deep) children of `id`. Children are
 * computed via slug prefix on `SourceId` paths: child IDs share `id` as a
 * prefix and have exactly one additional path segment.
 *
 * Example: children of `airboss-ref:regs/cfr-14/91` include
 * `airboss-ref:regs/cfr-14/91/103` and `airboss-ref:regs/cfr-14/91/107` but
 * exclude `airboss-ref:regs/cfr-14/91/103/b` (grandchild).
 */
export function getChildren(id: SourceId): readonly SourceEntry[] {
	const stripped = stripPin(id);
	const sources = getSources();
	const out: SourceEntry[] = [];
	const prefix = `${stripped}/`;
	for (const [key, entry] of Object.entries(sources) as [SourceId, SourceEntry][]) {
		if (!key.startsWith(prefix)) continue;
		const remainder = key.slice(prefix.length);
		// "one-level-deep" = no additional `/` in the remainder.
		if (remainder.length === 0) continue;
		if (remainder.includes('/')) continue;
		out.push(entry);
	}
	return out;
}

/**
 * Walk the supersession chain forward from `id`. Returns the ordered list of
 * entries from `id` -> `superseded_by` -> ... until a missing pointer or a
 * cycle is detected. Cycle protection caps the walk at `MAX_CHAIN_DEPTH`.
 */
export function walkSupersessionChain(id: SourceId): readonly SourceEntry[] {
	const MAX_CHAIN_DEPTH = 32;
	const visited = new Set<string>();
	const chain: SourceEntry[] = [];
	let cursor: SourceId | undefined = stripPin(id) as SourceId;
	while (cursor !== undefined && chain.length < MAX_CHAIN_DEPTH) {
		if (visited.has(cursor)) break; // cycle
		visited.add(cursor);
		const entry = getSources()[cursor];
		if (entry === undefined) break;
		chain.push(entry);
		cursor = entry.superseded_by;
	}
	return chain;
}

/**
 * Returns true when walking the supersession chain encounters a missing
 * pointer (a `superseded_by` that points to a non-existent entry).
 */
export function isSupersessionChainBroken(id: SourceId): boolean {
	const stripped = stripPin(id) as SourceId;
	const sources = getSources();
	let cursor: SourceId | undefined = stripped;
	const visited = new Set<string>();
	while (cursor !== undefined) {
		if (visited.has(cursor)) return false; // cycle is not "broken"
		visited.add(cursor);
		const entry = sources[cursor];
		if (entry === undefined) return true;
		cursor = entry.superseded_by;
	}
	return false;
}

/**
 * Find every entry whose `canonical_short` matches `short` (case-insensitive).
 * Linear scan; the corpus is small enough for v1. Per-canonical-short
 * indexing is a future optimisation.
 */
export function findEntriesByCanonicalShort(short: string): readonly SourceEntry[] {
	const needle = short.toLowerCase();
	const out: SourceEntry[] = [];
	for (const entry of Object.values(getSources())) {
		if (entry.canonical_short.toLowerCase() === needle) {
			out.push(entry);
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Cross-corpus / lesson-citing queries (ADR 019 §2.3)
// ---------------------------------------------------------------------------

/**
 * Lessons that reference `id` directly (any pin). Walks the reverse index
 * keyed by pin-stripped `SourceId`.
 */
export async function findLessonsCitingEntry(id: SourceId): Promise<readonly LessonId[]> {
	const index = await getReverseIndex();
	const stripped = stripPin(id);
	return index.get(stripped) ?? [];
}

/**
 * Lessons that reference `id` directly OR transitively through other lesson
 * citations. Phase 2 ships this as a degenerate alias of
 * `findLessonsCitingEntry` because no airboss-ref: phase introduces lesson-
 * to-lesson references; the function fills in when those land.
 */
export async function findLessonsTransitivelyCitingEntry(id: SourceId): Promise<readonly LessonId[]> {
	return findLessonsCitingEntry(id);
}

/**
 * Lessons that reference every id in `ids`. Set intersection of per-id
 * results.
 */
export async function findLessonsCitingMultiple(ids: readonly SourceId[]): Promise<readonly LessonId[]> {
	if (ids.length === 0) return [];
	const perIdResults: ReadonlySet<LessonId>[] = [];
	for (const id of ids) {
		const lessons = await findLessonsCitingEntry(id);
		perIdResults.push(new Set(lessons));
	}
	const [first, ...rest] = perIdResults;
	if (first === undefined) return [];
	const intersection: LessonId[] = [];
	for (const lessonId of first) {
		if (rest.every((set) => set.has(lessonId))) {
			intersection.push(lessonId);
		}
	}
	return intersection;
}

// ---------------------------------------------------------------------------
// Edition queries (ADR 019 §2.3)
// ---------------------------------------------------------------------------

/** The current edition for `corpus`, per the registered resolver. */
export function getCurrentEdition(corpus: string): EditionId | null {
	const resolver = getCorpusResolver(corpus);
	return resolver?.getCurrentEdition() ?? null;
}

/** Edition history for `id`, in chronological order. */
export async function getEditions(id: SourceId): Promise<readonly Edition[]> {
	const stripped = stripPin(id) as SourceId;
	return getEditionsMap().get(stripped) ?? [];
}

/**
 * Returns true when `pin` is more than one edition older than the current
 * accepted edition for the entry's corpus. Mirrors the row-6 staleness check
 * in the validator.
 */
export async function isPinStale(id: SourceId, pin: EditionId): Promise<boolean> {
	const stripped = stripPin(id) as SourceId;
	const entry = getSources()[stripped];
	if (entry === undefined) return false;
	const current = getCurrentEdition(entry.corpus);
	if (current === null) return false;
	if (current === pin) return false;
	const editions = await getEditions(stripped);
	if (editions.length === 0) return false;
	const pinIndex = editions.findIndex((e) => e.id === pin);
	const currentIndex = editions.findIndex((e) => e.id === current);
	if (pinIndex === -1 || currentIndex === -1) return false;
	return currentIndex - pinIndex > 1;
}

// ---------------------------------------------------------------------------
// Reverse-index walk (lazy, process-cached)
// ---------------------------------------------------------------------------

interface ReverseIndex {
	readonly entries: ReadonlyMap<string, readonly LessonId[]>;
}

let cachedReverseIndex: ReverseIndex | null = null;

/**
 * Build (or return cached) reverse index of pin-stripped SourceId -> LessonId[].
 * Walks `LESSON_CONTENT_PATHS` and parses each lesson via `parseLesson`.
 * Skip-range awareness is inherited from `parseLesson` (fenced code, inline
 * code, ref-definition lines).
 */
export async function getReverseIndex(): Promise<ReadonlyMap<string, readonly LessonId[]>> {
	if (cachedReverseIndex !== null) return cachedReverseIndex.entries;
	cachedReverseIndex = { entries: buildReverseIndex(process.cwd()) };
	return cachedReverseIndex.entries;
}

/**
 * Test-only / explicit reset. Clears the cached index so the next query
 * rebuilds.
 */
export function clearReverseIndex(): void {
	cachedReverseIndex = null;
}

/**
 * Build the reverse index from a working directory. Exposed for tests.
 */
export function buildReverseIndex(cwd: string): ReadonlyMap<string, readonly LessonId[]> {
	const index = new Map<string, LessonId[]>();
	for (const root of LESSON_CONTENT_PATHS) {
		const absRoot = join(cwd, root);
		if (!existsSync(absRoot)) continue;
		for (const file of walkMarkdownFiles(absRoot)) {
			const relPath = file.startsWith(`${cwd}${sep}`) ? file.slice(cwd.length + 1) : file;
			let source: string;
			try {
				source = readFileSync(file, 'utf-8');
			} catch {
				continue;
			}
			const lesson = parseLesson(relPath, source);
			const lessonId = stripMarkdownExt(relPath);
			for (const occ of lesson.occurrences) {
				const key = stripPin(occ.raw);
				const list = index.get(key) ?? [];
				if (!list.includes(lessonId)) {
					list.push(lessonId);
				}
				index.set(key, list);
			}
		}
	}
	return index;
}

/**
 * Convert a lesson file path (repo-relative or absolute) to the canonical
 * `LessonId` form -- repo-relative path with `.md` stripped.
 */
export function lessonId(file: string): LessonId {
	return stripMarkdownExt(file);
}

function stripMarkdownExt(file: string): string {
	return file.endsWith('.md') ? file.slice(0, -3) : file;
}

function* walkMarkdownFiles(root: string): Generator<string> {
	const stack: string[] = [root];
	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined) break;
		let entries: ReturnType<typeof readdirSync>;
		try {
			entries = readdirSync(current, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
				continue;
			}
			if (entry.isFile() && entry.name.endsWith('.md')) {
				try {
					if (statSync(full).isFile()) yield full;
				} catch {
					// ignore
				}
			}
		}
	}
}
