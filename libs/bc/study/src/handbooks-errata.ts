/**
 * Bounded-context functions for the `handbook_section_errata` table.
 *
 * The reader's amendment panel calls {@link listErrataForSection} on
 * every section page load. The apply pipeline (Python) hands us patch
 * rows via `bun run sources extract handbooks <doc> --apply-errata <id>`;
 * the seed handler reads per-section errata notes and inserts via
 * {@link insertErrataRows} inside one transaction.
 *
 * See [ADR 020](../../../../docs/decisions/020-handbook-edition-and-amendment-policy.md)
 * for the policy and `docs/work-packages/apply-errata-and-afh-mosaic/` for
 * the parser layout taxonomy.
 */

import {
	HANDBOOK_ERRATA_PATCH_KIND_VALUES,
	HANDBOOK_SECTION_ERRATA_ID_PREFIX,
	type HandbookErrataPatchKind,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createId } from '@ab/utils';
import { desc, eq, sql } from 'drizzle-orm';
import { handbookSectionErrata } from './schema';

type Database = typeof defaultDb;

/** A row read from `study.handbook_section_errata`. */
export type HandbookSectionErrataRow = typeof handbookSectionErrata.$inferSelect;

/**
 * Insert payload (id and timestamps default-fill via the table). The
 * apply pipeline builds these from parsed Python `ErrataPatch` records
 * plus the resolved section id and errata config.
 */
export type ErrataInsert = {
	sectionId: string;
	errataId: string;
	sourceUrl: string;
	publishedAt: string;
	patchKind: HandbookErrataPatchKind;
	targetAnchor: string | null;
	targetPage: string;
	originalText: string | null;
	replacementText: string;
};

/** Display-shaped row for the reader's amendment panel. */
export type ErrataDisplay = {
	id: string;
	errataId: string;
	publishedAt: string;
	appliedAt: string;
	sourceUrl: string;
	patchKind: HandbookErrataPatchKind;
	targetAnchor: string | null;
	targetPage: string;
	originalText: string | null;
	replacementText: string;
};

export class ErrataValidationError extends Error {
	constructor(
		message: string,
		public readonly field: string,
	) {
		super(message);
		this.name = 'ErrataValidationError';
	}
}

/** Generate a `hbe_<ULID>` id. Exported for tests + the apply pipeline. */
export function newErrataId(): string {
	return createId(HANDBOOK_SECTION_ERRATA_ID_PREFIX);
}

/**
 * Validate an insert row against the spec rules. Mirrors the DB CHECK
 * constraints so the BC catches problems before they hit Postgres.
 */
export function validateErrataInsert(row: ErrataInsert): void {
	if (!HANDBOOK_ERRATA_PATCH_KIND_VALUES.includes(row.patchKind)) {
		throw new ErrataValidationError(
			`Unknown patch_kind '${row.patchKind}'. Allowed: ${HANDBOOK_ERRATA_PATCH_KIND_VALUES.join(', ')}.`,
			'patchKind',
		);
	}
	if (row.patchKind === 'add_subsection' && row.originalText !== null) {
		throw new ErrataValidationError('add_subsection patches must have originalText = null.', 'originalText');
	}
	if (!/^[0-9]+-[0-9]+$/.test(row.targetPage)) {
		throw new ErrataValidationError(
			`targetPage '${row.targetPage}' must match printed FAA <chapter>-<page> format.`,
			'targetPage',
		);
	}
	if (!row.replacementText.trim()) {
		throw new ErrataValidationError('replacementText must be non-empty.', 'replacementText');
	}
	if (!row.sourceUrl.startsWith('https://')) {
		throw new ErrataValidationError(`sourceUrl '${row.sourceUrl}' must be HTTPS.`, 'sourceUrl');
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(row.publishedAt)) {
		throw new ErrataValidationError(`publishedAt '${row.publishedAt}' must be ISO 8601 date.`, 'publishedAt');
	}
}

/**
 * List errata applied to a section, newest first. The reader's
 * AmendmentPanel renders one entry per row.
 */
export async function listErrataForSection(
	sectionId: string,
	db: Database = defaultDb,
): Promise<HandbookSectionErrataRow[]> {
	return db
		.select()
		.from(handbookSectionErrata)
		.where(eq(handbookSectionErrata.sectionId, sectionId))
		.orderBy(desc(handbookSectionErrata.appliedAt));
}

/**
 * Quick existence check used by list views to render the amendment
 * badge without joining the full row payload.
 */
export async function hasErrata(sectionId: string, db: Database = defaultDb): Promise<boolean> {
	const rows = await db
		.select({ id: handbookSectionErrata.id })
		.from(handbookSectionErrata)
		.where(eq(handbookSectionErrata.sectionId, sectionId))
		.limit(1);
	return rows.length > 0;
}

/**
 * Insert a batch of errata rows for one section. Idempotent: the
 * unique index on `(section_id, errata_id)` rejects double-applies and
 * the caller should pre-clean (use {@link deleteErrataByErratumId} before
 * a `--force` reapply). All inserts run inside the supplied database
 * client so the caller can wrap the entire apply in one transaction.
 */
export async function insertErrataRows(
	rows: ErrataInsert[],
	db: Database = defaultDb,
): Promise<HandbookSectionErrataRow[]> {
	if (rows.length === 0) return [];
	for (const row of rows) {
		validateErrataInsert(row);
	}
	const payload = rows.map((row) => ({
		id: newErrataId(),
		...row,
	}));
	return db.insert(handbookSectionErrata).values(payload).returning();
}

/**
 * Delete all rows for a given erratum across every section. The apply
 * pipeline runs this before `--force` reapplies the erratum.
 */
export async function deleteErrataByErratumId(errataId: string, db: Database = defaultDb): Promise<number> {
	const result = await db
		.delete(handbookSectionErrata)
		.where(eq(handbookSectionErrata.errataId, errataId))
		.returning({ id: handbookSectionErrata.id });
	return result.length;
}

/** Format a row for the reader's amendment panel. */
export function formatErrataForDisplay(row: HandbookSectionErrataRow): ErrataDisplay {
	return {
		id: row.id,
		errataId: row.errataId,
		publishedAt: row.publishedAt,
		appliedAt: row.appliedAt instanceof Date ? row.appliedAt.toISOString() : String(row.appliedAt),
		sourceUrl: row.sourceUrl,
		patchKind: row.patchKind as HandbookErrataPatchKind,
		targetAnchor: row.targetAnchor,
		targetPage: row.targetPage,
		originalText: row.originalText,
		replacementText: row.replacementText,
	};
}

/**
 * Aggregate count of patched sections per erratum id. The discovery
 * surface uses this to mark a discovered URL as `applied` once at least
 * one section was patched.
 */
export async function countSectionsByErratumId(errataId: string, db: Database = defaultDb): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(handbookSectionErrata)
		.where(eq(handbookSectionErrata.errataId, errataId));
	return rows[0]?.count ?? 0;
}
