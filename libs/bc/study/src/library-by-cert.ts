/**
 * Library-by-cert BC -- the cert-spine view over `study.reference` rows.
 *
 * Walks the credential prereq DAG (ADR 016) at render time to derive the
 * "carryover" sidebar instead of storing it as a column. One source of
 * truth: the DAG. Per the Wave 3 spec ratification (2026-05-01).
 *
 * See [docs/work-packages/library-by-cert/spec.md] for the model + the
 * ratification block that pinned the carryover-derivation approach.
 */

import { CERT_APPLICABILITIES, CERT_APPLICABILITY_VALUES, type CertApplicability } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { editions as editionsTable } from '@ab/sources/server';
import { createLogger } from '@ab/utils';
import { and, arrayContains, asc, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { CredentialNotFoundError, getCertsCoveredBy, getCredentialBySlug } from './credentials';
import { notSupersededInRegistry, sourceIdSqlForAliasedReference } from './edition-predicates.ts';
import { type ReferenceRow, reference } from './schema';

const log = createLogger('study:library-by-cert');

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Carryover bucket -- references owned by a prerequisite cert that still
 * apply to a later cert. Surfaced as a per-prereq group on the cert page.
 */
export interface CarryoverGroup {
	/** Cert this carryover comes from -- one of `CERT_APPLICABILITIES`. */
	fromCert: CertApplicability;
	/** Display label, e.g. `Carried over from Private`. */
	label: string;
	/** Reference rows whose `primary_cert` is this `fromCert`. */
	refs: ReferenceRow[];
}

/**
 * The full per-cert reference bundle: rows the cert primarily owns plus
 * any inherited via the prereq DAG.
 */
export interface CertReferenceBundle {
	/** References whose `primary_cert` equals the requested cert. */
	primary: ReferenceRow[];
	/** Carryover groups -- references owned by this cert's transitive prereqs. */
	carryover: CarryoverGroup[];
}

/**
 * Bridge a `CertApplicability` value (`private`, `cfi`, ...) to its
 * credential slug. Today the slug equals the applicability value for every
 * top-level pilot cert (see `course/credentials/<slug>.yaml`); class
 * ratings / endorsements (`single-engine-land`, `tailwheel`) carry their
 * own slugs and are not reachable from a `CertApplicability` value.
 *
 * The `all` placeholder applicability is data-only (cert-agnostic
 * reference rows that should not be the page's focus); it never resolves
 * to a credential row.
 */
function certApplicabilityToCredentialSlug(cert: CertApplicability): string | null {
	if (cert === CERT_APPLICABILITIES.ALL) return null;
	return cert;
}

/**
 * Given a cert applicability, return:
 *   - `primary`: every active reference row whose `primary_cert` equals
 *     `cert`.
 *   - `carryover`: for each transitive prereq cert (walked via the
 *     credential DAG with `getCertsCoveredBy`), the references whose
 *     `primary_cert` equals that prereq cert. The page's own cert is
 *     excluded from the carryover list. Each prereq cert that has no
 *     refs is dropped from the result.
 *
 * If the cert applicability has no matching credential row (`all`, or a
 * future enum value not yet wired into the DAG), returns `primary` only.
 *
 * If `cert` resolves to a credential slug but the credential row is
 * missing in the DB (data-integrity gap), logs a warning and returns
 * primary-only -- a missing prereq DAG node is a seed bug, not a runtime
 * exception that should 500 the library page.
 */
export async function getReferencesForCertWithCarryover(
	cert: CertApplicability,
	db: Db = defaultDb,
): Promise<CertReferenceBundle> {
	const primary = await listPrimaryReferencesForCert(cert, db);

	const slug = certApplicabilityToCredentialSlug(cert);
	if (slug === null) return { primary, carryover: [] };

	let credentialId: string;
	try {
		const cred = await getCredentialBySlug(slug, db);
		credentialId = cred.id;
	} catch (err) {
		if (err instanceof CredentialNotFoundError) {
			log.warn('cert has no credential row; returning primary refs only', {
				metadata: { cert, slug, hint: 'seed the credential DAG to enable carryover' },
			});
			return { primary, carryover: [] };
		}
		throw err;
	}

	const coveredSlugs = await getCertsCoveredBy(credentialId, {}, db);
	// Exclude the page's own cert from the carryover view; that's the
	// `primary` list, not a carryover.
	const prereqCertSlugs = coveredSlugs.filter((s) => s !== slug);
	const certApplicabilityValues = new Set<string>(CERT_APPLICABILITY_VALUES);
	const prereqCerts = prereqCertSlugs.filter((s) => certApplicabilityValues.has(s)) as CertApplicability[];

	if (prereqCerts.length === 0) return { primary, carryover: [] };

	const refsByCert = await listReferencesByPrimaryCerts(prereqCerts, db);

	const carryover: CarryoverGroup[] = [];
	// Sort carryover groups by the prereq order from `getCertsCoveredBy` so
	// upstream certs (Student, Sport, Private) render before downstream ones.
	const ordered = orderCarryoverCerts(prereqCerts);
	for (const fromCert of ordered) {
		const refs = refsByCert.get(fromCert) ?? [];
		if (refs.length === 0) continue;
		carryover.push({
			fromCert,
			label: `Carried over from ${certDisplayName(fromCert)}`,
			refs,
		});
	}

	return { primary, carryover };
}

/**
 * Stable display order for carryover groups. Mirrors the cert progression
 * a learner walks (Student -> Sport -> Recreational -> Private -> ...).
 */
const CERT_DISPLAY_ORDER: readonly CertApplicability[] = [
	CERT_APPLICABILITIES.STUDENT,
	CERT_APPLICABILITIES.SPORT,
	CERT_APPLICABILITIES.RECREATIONAL,
	CERT_APPLICABILITIES.PRIVATE,
	CERT_APPLICABILITIES.INSTRUMENT,
	CERT_APPLICABILITIES.COMMERCIAL,
	CERT_APPLICABILITIES.CFI,
	CERT_APPLICABILITIES.CFII,
	CERT_APPLICABILITIES.ATP,
	CERT_APPLICABILITIES.ALL,
];

function orderCarryoverCerts(certs: readonly CertApplicability[]): CertApplicability[] {
	const present = new Set<CertApplicability>(certs);
	return CERT_DISPLAY_ORDER.filter((c) => present.has(c));
}

function certDisplayName(cert: CertApplicability): string {
	switch (cert) {
		case CERT_APPLICABILITIES.STUDENT:
			return 'Student';
		case CERT_APPLICABILITIES.SPORT:
			return 'Sport';
		case CERT_APPLICABILITIES.RECREATIONAL:
			return 'Recreational';
		case CERT_APPLICABILITIES.PRIVATE:
			return 'Private';
		case CERT_APPLICABILITIES.INSTRUMENT:
			return 'Instrument';
		case CERT_APPLICABILITIES.COMMERCIAL:
			return 'Commercial';
		case CERT_APPLICABILITIES.CFI:
			return 'CFI';
		case CERT_APPLICABILITIES.CFII:
			return 'CFII';
		case CERT_APPLICABILITIES.ATP:
			return 'ATP';
		case CERT_APPLICABILITIES.ALL:
			return 'All';
	}
}

async function listPrimaryReferencesForCert(cert: CertApplicability, db: Db): Promise<ReferenceRow[]> {
	return db
		.select()
		.from(reference)
		.where(and(eq(reference.primaryCert, cert), notSupersededInRegistry()))
		.orderBy(asc(reference.documentSlug), asc(reference.edition));
}

/**
 * Bulk-fetch references whose `primary_cert` is in the given set, then
 * group by cert so the carryover loop can render each group. One round
 * trip rather than one per prereq cert.
 */
async function listReferencesByPrimaryCerts(
	certs: readonly CertApplicability[],
	db: Db,
): Promise<Map<CertApplicability, ReferenceRow[]>> {
	const out = new Map<CertApplicability, ReferenceRow[]>();
	if (certs.length === 0) return out;
	const rows = await db
		.select()
		.from(reference)
		.where(and(inArray(reference.primaryCert, certs as CertApplicability[]), notSupersededInRegistry()))
		.orderBy(asc(reference.documentSlug), asc(reference.edition));
	for (const row of rows) {
		if (row.primaryCert === null) continue;
		// Defensive narrow: the WHERE clause filtered to certs[], so this is
		// always one of the requested values.
		const key = row.primaryCert as CertApplicability;
		const list = out.get(key) ?? [];
		list.push(row);
		out.set(key, list);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Topic + landing helpers (referenced by the cross-cut + index routes)
// ---------------------------------------------------------------------------

/**
 * Active references whose `subjects` array contains the given aviation
 * topic. Newest editions first; superseded rows excluded.
 *
 * Implementation: pushes the membership check into Postgres via Drizzle's
 * `arrayContains`, which compiles to `subjects @> ARRAY[$topic]`. Combined
 * with the `reference_subjects_gin_idx` GIN index this is an inverted-index
 * lookup, not a sequential scan + JS filter. The previous implementation
 * loaded every active reference and ran `rows.filter(... .includes(topic))`
 * client-side; that path scaled linearly with the catalog size and was
 * called on every topic-spine page render.
 */
export async function listReferencesByTopic(topic: string, db: Db = defaultDb): Promise<ReferenceRow[]> {
	return db
		.select()
		.from(reference)
		.where(and(arrayContains(reference.subjects, [topic]), notSupersededInRegistry()))
		.orderBy(asc(reference.documentSlug), asc(reference.edition));
}

/**
 * Per-cert reference counts for the landing page's cert spine. Returns
 * one count per `CERT_APPLICABILITIES` value (zero when none assigned).
 */
export async function getReferenceCountsByCert(db: Db = defaultDb): Promise<Record<CertApplicability, number>> {
	const rows = await db.select({ primaryCert: reference.primaryCert }).from(reference).where(notSupersededInRegistry());
	const out = {} as Record<CertApplicability, number>;
	for (const value of CERT_APPLICABILITY_VALUES) out[value] = 0;
	for (const row of rows) {
		if (row.primaryCert === null) continue;
		const key = row.primaryCert as CertApplicability;
		if (out[key] !== undefined) out[key] += 1;
	}
	return out;
}

/**
 * Per-topic reference counts for the landing page's topic spine. Counts
 * each `subjects[]` membership independently (one ref tagged with two
 * topics increments both counters).
 *
 * Implementation: a single round-trip with `LATERAL unnest(subjects)` +
 * `GROUP BY` so the aggregation runs inside Postgres rather than pulling
 * every row's `subjects` array across the wire and summing in JS. Drizzle's
 * query builder cannot express `LATERAL unnest` of a column today, so this
 * routes through `db.execute(sql\`...\`)` per the project rule "Drizzle ORM
 * only, except where the SQL shape genuinely requires raw SQL." The shape
 * here (column-derived rowset that needs to participate in the FROM clause)
 * is one of those cases.
 *
 * Per ADR 026 the "active references only" predicate is a NOT EXISTS against
 * `sources_registry.editions` (no row with both source_id + edition_label
 * matching AND `retired_at IS NOT NULL`). The source_id concat mirrors
 * `sourceIdForReference`: handbook -> handbooks, cfr -> regs, otherwise the
 * kind itself.
 */
export async function getReferenceCountsByTopic(db: Db = defaultDb): Promise<Record<string, number>> {
	// `count(*)::int` so the row comes back as a JS number rather than the
	// `bigint`-as-string that Postgres' default count() yields. The same
	// `result as unknown as ReadonlyArray<...>` shape is used by
	// `getCredentialIdsCoveredBy` for its recursive CTE -- postgres-js's
	// `db.execute` returns the rowset directly as an iterable here.
	const aliasedSourceId = sourceIdSqlForAliasedReference(sql`r.kind`, sql`r.document_slug`);
	const result = await db.execute(sql`
		SELECT s.subject, count(*)::int AS n
		FROM ${reference} AS r,
		LATERAL unnest(r.subjects) AS s(subject)
		WHERE NOT EXISTS (
			SELECT 1 FROM ${editionsTable} AS e
			WHERE e.source_id = ${aliasedSourceId}
			  AND e.edition_label = r.edition
			  AND e.retired_at IS NOT NULL
		)
		GROUP BY s.subject
	`);
	const rows = result as unknown as ReadonlyArray<{ subject: string; n: number }>;
	const out: Record<string, number> = {};
	for (const row of rows) out[row.subject] = row.n;
	return out;
}
