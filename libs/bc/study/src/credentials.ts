/**
 * Credential BC -- the credential DAG and per-credential mastery rollup.
 *
 * Read paths:
 *   - listCredentials                                index queries
 *   - getCredentialBySlug / getCredentialById        single-row reads
 *   - getCertsCoveredBy                              transitive prereq walk
 *   - getCredentialPrereqDag                         the full graph
 *   - getCredentialPrimarySyllabus                   primary syllabus per cred
 *   - getCredentialMastery                           per-user mastery rollup
 *
 * Build-only helpers (consumed by `scripts/db/seed-credentials.ts`):
 *   - upsertCredential / upsertCredentialPrereq / upsertCredentialSyllabus
 *   - validateCredentialDag (topological-sort cycle detector)
 *
 * The DAG semantics live here because:
 *   - The seed validates DAG-ness via topological sort BEFORE writing any
 *     `credential_prereq` rows (better diagnostics than catching the DB
 *     no-self-loop CHECK after partial inserts).
 *   - The BC walkers carry a defence-in-depth visited-set guard so a malformed
 *     row inserted by hand can't loop the read paths.
 *
 * See [docs/decisions/016-cert-syllabus-goal-model/decision.md] for the
 * model rationale and [spec.md] for the schema contract.
 */

import {
	type AssessmentMethod,
	type CertApplicability,
	CREDENTIAL_PREREQ_KINDS,
	type CredentialKind,
	type CredentialStatus,
	NODE_MASTERY_GATES,
	SYLLABUS_PRIMACY,
	type SyllabusKind,
	type SyllabusStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { UpsertReturnedNoRowError } from './errors';
import { credentialSlugToCertApplicability, getLeafMasteryStateMap, type LeafMasteryState } from './mastery';
import {
	type CredentialPrereqRow,
	type CredentialRow,
	type CredentialSyllabusRow,
	credential,
	credentialPrereq,
	credentialSyllabus,
	type NewCredentialPrereqRow,
	type NewCredentialRow,
	type NewCredentialSyllabusRow,
	type SyllabusRow,
	syllabus,
	syllabusNode,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CredentialNotFoundError extends Error {
	constructor(public readonly key: { id: string } | { slug: string }) {
		super('id' in key ? `Credential not found: ${key.id}` : `Credential not found: ${key.slug}`);
		this.name = 'CredentialNotFoundError';
	}
}

export class CredentialPrereqCycleError extends Error {
	constructor(
		public readonly cycle: readonly string[],
		message?: string,
	) {
		super(message ?? `Credential prereq cycle detected: ${cycle.join(' -> ')}`);
		this.name = 'CredentialPrereqCycleError';
	}
}

/**
 * Raised by `validateCredentialDag` when topological sort cannot drain every
 * node but no walkable cycle was found from the first remaining node. This
 * happens when prereqs reference credentials that are part of a downstream
 * cycle, leaving them with non-zero in-degree even though DFS from one
 * specific entry didn't traverse the loop. Distinct from
 * `CredentialPrereqCycleError` so callers can render an accurate message
 * ("these credentials cannot be ordered" vs "this is the cycle path").
 */
export class CredentialPrereqUnresolvedNodesError extends Error {
	constructor(public readonly unresolved: readonly string[]) {
		super(`Credential prereq DAG has unresolved nodes: ${unresolved.join(', ')}`);
		this.name = 'CredentialPrereqUnresolvedNodesError';
	}
}

// ---------------------------------------------------------------------------
// Read paths
// ---------------------------------------------------------------------------

export interface ListCredentialsOptions {
	kind?: CredentialKind;
	status?: CredentialStatus;
}

/**
 * List credentials. Defaults to every kind, every status; pass filters to
 * narrow. Ordered by `kind`, then `slug` for a stable index render.
 */
export async function listCredentials(
	options: ListCredentialsOptions = {},
	db: Db = defaultDb,
): Promise<CredentialRow[]> {
	const conditions = [];
	if (options.kind !== undefined) conditions.push(eq(credential.kind, options.kind));
	if (options.status !== undefined) conditions.push(eq(credential.status, options.status));
	const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
	const query = db.select().from(credential).orderBy(credential.kind, credential.slug);
	return where ? query.where(where) : query;
}

/** Resolve a credential by primary key. Throws when missing. */
export async function getCredentialById(id: string, db: Db = defaultDb): Promise<CredentialRow> {
	const rows = await db.select().from(credential).where(eq(credential.id, id)).limit(1);
	const row = rows[0];
	if (!row) throw new CredentialNotFoundError({ id });
	return row;
}

/** Resolve a credential by `slug`. Throws when missing. */
export async function getCredentialBySlug(slug: string, db: Db = defaultDb): Promise<CredentialRow> {
	const rows = await db.select().from(credential).where(eq(credential.slug, slug)).limit(1);
	const row = rows[0];
	if (!row) throw new CredentialNotFoundError({ slug });
	return row;
}

/**
 * Batched counterpart to {@link getCredentialById}: resolve a set of credential
 * rows in a single round trip and return them keyed by id. Missing ids are
 * absent from the Map (no throw) -- this helper is used by per-row prereq /
 * link rendering where a missing prereq is a data condition the caller may
 * choose to surface or skip rather than a fatal error.
 *
 * Empty input short-circuits so callers don't have to guard. Output Map is
 * keyed by `credential.id`; iteration order matches Postgres return order
 * (no client-side sort).
 *
 * Closes the per-row N+1 in `apps/study/src/routes/(app)/goals/[id]/+page.server.ts`
 * (per-prereq `getCredentialById`) and `credentials/[slug]/+page.server.ts`
 * (per-prereq title resolution).
 */
export async function getCredentialsByIds(
	ids: readonly string[],
	db: Db = defaultDb,
): Promise<Map<string, CredentialRow>> {
	const out = new Map<string, CredentialRow>();
	if (ids.length === 0) return out;
	const rows = await db
		.select()
		.from(credential)
		.where(inArray(credential.id, ids as string[]));
	for (const row of rows) out.set(row.id, row);
	return out;
}

/**
 * Direct prereq edges for a credential. Returns the raw `credential_prereq`
 * rows; callers that want full prereq credential rows join via `getCredentialById`.
 */
export async function getCredentialPrereqs(credentialId: string, db: Db = defaultDb): Promise<CredentialPrereqRow[]> {
	return db.select().from(credentialPrereq).where(eq(credentialPrereq.credentialId, credentialId));
}

/**
 * Walk every required-or-recommended prereq transitively. Returns the set of
 * credential ids reachable from `credentialId` through `credential_prereq`,
 * including `credentialId` itself.
 *
 * Set the `kind` option to `'required'` to walk only hard prereqs; default
 * walks every kind (required AND recommended AND experience).
 *
 * Implementation note: this is a single Postgres `WITH RECURSIVE` CTE issued
 * via Drizzle's `sql\`\`` template. The CLAUDE.md "Drizzle ORM only / no raw
 * SQL" rule has a deliberate exception for graph walks -- expressing a
 * fixpoint traversal through Drizzle's query builder would require one
 * round-trip per BFS layer, which is exactly the cost we are removing here.
 * Postgres' `UNION` (not `UNION ALL`) gives us the visited-set guard for
 * free, so a hand-edited cyclic edge can't loop the recursion.
 */
export async function getCredentialIdsCoveredBy(
	credentialId: string,
	options: { kind?: 'required' | 'all' } = {},
	db: Db = defaultDb,
): Promise<string[]> {
	const kindFilter = options.kind ?? 'all';
	const requiredKind = CREDENTIAL_PREREQ_KINDS.REQUIRED;
	const kindClause = kindFilter === 'required' ? sql`AND cp.kind = ${requiredKind}` : sql``;
	const result = await db.execute(sql`
		WITH RECURSIVE covered(id) AS (
			SELECT ${credentialId}::text
			UNION
			SELECT cp.prereq_id
			FROM study.credential_prereq cp
			JOIN covered c ON c.id = cp.credential_id
			WHERE TRUE ${kindClause}
		)
		SELECT id FROM covered
	`);
	const rows = result as unknown as ReadonlyArray<{ id: string }>;
	return rows.map((r) => r.id);
}

/**
 * Cert-slug projection of {@link getCredentialIdsCoveredBy}. Returns slugs
 * instead of ids -- the canonical entry point used by the relevance cache
 * rebuild and by the existing `cert_goals`-derivation path.
 */
export async function getCertsCoveredBy(
	credentialId: string,
	options: { kind?: 'required' | 'all' } = {},
	db: Db = defaultDb,
): Promise<string[]> {
	const ids = await getCredentialIdsCoveredBy(credentialId, options, db);
	if (ids.length === 0) return [];
	const rows = await db
		.select({ slug: credential.slug })
		.from(credential)
		.where(
			sql`${credential.id} IN (${sql.join(
				ids.map((id) => sql`${id}`),
				sql`, `,
			)})`,
		);
	return rows.map((r) => r.slug).sort();
}

export interface CredentialDagSnapshot {
	nodes: CredentialRow[];
	edges: CredentialPrereqRow[];
}

/**
 * The full credential DAG -- every credential row plus every prereq edge.
 * Useful for the cert dashboard graph surface and the seed's pre-flight
 * cycle check.
 */
export async function getCredentialPrereqDag(db: Db = defaultDb): Promise<CredentialDagSnapshot> {
	const [nodes, edges] = await Promise.all([
		db.select().from(credential).orderBy(credential.kind, credential.slug),
		db.select().from(credentialPrereq),
	]);
	return { nodes, edges };
}

/**
 * Resolve the primary syllabus for a credential, or null when none is set.
 * Pulls only `status='active'` syllabi -- a primary syllabus that's been
 * archived is a seed bug, but we don't surface archived syllabi as primary.
 */
export async function getCredentialPrimarySyllabus(
	credentialId: string,
	db: Db = defaultDb,
): Promise<SyllabusRow | null> {
	const rows = await db
		.select({
			syllabus: syllabus,
		})
		.from(credentialSyllabus)
		.innerJoin(syllabus, eq(syllabus.id, credentialSyllabus.syllabusId))
		.where(
			and(eq(credentialSyllabus.credentialId, credentialId), eq(credentialSyllabus.primacy, SYLLABUS_PRIMACY.PRIMARY)),
		)
		.limit(1);
	const row = rows[0];
	return row?.syllabus ?? null;
}

/**
 * List every syllabus tied to a credential, optionally filtered by primacy
 * and status. Useful for the cert dashboard's "supplemental syllabi" panel.
 */
export async function getCredentialSyllabi(
	credentialId: string,
	options: { primacy?: 'primary' | 'supplemental'; syllabusKind?: SyllabusKind; syllabusStatus?: SyllabusStatus } = {},
	db: Db = defaultDb,
): Promise<Array<{ link: CredentialSyllabusRow; syllabus: SyllabusRow }>> {
	const conditions = [eq(credentialSyllabus.credentialId, credentialId)];
	if (options.primacy !== undefined) conditions.push(eq(credentialSyllabus.primacy, options.primacy));
	if (options.syllabusKind !== undefined) conditions.push(eq(syllabus.kind, options.syllabusKind));
	if (options.syllabusStatus !== undefined) conditions.push(eq(syllabus.status, options.syllabusStatus));
	const where = conditions.length === 1 ? conditions[0] : and(...conditions);
	return db
		.select({
			link: credentialSyllabus,
			syllabus,
		})
		.from(credentialSyllabus)
		.innerJoin(syllabus, eq(syllabus.id, credentialSyllabus.syllabusId))
		.where(where);
}

// ---------------------------------------------------------------------------
// Mastery rollup
// ---------------------------------------------------------------------------

export interface AreaMasteryRollup {
	areaCode: string;
	areaTitle: string;
	totalLeaves: number;
	coveredLeaves: number;
	masteredLeaves: number;
	/**
	 * Per-evidence-kind aggregate across the area's leaves. Counts the leaves
	 * whose required-kind set includes each kind, broken down by whether that
	 * kind aggregated to `pass`. Lets the cert dashboard render "Area V:
	 * scenario evidence missing on 3 of 8 skill leaves" without re-walking.
	 */
	byEvidenceKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>>;
}

export interface CredentialMasteryRollup {
	credentialId: string;
	credentialSlug: string;
	primarySyllabusId: string | null;
	totalLeaves: number;
	coveredLeaves: number;
	masteredLeaves: number;
	/**
	 * Per-evidence-kind aggregate across every leaf in the credential's
	 * primary syllabus. Same shape as `AreaMasteryRollup.byEvidenceKind`.
	 */
	byEvidenceKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>>;
	areas: AreaMasteryRollup[];
}

/**
 * Per-user mastery rollup at the credential level. Walks the credential's
 * primary syllabus tree, projects per-leaf mastery up to area level, and
 * sums credential-wide totals.
 *
 * Mastery uses the same dual-gate definition as `getNodeMastery` (cards
 * AND reps gates per ADR 011): a leaf is "mastered" when every linked node
 * is mastered. "Covered" means at least one linked node has any cards or
 * reps recorded -- the user has touched the area.
 *
 * The query is intentionally large (one round-trip joining four tables) so
 * the cert dashboard can render in a single fetch; for full pagination a
 * follow-on WP can split this if a 2000+-leaf cert lands.
 */
export async function getCredentialMastery(
	userId: string,
	credentialId: string,
	db: Db = defaultDb,
): Promise<CredentialMasteryRollup> {
	const cred = await getCredentialById(credentialId, db);
	const primary = await getCredentialPrimarySyllabus(credentialId, db);
	if (primary === null) {
		return {
			credentialId,
			credentialSlug: cred.slug,
			primarySyllabusId: null,
			totalLeaves: 0,
			coveredLeaves: 0,
			masteredLeaves: 0,
			byEvidenceKind: {},
			areas: [],
		};
	}

	// Fetch every node row in the primary syllabus once; we project the tree
	// in memory because the leaves-per-cert count is small (~hundreds) even
	// for a full ACS, and an in-memory walk lets us compute area rollups
	// without a second round-trip.
	const nodes = await db.select().from(syllabusNode).where(eq(syllabusNode.syllabusId, primary.id));

	const leafIds = nodes.filter((n) => n.isLeaf).map((n) => n.id);
	if (leafIds.length === 0) {
		return {
			credentialId,
			credentialSlug: cred.slug,
			primarySyllabusId: primary.id,
			totalLeaves: 0,
			coveredLeaves: 0,
			masteredLeaves: 0,
			byEvidenceKind: {},
			areas: nodes
				.filter((n) => n.level === 'area')
				.map((a) => ({
					areaCode: a.code,
					areaTitle: a.title,
					totalLeaves: 0,
					coveredLeaves: 0,
					masteredLeaves: 0,
					byEvidenceKind: {},
				})),
		};
	}

	// Per evidence-kind-gating: leaf mastery now flows through `isLeafMastered`,
	// which decomposes per-kind gates and applies the credential's
	// CertApplicability mapping (instructor / ATP tighten K to recall +
	// scenario; everything else keeps recall-only K). The richer state
	// surfaces missingKinds + byEvidenceKind so the cert dashboard can show
	// "you have recall down but need a scenario" without re-walking.
	const cert = credentialSlugToCertApplicability(cred.slug);
	const leafStateMap = await getLeafMasteryStateMap(userId, leafIds, cert, db);

	// Climb to area level. The walker indexes by id (Map lookup) rather than
	// scanning the `nodes` array per ancestor step -- scaling matters for
	// future credentials with thousands of leaves (CFI). For a 600-leaf ACS
	// the saved work is small but the asymptotic shape is right.
	const parentById = new Map(nodes.map((n) => [n.id, n.parentId] as const));
	const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
	function ancestorAreaId(leafId: string): string | null {
		let cur: string | null | undefined = leafId;
		while (cur !== undefined && cur !== null) {
			const node = nodesById.get(cur);
			if (node === undefined) return null;
			if (node.level === 'area') return node.id;
			cur = parentById.get(node.id) ?? null;
		}
		return null;
	}

	const areaRollup = new Map<string, AreaMasteryRollup>();
	for (const area of nodes.filter((n) => n.level === 'area')) {
		areaRollup.set(area.id, {
			areaCode: area.code,
			areaTitle: area.title,
			totalLeaves: 0,
			coveredLeaves: 0,
			masteredLeaves: 0,
			byEvidenceKind: {},
		});
	}

	let totalLeaves = 0;
	let coveredLeaves = 0;
	let masteredLeaves = 0;
	const credentialByKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>> = {};

	for (const leafId of leafIds) {
		const state = leafStateMap.get(leafId);
		const leaf = state ?? defaultLeafState(leafId);
		totalLeaves += 1;
		if (leaf.covered) coveredLeaves += 1;
		if (leaf.mastered) masteredLeaves += 1;
		bumpByKind(credentialByKind, leaf);

		const areaId = ancestorAreaId(leafId);
		if (areaId === null) continue;
		const area = areaRollup.get(areaId);
		if (area === undefined) continue;
		area.totalLeaves += 1;
		if (leaf.covered) area.coveredLeaves += 1;
		if (leaf.mastered) area.masteredLeaves += 1;
		bumpByKind(area.byEvidenceKind, leaf);
	}

	return {
		credentialId,
		credentialSlug: cred.slug,
		primarySyllabusId: primary.id,
		totalLeaves,
		coveredLeaves,
		masteredLeaves,
		byEvidenceKind: credentialByKind,
		areas: [...areaRollup.values()].sort((a, b) => a.areaCode.localeCompare(b.areaCode)),
	};
}

/**
 * Batched counterpart to {@link getCredentialMastery}: fan out the per-row
 * round-trips into a fixed handful of queries plus one per distinct cert.
 *
 * The per-row helper makes 4+ trips (credential, primary-syllabus link,
 * syllabus-node tree, leaf-mastery aggregation). On `/credentials` with N
 * credentials that grew to 4N+ trips. This helper collapses the shared
 * fetches: one trip for credentials, one for primary-syllabus links across
 * the whole input set, one for the union of `syllabus_node` rows, and one
 * `getLeafMasteryStateMap` call per distinct cert (most pages have ≤ 3).
 *
 * Closes the per-row N+1 in `apps/study/src/routes/(app)/credentials/+page.server.ts`.
 *
 * Missing credential ids are absent from the output Map (no throw); callers
 * deciding the contract for a missing prereq render the empty branch
 * themselves. Empty input short-circuits.
 */
export async function getCredentialMasteryMap(
	userId: string,
	credentialIds: readonly string[],
	db: Db = defaultDb,
): Promise<Map<string, CredentialMasteryRollup>> {
	const out = new Map<string, CredentialMasteryRollup>();
	if (credentialIds.length === 0) return out;
	const ids = credentialIds as string[];

	// Trip 1: credentials. Trip 2: primary-syllabus links across the input.
	// The (credential_id, primacy) partial UNIQUE on credential_syllabus
	// guarantees at most one row per (credentialId) when primacy=primary, so
	// this stays one row per credential.
	const [credentialRows, primarySyllabusLinks] = await Promise.all([
		db.select().from(credential).where(inArray(credential.id, ids)),
		db
			.select({
				credentialId: credentialSyllabus.credentialId,
				syllabus: syllabus,
			})
			.from(credentialSyllabus)
			.innerJoin(syllabus, eq(syllabus.id, credentialSyllabus.syllabusId))
			.where(
				and(inArray(credentialSyllabus.credentialId, ids), eq(credentialSyllabus.primacy, SYLLABUS_PRIMACY.PRIMARY)),
			),
	]);

	const credentialById = new Map(credentialRows.map((c) => [c.id, c] as const));
	const primaryByCred = new Map<string, SyllabusRow>();
	for (const link of primarySyllabusLinks) {
		primaryByCred.set(link.credentialId, link.syllabus);
	}

	// Trip 3: every syllabus_node row whose syllabus_id is one of the primary
	// syllabi. Bucket per syllabus for the per-credential walk below.
	const primarySyllabusIds = [...new Set([...primaryByCred.values()].map((s) => s.id))];
	const allNodeRows =
		primarySyllabusIds.length === 0
			? []
			: await db.select().from(syllabusNode).where(inArray(syllabusNode.syllabusId, primarySyllabusIds));
	const nodesBySyllabus = new Map<string, typeof allNodeRows>();
	for (const node of allNodeRows) {
		const list = nodesBySyllabus.get(node.syllabusId) ?? [];
		list.push(node);
		nodesBySyllabus.set(node.syllabusId, list);
	}

	// Trip 4..M: one `getLeafMasteryStateMap` per distinct cert. The cert
	// changes the kind-mapping but not the underlying evidence; on the
	// `/credentials` page distinct certs typically ≤ 3 (PPL/CPL/IR vs CFI vs
	// ATP), well below the per-row trip count.
	const leavesByCert = new Map<CertApplicability, string[]>();
	for (const credentialId of ids) {
		const cred = credentialById.get(credentialId);
		const primary = primaryByCred.get(credentialId);
		if (cred === undefined || primary === undefined) continue;
		const nodes = nodesBySyllabus.get(primary.id) ?? [];
		const leafIds = nodes.filter((n) => n.isLeaf).map((n) => n.id);
		if (leafIds.length === 0) continue;
		const cert = credentialSlugToCertApplicability(cred.slug);
		const bucket = leavesByCert.get(cert) ?? [];
		for (const id of leafIds) bucket.push(id);
		leavesByCert.set(cert, bucket);
	}
	const stateByCert = new Map<CertApplicability, Map<string, LeafMasteryState>>();
	await Promise.all(
		[...leavesByCert.entries()].map(async ([cert, leafIds]) => {
			const stateMap = await getLeafMasteryStateMap(userId, leafIds, cert, db);
			stateByCert.set(cert, stateMap);
		}),
	);

	for (const credentialId of ids) {
		const cred = credentialById.get(credentialId);
		if (cred === undefined) continue;
		const primary = primaryByCred.get(credentialId);
		if (primary === undefined) {
			out.set(credentialId, {
				credentialId,
				credentialSlug: cred.slug,
				primarySyllabusId: null,
				totalLeaves: 0,
				coveredLeaves: 0,
				masteredLeaves: 0,
				byEvidenceKind: {},
				areas: [],
			});
			continue;
		}

		const nodes = nodesBySyllabus.get(primary.id) ?? [];
		const leafIds = nodes.filter((n) => n.isLeaf).map((n) => n.id);

		// Empty-syllabus branch mirrors getCredentialMastery -- include every
		// area row so the dashboard renders the area shells even before any
		// leaves land.
		if (leafIds.length === 0) {
			out.set(credentialId, {
				credentialId,
				credentialSlug: cred.slug,
				primarySyllabusId: primary.id,
				totalLeaves: 0,
				coveredLeaves: 0,
				masteredLeaves: 0,
				byEvidenceKind: {},
				areas: nodes
					.filter((n) => n.level === 'area')
					.map((a) => ({
						areaCode: a.code,
						areaTitle: a.title,
						totalLeaves: 0,
						coveredLeaves: 0,
						masteredLeaves: 0,
						byEvidenceKind: {},
					})),
			});
			continue;
		}

		const cert = credentialSlugToCertApplicability(cred.slug);
		const leafStateMap = stateByCert.get(cert) ?? new Map<string, LeafMasteryState>();

		const parentById = new Map(nodes.map((n) => [n.id, n.parentId] as const));
		const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
		const ancestorAreaId = (leafId: string): string | null => {
			let cur: string | null | undefined = leafId;
			while (cur !== undefined && cur !== null) {
				const node = nodesById.get(cur);
				if (node === undefined) return null;
				if (node.level === 'area') return node.id;
				cur = parentById.get(node.id) ?? null;
			}
			return null;
		};

		const areaRollup = new Map<string, AreaMasteryRollup>();
		for (const area of nodes.filter((n) => n.level === 'area')) {
			areaRollup.set(area.id, {
				areaCode: area.code,
				areaTitle: area.title,
				totalLeaves: 0,
				coveredLeaves: 0,
				masteredLeaves: 0,
				byEvidenceKind: {},
			});
		}

		let totalLeaves = 0;
		let coveredLeaves = 0;
		let masteredLeaves = 0;
		const credentialByKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>> = {};

		for (const leafId of leafIds) {
			const state = leafStateMap.get(leafId);
			const leaf = state ?? defaultLeafState(leafId);
			totalLeaves += 1;
			if (leaf.covered) coveredLeaves += 1;
			if (leaf.mastered) masteredLeaves += 1;
			bumpByKind(credentialByKind, leaf);

			const areaId = ancestorAreaId(leafId);
			if (areaId === null) continue;
			const area = areaRollup.get(areaId);
			if (area === undefined) continue;
			area.totalLeaves += 1;
			if (leaf.covered) area.coveredLeaves += 1;
			if (leaf.mastered) area.masteredLeaves += 1;
			bumpByKind(area.byEvidenceKind, leaf);
		}

		out.set(credentialId, {
			credentialId,
			credentialSlug: cred.slug,
			primarySyllabusId: primary.id,
			totalLeaves,
			coveredLeaves,
			masteredLeaves,
			byEvidenceKind: credentialByKind,
			areas: [...areaRollup.values()].sort((a, b) => a.areaCode.localeCompare(b.areaCode)),
		});
	}

	return out;
}

function defaultLeafState(leafId: string): LeafMasteryState {
	return {
		leafId,
		mastered: false,
		covered: false,
		requiredKinds: [],
		byEvidenceKind: {},
		missingKinds: [],
	};
}

function bumpByKind(
	target: Partial<Record<AssessmentMethod, { required: number; passing: number }>>,
	leaf: LeafMasteryState,
): void {
	for (const kind of leaf.requiredKinds) {
		const existing = target[kind] ?? { required: 0, passing: 0 };
		existing.required += 1;
		if (leaf.byEvidenceKind[kind] === NODE_MASTERY_GATES.PASS) {
			existing.passing += 1;
		}
		target[kind] = existing;
	}
}

// ---------------------------------------------------------------------------
// Build helpers (not exported from the BC barrel)
// ---------------------------------------------------------------------------

/**
 * Upsert a credential row by primary key. Idempotent across re-seeds; the
 * `regulatory_basis` JSONB column round-trips verbatim.
 */
export async function upsertCredential(input: NewCredentialRow, db: Db = defaultDb): Promise<CredentialRow> {
	const [row] = await db
		.insert(credential)
		.values(input)
		.onConflictDoUpdate({
			target: credential.id,
			set: {
				slug: input.slug,
				kind: input.kind,
				title: input.title,
				category: input.category,
				class: input.class,
				regulatoryBasis: input.regulatoryBasis,
				status: input.status,
				seedOrigin: input.seedOrigin,
				updatedAt: new Date(),
			},
		})
		.returning();
	if (!row) throw new UpsertReturnedNoRowError('credential', input.id);
	return row;
}

/**
 * Upsert a credential prereq edge. Composite PK on `(credential_id,
 * prereq_id, kind)` so re-seeding the same triple is a no-op apart from
 * `notes` updates.
 */
export async function upsertCredentialPrereq(input: NewCredentialPrereqRow, db: Db = defaultDb): Promise<void> {
	await db
		.insert(credentialPrereq)
		.values(input)
		.onConflictDoUpdate({
			target: [credentialPrereq.credentialId, credentialPrereq.prereqId, credentialPrereq.kind],
			set: {
				notes: input.notes ?? '',
				seedOrigin: input.seedOrigin,
			},
		});
}

/**
 * Upsert a credential <-> syllabus mapping. The partial UNIQUE on
 * `(credential_id) WHERE primacy='primary'` enforces at-most-one-primary.
 */
export async function upsertCredentialSyllabus(input: NewCredentialSyllabusRow, db: Db = defaultDb): Promise<void> {
	await db
		.insert(credentialSyllabus)
		.values(input)
		.onConflictDoUpdate({
			target: [credentialSyllabus.credentialId, credentialSyllabus.syllabusId],
			set: {
				primacy: input.primacy,
				seedOrigin: input.seedOrigin,
			},
		});
}

/**
 * Topological-sort cycle detector for a proposed credential prereq DAG.
 * Throws {@link CredentialPrereqCycleError} when a cycle exists. Used by
 * `scripts/db/seed-credentials.ts` BEFORE writing any rows so a failed seed
 * never leaves the DB in a half-edge state.
 *
 * Pure -- takes the proposed `(credentialId -> prereqIds[])` adjacency map
 * and runs Kahn's algorithm. Output order is stable; only the cycle path
 * is surfaced when a cycle is found.
 */
export function validateCredentialDag(adjacency: ReadonlyMap<string, readonly string[]>): void {
	const inDegree = new Map<string, number>();
	const reverse = new Map<string, string[]>();
	for (const [node, prereqs] of adjacency) {
		if (!inDegree.has(node)) inDegree.set(node, 0);
		for (const p of prereqs) {
			if (!inDegree.has(p)) inDegree.set(p, 0);
			inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
			const list = reverse.get(p) ?? [];
			list.push(node);
			reverse.set(p, list);
		}
	}
	const queue: string[] = [];
	for (const [node, deg] of inDegree) {
		if (deg === 0) queue.push(node);
	}
	const sorted: string[] = [];
	while (queue.length > 0) {
		const next = queue.shift();
		if (next === undefined) break;
		sorted.push(next);
		const successors = reverse.get(next) ?? [];
		for (const s of successors) {
			const deg = (inDegree.get(s) ?? 1) - 1;
			inDegree.set(s, deg);
			if (deg === 0) queue.push(s);
		}
	}
	if (sorted.length !== inDegree.size) {
		// Surface the unsorted nodes -- those that still have a non-zero
		// in-degree are part of (or downstream of) the cycle. Find one cycle
		// for the error message via a DFS. When DFS can't walk a cycle from
		// the chosen entry, throw the distinct unresolved-nodes error so
		// callers don't render an unsorted id list as a cycle path.
		const unsorted = [...inDegree.entries()].filter(([_, d]) => d > 0).map(([n]) => n);
		const cycle = findCycle(adjacency, unsorted[0] ?? '');
		if (cycle.length > 0) {
			throw new CredentialPrereqCycleError(cycle);
		}
		throw new CredentialPrereqUnresolvedNodesError(unsorted);
	}
	// `inDegree` size may exceed adjacency.size when prereqs reference
	// credentials not in the proposed map; that's a missing-reference
	// problem caught by FK at insert time, not by this validator.
}

/**
 * DFS find a cycle starting from `root`. Returns the cycle as a path
 * (nodes in order), or empty when no cycle is reachable from root.
 */
function findCycle(adjacency: ReadonlyMap<string, readonly string[]>, root: string): string[] {
	if (root === '') return [];
	const stack: string[] = [];
	const onStack = new Set<string>();
	const visited = new Set<string>();
	function dfs(node: string): string[] | null {
		stack.push(node);
		onStack.add(node);
		visited.add(node);
		const prereqs = adjacency.get(node) ?? [];
		for (const next of prereqs) {
			if (onStack.has(next)) {
				const startIdx = stack.indexOf(next);
				return stack.slice(startIdx).concat(next);
			}
			if (!visited.has(next)) {
				const result = dfs(next);
				if (result !== null) return result;
			}
		}
		stack.pop();
		onStack.delete(node);
		return null;
	}
	return dfs(root) ?? [];
}
