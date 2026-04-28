/**
 * Hangar registry read/write helpers.
 *
 * Thin wrappers over the `hangar.reference` + `hangar.source` tables.
 * The form actions under `/glossary` and `/glossary/sources` call these;
 * tests can inject a separate db handle.
 *
 * Every write increments `rev` (optimistic lock) and flips `dirty = true`
 * so the next `/sync-to-disk` job captures the change.
 */

import { AUDIT_OPS, type AuditOp, auditWrite } from '@ab/audit';
import {
	AUDIT_TARGETS,
	type AviationTopic,
	type CertApplicability,
	type FlightRules,
	type KnowledgeKind,
	type ReferencePhaseOfFlight,
	type ReferenceSourceType,
} from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { and, asc, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type HangarReferenceRow, type HangarSourceRow, hangarReference, hangarSource } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// -------- shared shapes --------

export interface ReferenceTagsInput {
	sourceType: ReferenceSourceType;
	aviationTopic: readonly AviationTopic[];
	flightRules: FlightRules;
	knowledgeKind: KnowledgeKind;
	phaseOfFlight?: readonly ReferencePhaseOfFlight[];
	certApplicability?: readonly CertApplicability[];
	keywords?: readonly string[];
}

export interface SourceCitationInput {
	sourceId: string;
	locator: Readonly<Record<string, string | number>>;
	url?: string;
}

export interface ReferenceInput {
	id: string;
	displayName: string;
	aliases: readonly string[];
	paraphrase: string;
	tags: ReferenceTagsInput;
	sources: readonly SourceCitationInput[];
	related: readonly string[];
	author?: string | null;
	reviewedAt?: string | null;
}

export interface SourceInput {
	id: string;
	type: ReferenceSourceType;
	title: string;
	version: string;
	url: string;
	path: string;
	format: string;
	checksum: string;
	downloadedAt: string;
	sizeBytes?: number | null;
	locatorShape?: Record<string, unknown> | null;
}

export class RevConflictError extends Error {
	readonly code = 'REV_CONFLICT';
	readonly currentRev: number;
	constructor(currentRev: number, message: string) {
		super(message);
		this.name = 'RevConflictError';
		this.currentRev = currentRev;
	}
}

export class NotFoundError extends Error {
	readonly code = 'NOT_FOUND';
	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

// -------- references --------

export interface ListReferencesOptions {
	search?: string;
	sourceType?: ReferenceSourceType;
	knowledgeKind?: KnowledgeKind;
	flightRules?: FlightRules;
	dirtyOnly?: boolean;
	limit: number;
	offset: number;
}

export interface ListReferencesResult {
	rows: readonly HangarReferenceRow[];
	total: number;
	dirtyCount: number;
}

/** Build the shared WHERE fragment for reference list + count. */
function referenceWhere(options: Omit<ListReferencesOptions, 'limit' | 'offset'>) {
	const conditions = [isNull(hangarReference.deletedAt)];
	if (options.dirtyOnly) conditions.push(eq(hangarReference.dirty, true));
	if (options.sourceType) conditions.push(sql`${hangarReference.tags}->>'sourceType' = ${options.sourceType}`);
	if (options.knowledgeKind) conditions.push(sql`${hangarReference.tags}->>'knowledgeKind' = ${options.knowledgeKind}`);
	if (options.flightRules) conditions.push(sql`${hangarReference.tags}->>'flightRules' = ${options.flightRules}`);
	const search = options.search?.trim();
	if (search) {
		const pattern = `%${escapeLikePattern(search)}%`;
		const searchExpr = or(
			ilike(hangarReference.id, pattern),
			ilike(hangarReference.displayName, pattern),
			ilike(hangarReference.paraphrase, pattern),
		);
		if (searchExpr) conditions.push(searchExpr);
	}
	return and(...conditions);
}

export async function listReferences(
	options: ListReferencesOptions,
	db: Db = defaultDb,
): Promise<ListReferencesResult> {
	const where = referenceWhere(options);
	const [rows, totalRows, dirtyRows] = await Promise.all([
		db
			.select()
			.from(hangarReference)
			.where(where)
			.orderBy(asc(hangarReference.id))
			.limit(options.limit)
			.offset(options.offset),
		db.select({ c: count() }).from(hangarReference).where(where),
		db
			.select({ c: count() })
			.from(hangarReference)
			.where(and(isNull(hangarReference.deletedAt), eq(hangarReference.dirty, true))),
	]);
	return {
		rows,
		total: Number(totalRows[0]?.c ?? 0),
		dirtyCount: Number(dirtyRows[0]?.c ?? 0),
	};
}

export async function getReference(id: string, db: Db = defaultDb): Promise<HangarReferenceRow | undefined> {
	const [row] = await db.select().from(hangarReference).where(eq(hangarReference.id, id)).limit(1);
	return row;
}

/** Subset of the reference row used by the study reference detail page. */
export interface ReferenceSummaryRow {
	id: string;
	displayName: string;
	paraphrase: string;
	tags: Record<string, unknown>;
}

/**
 * Slim projection used by `/references/[id]` in `apps/study`. Fetches the
 * presentational fields only (no audit columns, no soft-delete filter) so
 * the BC owns the SELECT shape and the route stays free of Drizzle.
 */
export async function getReferenceSummary(id: string, db: Db = defaultDb): Promise<ReferenceSummaryRow | undefined> {
	const [row] = await db
		.select({
			id: hangarReference.id,
			displayName: hangarReference.displayName,
			paraphrase: hangarReference.paraphrase,
			tags: hangarReference.tags,
		})
		.from(hangarReference)
		.where(eq(hangarReference.id, id))
		.limit(1);
	return row;
}

function tagsToRow(tags: ReferenceTagsInput): Record<string, unknown> {
	const out: Record<string, unknown> = {
		sourceType: tags.sourceType,
		aviationTopic: [...tags.aviationTopic],
		flightRules: tags.flightRules,
		knowledgeKind: tags.knowledgeKind,
	};
	if (tags.phaseOfFlight && tags.phaseOfFlight.length > 0) out.phaseOfFlight = [...tags.phaseOfFlight];
	if (tags.certApplicability && tags.certApplicability.length > 0) out.certApplicability = [...tags.certApplicability];
	if (tags.keywords && tags.keywords.length > 0) out.keywords = [...tags.keywords];
	return out;
}

function citationsToRow(sources: readonly SourceCitationInput[]): readonly Record<string, unknown>[] {
	return sources.map((c) => {
		const out: Record<string, unknown> = {
			sourceId: c.sourceId,
			locator: { ...c.locator },
		};
		if (c.url) out.url = c.url;
		return out;
	});
}

export async function createReference(
	input: ReferenceInput,
	actorId: string,
	db: Db = defaultDb,
): Promise<HangarReferenceRow> {
	const [row] = await db
		.insert(hangarReference)
		.values({
			id: input.id,
			rev: 1,
			displayName: input.displayName,
			aliases: input.aliases,
			paraphrase: input.paraphrase,
			tags: tagsToRow(input.tags),
			sources: citationsToRow(input.sources),
			related: input.related,
			author: input.author ?? null,
			reviewedAt: input.reviewedAt ?? null,
			dirty: true,
			updatedBy: actorId,
		})
		.returning();
	await writeAudit(AUDIT_OPS.CREATE, AUDIT_TARGETS.HANGAR_REFERENCE, row.id, actorId, null, row, db);
	return row;
}

export async function updateReference(
	input: ReferenceInput & { rev: number },
	actorId: string,
	db: Db = defaultDb,
): Promise<HangarReferenceRow> {
	return db.transaction(async (tx) => {
		const existing = await getReference(input.id, tx);
		if (!existing) throw new NotFoundError(`reference '${input.id}' not found`);
		if (existing.deletedAt) throw new NotFoundError(`reference '${input.id}' is deleted`);
		if (existing.rev !== input.rev) {
			throw new RevConflictError(
				existing.rev,
				`reference '${input.id}' is at rev ${existing.rev}; submitted rev ${input.rev} is stale`,
			);
		}
		const [row] = await tx
			.update(hangarReference)
			.set({
				rev: existing.rev + 1,
				displayName: input.displayName,
				aliases: input.aliases,
				paraphrase: input.paraphrase,
				tags: tagsToRow(input.tags),
				sources: citationsToRow(input.sources),
				related: input.related,
				author: input.author ?? null,
				reviewedAt: input.reviewedAt ?? null,
				dirty: true,
				updatedBy: actorId,
				updatedAt: new Date(),
			})
			.where(and(eq(hangarReference.id, input.id), eq(hangarReference.rev, input.rev)))
			.returning();
		if (!row) {
			// Race: another writer bumped rev between our read and our write.
			const [refreshed] = await tx
				.select({ rev: hangarReference.rev })
				.from(hangarReference)
				.where(eq(hangarReference.id, input.id))
				.limit(1);
			throw new RevConflictError(refreshed?.rev ?? existing.rev + 1, `reference '${input.id}' rev advanced mid-write`);
		}
		await writeAudit(AUDIT_OPS.UPDATE, AUDIT_TARGETS.HANGAR_REFERENCE, row.id, actorId, existing, row, tx);
		return row;
	});
}

export async function softDeleteReference(
	input: { id: string; rev: number },
	actorId: string,
	db: Db = defaultDb,
): Promise<HangarReferenceRow> {
	return db.transaction(async (tx) => {
		const existing = await getReference(input.id, tx);
		if (!existing) throw new NotFoundError(`reference '${input.id}' not found`);
		if (existing.deletedAt) return existing;
		if (existing.rev !== input.rev) {
			throw new RevConflictError(
				existing.rev,
				`reference '${input.id}' is at rev ${existing.rev}; submitted rev ${input.rev} is stale`,
			);
		}
		const [row] = await tx
			.update(hangarReference)
			.set({
				rev: existing.rev + 1,
				dirty: true,
				deletedAt: new Date(),
				updatedBy: actorId,
				updatedAt: new Date(),
			})
			.where(and(eq(hangarReference.id, input.id), eq(hangarReference.rev, input.rev)))
			.returning();
		if (!row) {
			throw new RevConflictError(existing.rev + 1, `reference '${input.id}' rev advanced mid-delete`);
		}
		await writeAudit(AUDIT_OPS.DELETE, AUDIT_TARGETS.HANGAR_REFERENCE, row.id, actorId, existing, row, tx);
		return row;
	});
}

// -------- sources --------

export interface ListSourcesOptions {
	search?: string;
	type?: ReferenceSourceType;
	format?: string;
	dirtyOnly?: boolean;
	limit: number;
	offset: number;
}

export interface ListSourcesResult {
	rows: readonly HangarSourceRow[];
	total: number;
	dirtyCount: number;
}

function sourceWhere(options: Omit<ListSourcesOptions, 'limit' | 'offset'>) {
	const conditions = [isNull(hangarSource.deletedAt)];
	if (options.dirtyOnly) conditions.push(eq(hangarSource.dirty, true));
	if (options.type) conditions.push(eq(hangarSource.type, options.type));
	if (options.format) conditions.push(eq(hangarSource.format, options.format));
	const search = options.search?.trim();
	if (search) {
		const pattern = `%${escapeLikePattern(search)}%`;
		const searchExpr = or(
			ilike(hangarSource.id, pattern),
			ilike(hangarSource.title, pattern),
			ilike(hangarSource.url, pattern),
		);
		if (searchExpr) conditions.push(searchExpr);
	}
	return and(...conditions);
}

export async function listSources(options: ListSourcesOptions, db: Db = defaultDb): Promise<ListSourcesResult> {
	const where = sourceWhere(options);
	const [rows, totalRows, dirtyRows] = await Promise.all([
		db
			.select()
			.from(hangarSource)
			.where(where)
			.orderBy(asc(hangarSource.id))
			.limit(options.limit)
			.offset(options.offset),
		db.select({ c: count() }).from(hangarSource).where(where),
		db
			.select({ c: count() })
			.from(hangarSource)
			.where(and(isNull(hangarSource.deletedAt), eq(hangarSource.dirty, true))),
	]);
	return {
		rows,
		total: Number(totalRows[0]?.c ?? 0),
		dirtyCount: Number(dirtyRows[0]?.c ?? 0),
	};
}

export async function getSource(id: string, db: Db = defaultDb): Promise<HangarSourceRow | undefined> {
	const [row] = await db.select().from(hangarSource).where(eq(hangarSource.id, id)).limit(1);
	return row;
}

export async function createSource(input: SourceInput, actorId: string, db: Db = defaultDb): Promise<HangarSourceRow> {
	const [row] = await db
		.insert(hangarSource)
		.values({
			id: input.id,
			rev: 1,
			type: input.type,
			title: input.title,
			version: input.version,
			url: input.url,
			path: input.path,
			format: input.format,
			checksum: input.checksum,
			downloadedAt: input.downloadedAt,
			sizeBytes: input.sizeBytes ?? null,
			locatorShape: input.locatorShape ?? null,
			dirty: true,
			updatedBy: actorId,
		})
		.returning();
	await writeAudit(AUDIT_OPS.CREATE, AUDIT_TARGETS.HANGAR_SOURCE, row.id, actorId, null, row, db);
	return row;
}

export async function updateSource(
	input: SourceInput & { rev: number },
	actorId: string,
	db: Db = defaultDb,
): Promise<HangarSourceRow> {
	return db.transaction(async (tx) => {
		const existing = await getSource(input.id, tx);
		if (!existing) throw new NotFoundError(`source '${input.id}' not found`);
		if (existing.deletedAt) throw new NotFoundError(`source '${input.id}' is deleted`);
		if (existing.rev !== input.rev) {
			throw new RevConflictError(
				existing.rev,
				`source '${input.id}' is at rev ${existing.rev}; submitted rev ${input.rev} is stale`,
			);
		}
		const [row] = await tx
			.update(hangarSource)
			.set({
				rev: existing.rev + 1,
				type: input.type,
				title: input.title,
				version: input.version,
				url: input.url,
				path: input.path,
				format: input.format,
				checksum: input.checksum,
				downloadedAt: input.downloadedAt,
				sizeBytes: input.sizeBytes ?? null,
				locatorShape: input.locatorShape ?? null,
				dirty: true,
				updatedBy: actorId,
				updatedAt: new Date(),
			})
			.where(and(eq(hangarSource.id, input.id), eq(hangarSource.rev, input.rev)))
			.returning();
		if (!row) {
			const [refreshed] = await tx
				.select({ rev: hangarSource.rev })
				.from(hangarSource)
				.where(eq(hangarSource.id, input.id))
				.limit(1);
			throw new RevConflictError(refreshed?.rev ?? existing.rev + 1, `source '${input.id}' rev advanced mid-write`);
		}
		await writeAudit(AUDIT_OPS.UPDATE, AUDIT_TARGETS.HANGAR_SOURCE, row.id, actorId, existing, row, tx);
		return row;
	});
}

export async function softDeleteSource(
	input: { id: string; rev: number },
	actorId: string,
	db: Db = defaultDb,
): Promise<HangarSourceRow> {
	return db.transaction(async (tx) => {
		const existing = await getSource(input.id, tx);
		if (!existing) throw new NotFoundError(`source '${input.id}' not found`);
		if (existing.deletedAt) return existing;
		if (existing.rev !== input.rev) {
			throw new RevConflictError(
				existing.rev,
				`source '${input.id}' is at rev ${existing.rev}; submitted rev ${input.rev} is stale`,
			);
		}
		const [row] = await tx
			.update(hangarSource)
			.set({
				rev: existing.rev + 1,
				dirty: true,
				deletedAt: new Date(),
				updatedBy: actorId,
				updatedAt: new Date(),
			})
			.where(and(eq(hangarSource.id, input.id), eq(hangarSource.rev, input.rev)))
			.returning();
		if (!row) {
			throw new RevConflictError(existing.rev + 1, `source '${input.id}' rev advanced mid-delete`);
		}
		await writeAudit(AUDIT_OPS.DELETE, AUDIT_TARGETS.HANGAR_SOURCE, row.id, actorId, existing, row, tx);
		return row;
	});
}

// -------- internals --------

async function writeAudit(
	op: AuditOp,
	targetType: string,
	targetId: string,
	actorId: string,
	before: unknown,
	after: unknown,
	db: Db,
): Promise<void> {
	await auditWrite(
		{
			actorId,
			op,
			targetType,
			targetId,
			before: before ?? null,
			after: after ?? null,
		},
		db,
	);
}

// -------- sorting helpers (exported for tests) --------

export const referenceDescSortByUpdated = desc(hangarReference.updatedAt);
export const sourceDescSortByUpdated = desc(hangarSource.updatedAt);
