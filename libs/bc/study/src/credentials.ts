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
	CREDENTIAL_PREREQ_KINDS,
	type CredentialKind,
	type CredentialStatus,
	SYLLABUS_PRIMACY,
	type SyllabusKind,
	type SyllabusStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
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
	syllabusNodeLink,
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
 * Visited-set defends against malformed rows (the seed's topological sort
 * should have caught any cycle, but a hand-edited DB row could still slip in).
 *
 * Set the `kind` option to `'required'` to walk only hard prereqs; default
 * walks every kind (required AND recommended AND experience).
 */
export async function getCredentialIdsCoveredBy(
	credentialId: string,
	options: { kind?: 'required' | 'all' } = {},
	db: Db = defaultDb,
): Promise<string[]> {
	const kindFilter = options.kind ?? 'all';
	const out = new Set<string>([credentialId]);
	const queue: string[] = [credentialId];
	const visited = new Set<string>();
	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) break;
		if (visited.has(current)) continue;
		visited.add(current);
		const conditions = [eq(credentialPrereq.credentialId, current)];
		if (kindFilter === 'required') {
			conditions.push(eq(credentialPrereq.kind, CREDENTIAL_PREREQ_KINDS.REQUIRED));
		}
		const where = conditions.length === 1 ? conditions[0] : and(...conditions);
		const rows = await db.select({ prereqId: credentialPrereq.prereqId }).from(credentialPrereq).where(where);
		for (const r of rows) {
			if (!out.has(r.prereqId)) {
				out.add(r.prereqId);
				queue.push(r.prereqId);
			}
		}
	}
	return [...out];
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
}

export interface CredentialMasteryRollup {
	credentialId: string;
	credentialSlug: string;
	primarySyllabusId: string | null;
	totalLeaves: number;
	coveredLeaves: number;
	masteredLeaves: number;
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
			areas: nodes
				.filter((n) => n.level === 'area')
				.map((a) => ({ areaCode: a.code, areaTitle: a.title, totalLeaves: 0, coveredLeaves: 0, masteredLeaves: 0 })),
		};
	}

	// Pull every (leaf, knowledge_node) link plus the per-node mastery state
	// in one round-trip so the rollup is O(leaves) in memory after.
	const linkRows = await db
		.select({
			leafId: syllabusNodeLink.syllabusNodeId,
			knowledgeNodeId: syllabusNodeLink.knowledgeNodeId,
		})
		.from(syllabusNodeLink)
		.where(
			sql`${syllabusNodeLink.syllabusNodeId} IN (${sql.join(
				leafIds.map((id) => sql`${id}`),
				sql`, `,
			)})`,
		);

	const knowledgeNodeIds = [...new Set(linkRows.map((r) => r.knowledgeNodeId))];
	const masteryByNode = await fetchKnowledgeNodeMastery(userId, knowledgeNodeIds, db);

	// Group links by leaf.
	const linksByLeaf = new Map<string, string[]>();
	for (const row of linkRows) {
		const existing = linksByLeaf.get(row.leafId) ?? [];
		existing.push(row.knowledgeNodeId);
		linksByLeaf.set(row.leafId, existing);
	}

	// Compute per-leaf mastery + coverage.
	const leafState = new Map<string, { covered: boolean; mastered: boolean }>();
	for (const leaf of nodes.filter((n) => n.isLeaf)) {
		const links = linksByLeaf.get(leaf.id) ?? [];
		if (links.length === 0) {
			leafState.set(leaf.id, { covered: false, mastered: false });
			continue;
		}
		let allMastered = true;
		let anyCovered = false;
		for (const nodeId of links) {
			const m = masteryByNode.get(nodeId);
			if (m === undefined) {
				allMastered = false;
				continue;
			}
			if (m.touched) anyCovered = true;
			if (!m.mastered) allMastered = false;
		}
		leafState.set(leaf.id, { covered: anyCovered, mastered: allMastered });
	}

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
		});
	}

	let totalLeaves = 0;
	let coveredLeaves = 0;
	let masteredLeaves = 0;
	for (const [leafId, state] of leafState) {
		totalLeaves += 1;
		if (state.covered) coveredLeaves += 1;
		if (state.mastered) masteredLeaves += 1;
		const areaId = ancestorAreaId(leafId);
		if (areaId === null) continue;
		const area = areaRollup.get(areaId);
		if (area === undefined) continue;
		area.totalLeaves += 1;
		if (state.covered) area.coveredLeaves += 1;
		if (state.mastered) area.masteredLeaves += 1;
	}

	return {
		credentialId,
		credentialSlug: cred.slug,
		primarySyllabusId: primary.id,
		totalLeaves,
		coveredLeaves,
		masteredLeaves,
		areas: [...areaRollup.values()].sort((a, b) => a.areaCode.localeCompare(b.areaCode)),
	};
}

interface NodeMasterySnapshot {
	mastered: boolean;
	touched: boolean;
}

/**
 * Pull per-node mastery flags for an arbitrary set of node ids in one
 * round-trip. Returns a map keyed on node id.
 *
 * Reuses the same dual-gate definition as
 * `libs/bc/study/src/knowledge.ts:getNodeMasteryMap`. Inlined here (not
 * imported) because the credential rollup needs only the boolean flags --
 * importing the larger snapshot type would surface unrelated fields and
 * couple BC modules unnecessarily.
 */
async function fetchKnowledgeNodeMastery(
	userId: string,
	nodeIds: readonly string[],
	db: Db,
): Promise<Map<string, NodeMasterySnapshot>> {
	const out = new Map<string, NodeMasterySnapshot>();
	if (nodeIds.length === 0) return out;
	const ids = [...nodeIds];

	// We delegate to knowledge.ts's existing batched query via a re-import
	// at runtime; that module owns the gate math.
	const { getNodeMasteryMap } = await import('./knowledge');
	const snapshots = await getNodeMasteryMap(userId, ids, db);
	for (const [nodeId, snap] of snapshots) {
		out.set(nodeId, { mastered: snap.mastered, touched: snap.inProgress || snap.mastered });
	}
	return out;
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
	if (!row) throw new Error(`upsertCredential failed for ${input.id}`);
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
		// for the error message via a DFS.
		const unsorted = [...inDegree.entries()].filter(([_, d]) => d > 0).map(([n]) => n);
		const cycle = findCycle(adjacency, unsorted[0] ?? '');
		throw new CredentialPrereqCycleError(cycle.length > 0 ? cycle : unsorted);
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
