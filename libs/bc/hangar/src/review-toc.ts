/**
 * Reference-TOC parser. Reads a `hangar.reference.verbatim` jsonb blob and
 * emits a flat list of TOC entries the walker substrate can drive.
 *
 * The ingestion pipeline accepts three TOC shapes (the spec gap #2 calls
 * this out). All three flatten to the same `TocEntry[]` here so the
 * `/review/reference_toc/[itemId]` page never has to special-case shape:
 *
 *   - `{ toc: [...] }`            -- direct array (most common)
 *   - `{ kind: 'toc', items: [...] }` -- discriminator + items array
 *   - `{ tableOfContents: [...] | { entries: [...] } }` -- legacy verbose
 *
 * Each entry's `entryRef` is a deterministic hash of `(referenceId,
 * indexInList)` so the walker substrate's `(sessionId, stepRef)` unique
 * index keeps recordings idempotent. Mirrors `parseTestPlan`'s `stepRef`
 * pattern; see `libs/bc/hangar/src/review-test-plan.ts`.
 */

import { createHash } from 'node:crypto';

export interface TocEntry {
	/** 1-based position across the flattened TOC. */
	readonly entryIndex: number;
	/** Visible label (chapter title, section heading, etc.). */
	readonly label: string;
	/** Optional page number / locator string. */
	readonly pageNumber: string | null;
	/** Optional anchor / id from the source TOC. */
	readonly anchor: string | null;
	/**
	 * Stable id used as the walker substrate's `review_step.stepRef`.
	 * Hash of `(referenceId, entryIndex, label)` so a TOC re-extract that
	 * preserves order keeps the same step refs for prior recordings.
	 */
	readonly entryRef: string;
}

export interface TocParseResult {
	readonly entries: readonly TocEntry[];
	readonly errors: ReadonlyArray<{ readonly message: string; readonly path: string }>;
}

/**
 * Parse a verbatim jsonb blob into a flat TOC entry list. Always returns a
 * result (never throws) -- malformed shapes show up as zero entries plus an
 * error message the page can surface.
 */
export function parseToc(referenceId: string, verbatim: unknown): TocParseResult {
	if (verbatim === null || verbatim === undefined) {
		return { entries: [], errors: [] };
	}
	if (typeof verbatim !== 'object' || Array.isArray(verbatim)) {
		return {
			entries: [],
			errors: [{ message: 'verbatim is not an object', path: '$' }],
		};
	}
	const obj = verbatim as Record<string, unknown>;
	// Try each accepted shape in order; first hit wins.
	const tocCandidate = obj.toc;
	if (Array.isArray(tocCandidate)) {
		return flattenList(referenceId, tocCandidate, '$.toc');
	}
	if (obj.kind === 'toc') {
		const items = obj.items;
		if (Array.isArray(items)) {
			return flattenList(referenceId, items, '$.items');
		}
		return { entries: [], errors: [{ message: 'kind=toc but items is not an array', path: '$.items' }] };
	}
	const legacy = obj.tableOfContents;
	if (Array.isArray(legacy)) {
		return flattenList(referenceId, legacy, '$.tableOfContents');
	}
	if (legacy !== null && typeof legacy === 'object' && !Array.isArray(legacy)) {
		const entries = (legacy as Record<string, unknown>).entries;
		if (Array.isArray(entries)) {
			return flattenList(referenceId, entries, '$.tableOfContents.entries');
		}
	}
	return {
		entries: [],
		errors: [
			{ message: 'no recognised TOC shape (expected toc[], kind=toc+items[], or tableOfContents[])', path: '$' },
		],
	};
}

/**
 * Flatten a TOC list (potentially nested) into a flat entry array. Each
 * entry is given a 1-based `entryIndex` across the flattened result so
 * recordings stay stable when nested children reorder within a parent
 * (the parent + its children all have unique entryIndex positions).
 */
function flattenList(referenceId: string, list: readonly unknown[], path: string): TocParseResult {
	const entries: TocEntry[] = [];
	const errors: { message: string; path: string }[] = [];
	let counter = 0;
	const visit = (items: readonly unknown[], localPath: string): void => {
		for (let i = 0; i < items.length; i++) {
			const raw = items[i];
			const itemPath = `${localPath}[${i}]`;
			if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
				if (typeof raw === 'string' && raw.trim() !== '') {
					counter += 1;
					const label = raw.trim();
					entries.push({
						entryIndex: counter,
						label,
						pageNumber: null,
						anchor: null,
						entryRef: hashEntryRef(referenceId, counter, label),
					});
					continue;
				}
				errors.push({ message: 'TOC entry is not an object or string', path: itemPath });
				continue;
			}
			const obj = raw as Record<string, unknown>;
			const label = pickString(obj, ['label', 'title', 'name', 'text']);
			if (label === null) {
				errors.push({ message: 'TOC entry has no label / title / name / text', path: itemPath });
				continue;
			}
			counter += 1;
			const pageNumber = pickString(obj, ['page', 'pageNumber', 'pageNum', 'pn']);
			const anchor = pickString(obj, ['anchor', 'id', 'href']);
			entries.push({
				entryIndex: counter,
				label,
				pageNumber,
				anchor,
				entryRef: hashEntryRef(referenceId, counter, label),
			});
			const children = obj.children ?? obj.entries ?? obj.subsections;
			if (Array.isArray(children)) {
				visit(children, `${itemPath}.children`);
			}
		}
	};
	visit(list, path);
	return { entries, errors };
}

function pickString(obj: Record<string, unknown>, keys: readonly string[]): string | null {
	for (const k of keys) {
		const v = obj[k];
		if (typeof v === 'string' && v.trim() !== '') return v.trim();
	}
	return null;
}

function hashEntryRef(referenceId: string, index: number, label: string): string {
	const hash = createHash('sha1');
	hash.update(referenceId);
	hash.update('|');
	hash.update(String(index));
	hash.update('|');
	hash.update(label);
	return hash.digest('hex').slice(0, 16);
}
