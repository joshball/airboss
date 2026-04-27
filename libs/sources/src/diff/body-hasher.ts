/**
 * Phase 5 -- body hasher.
 *
 * Reads the per-edition derivative `.md` for a section, normalizes the body
 * (NFC, LF line endings, trim, collapse newline runs) via the same routine
 * the validator + ingestion pipeline uses, and returns a SHA-256 hex digest.
 *
 * Source of truth: ADR 019 §5 (normalization rules); reuses
 * `libs/sources/src/regs/normalizer.ts`'s `normalizeText`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { __editions_internal__ } from '../registry/editions.ts';
import { stripPin } from '../registry/query.ts';
import { sha256 } from '../regs/cache.ts';
import { normalizeText } from '../regs/normalizer.ts';
import type { Edition, EditionId, SourceId } from '../types.ts';

export interface HashOptions {
	/** Derivative tree root (typically `<repo>/regulations`). */
	readonly outRoot: string;
}

const _hashCache = new Map<string, string>();

/** Test-only. Drops the in-process hash cache so each test starts fresh. */
export function clearBodyHashCache(): void {
	_hashCache.clear();
}

/**
 * Hash the normalized body for `(id, edition)`. Returns `null` when the
 * derivative file is missing on disk.
 */
export function hashEditionBody(id: SourceId, edition: EditionId, opts: HashOptions): string | null {
	const cacheKey = `${id}::${edition}::${opts.outRoot}`;
	const cached = _hashCache.get(cacheKey);
	if (cached !== undefined) return cached;

	const path = derivativePathFor(id, edition, opts.outRoot);
	if (path === null || !existsSync(path)) return null;

	const raw = readFileSync(path, 'utf-8');
	const body = stripHeading(raw);
	const normalized = normalizeText(body);
	const digest = sha256(normalized);
	_hashCache.set(cacheKey, digest);
	return digest;
}

/**
 * Read the normalized body string for `(id, edition)`. Returns `null` when
 * the file is missing. Used by the diff orchestrator's snippet builder.
 */
export function readNormalizedBody(id: SourceId, edition: EditionId, opts: HashOptions): string | null {
	const path = derivativePathFor(id, edition, opts.outRoot);
	if (path === null || !existsSync(path)) return null;
	const raw = readFileSync(path, 'utf-8');
	return normalizeText(stripHeading(raw));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip the leading `# <heading>` line. The heading is canonical (built from
 * the section identifier) and not part of the substantive body; leaving it
 * in would pollute the hash with edition-equal but identifier-different rows.
 *
 * In practice the regs derivative writer always emits `# <canonical_short>
 * <canonical_title>` as the first line. When the input has no leading `#`
 * line, the input is returned unchanged.
 */
function stripHeading(input: string): string {
	const idx = input.indexOf('\n');
	if (idx < 0) return input;
	const first = input.slice(0, idx);
	if (!first.startsWith('# ')) return input;
	return input.slice(idx + 1);
}

function derivativePathFor(id: SourceId, edition: EditionId, outRoot: string): string | null {
	const stripped = stripPin(id) as SourceId;
	const editions = __editions_internal__.getActiveTable().get(stripped) ?? [];
	const editionRecord = editions.find((e: Edition) => e.id === edition);
	if (editionRecord === undefined) return null;

	const title = titleNumberFromSourceId(stripped);
	if (title === null) return null;
	const date = toIsoDate(editionRecord.published_date);
	const editionDir = join(outRoot, `cfr-${title}`, date);

	const segs = stripped.replace('airboss-ref:regs/', '').split('/');
	if (segs.length < 2) return null;
	const part = segs[1] ?? '';
	const last = segs[segs.length - 1] ?? '';

	if (segs.length === 2) {
		return join(editionDir, part, 'index.md');
	}
	if (last.startsWith('subpart-')) {
		return join(editionDir, part, `${last}.md`);
	}
	const section = segs[2] ?? '';
	return join(editionDir, part, `${part}-${section}.md`);
}

function titleNumberFromSourceId(id: SourceId): '14' | '49' | null {
	const segs = id.replace('airboss-ref:regs/', '').split('/');
	const titleSlug = segs[0] ?? '';
	if (titleSlug === 'cfr-14') return '14';
	if (titleSlug === 'cfr-49') return '49';
	return null;
}

function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
