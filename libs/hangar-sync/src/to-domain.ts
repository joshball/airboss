/**
 * Adapters from DB rows (`hangar.reference`, `hangar.source`) to the
 * authoritative domain shapes (`Reference`, `Source`) the TOML codec
 * speaks. Keeps the sync service free of row-shape leakage.
 *
 * These are pure transforms -- they don't touch the DB or the filesystem.
 */

import type { Reference, ReferenceTags, Source, SourceCitation, VerbatimBlock } from '@ab/aviation';
import type { HangarReferenceRow, HangarSourceRow } from '@ab/db';

function toCitations(raw: readonly Record<string, unknown>[]): readonly SourceCitation[] {
	return raw.map((entry) => {
		const sourceId = typeof entry.sourceId === 'string' ? entry.sourceId : '';
		const locatorRaw = (entry.locator ?? {}) as Record<string, unknown>;
		const locator: Record<string, string | number> = {};
		for (const [k, v] of Object.entries(locatorRaw)) {
			if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) {
				locator[k] = v;
			}
		}
		const citation: SourceCitation = { sourceId, locator };
		if (typeof entry.url === 'string') return { ...citation, url: entry.url };
		return citation;
	});
}

function toVerbatim(raw: Record<string, unknown> | null | undefined): VerbatimBlock | undefined {
	if (!raw) return undefined;
	const text = typeof raw.text === 'string' ? raw.text : '';
	const sourceVersion = typeof raw.sourceVersion === 'string' ? raw.sourceVersion : '';
	const extractedAt = typeof raw.extractedAt === 'string' ? raw.extractedAt : '';
	return { text, sourceVersion, extractedAt };
}

/** Convert one `hangar.reference` row to the domain `Reference`. */
export function rowToReference(row: HangarReferenceRow): Reference {
	const tags = row.tags as unknown as ReferenceTags;
	const reference: Reference = {
		id: row.id,
		displayName: row.displayName,
		aliases: [...row.aliases],
		paraphrase: row.paraphrase,
		tags,
		sources: toCitations(row.sources),
		related: [...row.related],
	};
	if (row.author !== null && row.author !== undefined) {
		(reference as unknown as Record<string, unknown>).author = row.author;
	}
	if (row.reviewedAt !== null && row.reviewedAt !== undefined) {
		(reference as unknown as Record<string, unknown>).reviewedAt = row.reviewedAt;
	}
	const verbatim = toVerbatim(row.verbatim);
	if (verbatim !== undefined) {
		(reference as unknown as Record<string, unknown>).verbatim = verbatim;
	}
	return reference;
}

/** Convert one `hangar.source` row to the domain `Source`. */
export function rowToSource(row: HangarSourceRow): Source {
	return {
		id: row.id,
		type: row.type as Source['type'],
		title: row.title,
		version: row.version,
		downloadedAt: row.downloadedAt,
		format: row.format as Source['format'],
		path: row.path,
		url: row.url,
		checksum: row.checksum,
	};
}
