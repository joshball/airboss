/**
 * Syllabus BC -- the syllabus tree, leaf links, and citation reads.
 *
 * Read paths:
 *   - listSyllabi                                     index queries
 *   - getSyllabusBySlug / getSyllabusById             single-row reads
 *   - getSyllabusTree                                 every node in a syllabus
 *   - getSyllabusArea                                 one area + its tasks + elements
 *   - getSyllabusLeaves                               every leaf in a syllabus
 *   - getCitationsForSyllabusNode                     inline JSONB citations
 *   - getKnowledgeNodesForSyllabusLeaf                forward leaf -> nodes
 *   - getSyllabusLeavesForKnowledgeNode               reverse node -> leaves
 *
 * Build-only helpers (consumed by `scripts/db/seed-syllabi.ts`):
 *   - upsertSyllabus / upsertSyllabusNode
 *   - replaceSyllabusNodeLinks (idempotent re-seed for one leaf)
 *   - validateSyllabusTree (parent-level + cycle + uniqueness)
 *   - validateAirbossRefForLeaf (`@ab/sources`-routed parser check)
 *
 * The relevance-cache rebuild lives at `scripts/db/build-relevance-cache.ts`,
 * not here -- it's a one-shot script that walks every active syllabus and
 * writes `knowledge_node.relevance` from the (cert, bloom, priority) triples.
 *
 * The "validate before write" pattern matches credentials.ts: the seed
 * runs validation against the proposed YAML model before issuing inserts,
 * so a half-failed seed never leaves the DB in a broken state.
 *
 * See ADR 016 phases 3-5 + the cert-syllabus WP spec for the model rationale.
 */

import {
	ACS_TRIAD_VALUES,
	SYLLABUS_NODE_LEVELS,
	type SyllabusKind,
	type SyllabusNodeLevel,
	type SyllabusStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { getCorpusResolver, isParseError, parseIdentifier } from '@ab/sources';
import type { StructuredCitation } from '@ab/types';
import { and, asc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type KnowledgeNodeRow,
	knowledgeNode,
	type NewSyllabusNodeLinkRow,
	type NewSyllabusNodeRow,
	type NewSyllabusRow,
	type SyllabusNodeLinkRow,
	type SyllabusNodeRow,
	type SyllabusRow,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SyllabusNotFoundError extends Error {
	constructor(public readonly key: { id: string } | { slug: string }) {
		super('id' in key ? `Syllabus not found: ${key.id}` : `Syllabus not found: ${key.slug}`);
		this.name = 'SyllabusNotFoundError';
	}
}

export class SyllabusValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SyllabusValidationError';
	}
}

export class AirbossRefValidationError extends Error {
	constructor(
		public readonly identifier: string,
		message: string,
	) {
		super(message);
		this.name = 'AirbossRefValidationError';
	}
}

// ---------------------------------------------------------------------------
// Read paths
// ---------------------------------------------------------------------------

export interface ListSyllabiOptions {
	kind?: SyllabusKind;
	status?: SyllabusStatus;
}

/** List syllabi. Defaults to every kind + status; pass filters to narrow. */
export async function listSyllabi(options: ListSyllabiOptions = {}, db: Db = defaultDb): Promise<SyllabusRow[]> {
	const conditions = [];
	if (options.kind !== undefined) conditions.push(eq(syllabus.kind, options.kind));
	if (options.status !== undefined) conditions.push(eq(syllabus.status, options.status));
	const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
	const query = db.select().from(syllabus).orderBy(syllabus.kind, syllabus.slug);
	return where ? query.where(where) : query;
}

/** Resolve a syllabus by primary key. Throws when missing. */
export async function getSyllabusById(id: string, db: Db = defaultDb): Promise<SyllabusRow> {
	const rows = await db.select().from(syllabus).where(eq(syllabus.id, id)).limit(1);
	const row = rows[0];
	if (!row) throw new SyllabusNotFoundError({ id });
	return row;
}

/** Resolve a syllabus by slug. Throws when missing. */
export async function getSyllabusBySlug(slug: string, db: Db = defaultDb): Promise<SyllabusRow> {
	const rows = await db.select().from(syllabus).where(eq(syllabus.slug, slug)).limit(1);
	const row = rows[0];
	if (!row) throw new SyllabusNotFoundError({ slug });
	return row;
}

/**
 * Every node in a syllabus, in tree-walk order (parent before children, same
 * parent ordered by `ordinal`). Callers that want the materialised tree
 * shape pass the result through {@link buildSyllabusTreeFromRows}.
 */
export async function getSyllabusTree(syllabusId: string, db: Db = defaultDb): Promise<SyllabusNodeRow[]> {
	return db
		.select()
		.from(syllabusNode)
		.where(eq(syllabusNode.syllabusId, syllabusId))
		.orderBy(asc(syllabusNode.level), asc(syllabusNode.ordinal));
}

export interface SyllabusTreeNode {
	row: SyllabusNodeRow;
	children: SyllabusTreeNode[];
}

/**
 * Materialise the flat row list returned by {@link getSyllabusTree} into a
 * proper parent->children tree. Pure -- no DB access. Order is by `ordinal`
 * within each parent.
 */
export function buildSyllabusTreeFromRows(rows: readonly SyllabusNodeRow[]): SyllabusTreeNode[] {
	const byId = new Map<string, SyllabusTreeNode>();
	for (const row of rows) byId.set(row.id, { row, children: [] });
	const roots: SyllabusTreeNode[] = [];
	for (const node of byId.values()) {
		if (node.row.parentId === null) {
			roots.push(node);
			continue;
		}
		const parent = byId.get(node.row.parentId);
		if (parent === undefined) {
			// Orphan -- malformed data. Surface at the root level so it
			// doesn't disappear silently.
			roots.push(node);
			continue;
		}
		parent.children.push(node);
	}
	const sortByOrdinal = (a: SyllabusTreeNode, b: SyllabusTreeNode): number => a.row.ordinal - b.row.ordinal;
	function sortRecursive(nodes: SyllabusTreeNode[]): void {
		nodes.sort(sortByOrdinal);
		for (const n of nodes) sortRecursive(n.children);
	}
	sortRecursive(roots);
	return roots;
}

export interface SyllabusAreaView {
	area: SyllabusNodeRow;
	tasks: SyllabusNodeRow[];
	elements: SyllabusNodeRow[];
}

/**
 * Materialise one area's subtree: the area row, every direct task child,
 * and every element under those tasks. Used by the per-area cert dashboard.
 *
 * Throws {@link SyllabusNotFoundError} when no area row matches.
 */
export async function getSyllabusArea(
	syllabusId: string,
	areaCode: string,
	db: Db = defaultDb,
): Promise<SyllabusAreaView> {
	const tree = await getSyllabusTree(syllabusId, db);
	const area = tree.find((n) => n.code === areaCode && n.level === SYLLABUS_NODE_LEVELS.AREA);
	if (area === undefined) throw new SyllabusNotFoundError({ id: `${syllabusId}/${areaCode}` });
	const tasks = tree.filter((n) => n.parentId === area.id && n.level === SYLLABUS_NODE_LEVELS.TASK);
	const taskIds = new Set(tasks.map((t) => t.id));
	const elements = tree.filter((n) => n.parentId !== null && taskIds.has(n.parentId));
	return {
		area,
		tasks: tasks.sort((a, b) => a.ordinal - b.ordinal),
		elements: elements.sort((a, b) => a.ordinal - b.ordinal),
	};
}

/** Every leaf in a syllabus, ordered by `(parent_ordinal, ordinal)`. */
export async function getSyllabusLeaves(syllabusId: string, db: Db = defaultDb): Promise<SyllabusNodeRow[]> {
	return db
		.select()
		.from(syllabusNode)
		.where(and(eq(syllabusNode.syllabusId, syllabusId), eq(syllabusNode.isLeaf, true)))
		.orderBy(asc(syllabusNode.ordinal));
}

/**
 * Inline `StructuredCitation` array on a syllabus_node row. Returns the
 * empty array when the node has no citations or doesn't exist (the latter
 * surfaces as a not-found error from the underlying `getSyllabusNodeById`).
 */
export async function getCitationsForSyllabusNode(
	syllabusNodeId: string,
	db: Db = defaultDb,
): Promise<StructuredCitation[]> {
	const rows = await db
		.select({ citations: syllabusNode.citations })
		.from(syllabusNode)
		.where(eq(syllabusNode.id, syllabusNodeId))
		.limit(1);
	const row = rows[0];
	return row?.citations ?? [];
}

/**
 * Optional class scoping for the leaf-graph traversals. Class-agnostic leaves
 * (`classes IS NULL`) always pass; class-tagged leaves pass when their tags
 * intersect the filter array. Empty / undefined filter = pass.
 *
 * Values are members of `AIRPLANE_CLASS_VALUES` (`asel`/`amel`/`ases`/`ames`).
 */
export interface ClassFilterOptions {
	classes?: readonly string[];
}

/** Forward query: knowledge nodes linked to a syllabus leaf, with link weight. */
export async function getKnowledgeNodesForSyllabusLeaf(
	syllabusNodeId: string,
	options: ClassFilterOptions = {},
	db: Db = defaultDb,
): Promise<Array<{ node: KnowledgeNodeRow; weight: number }>> {
	const rows = await db
		.select({
			node: knowledgeNode,
			weight: syllabusNodeLink.weight,
			leafClasses: syllabusNode.classes,
		})
		.from(syllabusNodeLink)
		.innerJoin(syllabusNode, eq(syllabusNode.id, syllabusNodeLink.syllabusNodeId))
		.innerJoin(knowledgeNode, eq(knowledgeNode.id, syllabusNodeLink.knowledgeNodeId))
		.where(eq(syllabusNodeLink.syllabusNodeId, syllabusNodeId));
	const classFilter = options.classes ?? [];
	return rows
		.filter((r) => leafPassesClassFilter(r.leafClasses, classFilter))
		.map((r) => ({ node: r.node, weight: r.weight }));
}

export interface SyllabusLeafWithSyllabus {
	leaf: SyllabusNodeRow;
	syllabus: SyllabusRow;
	weight: number;
}

/**
 * Reverse query: every syllabus leaf that links to a knowledge node.
 * Used by the relevance cache rebuild (phase 18) -- one knowledge node
 * inherits relevance from every credential whose primary syllabus contains
 * a leaf pointing at it.
 */
export async function getSyllabusLeavesForKnowledgeNode(
	knowledgeNodeId: string,
	options: ClassFilterOptions = {},
	db: Db = defaultDb,
): Promise<SyllabusLeafWithSyllabus[]> {
	const rows = await db
		.select({
			leaf: syllabusNode,
			syllabus,
			weight: syllabusNodeLink.weight,
		})
		.from(syllabusNodeLink)
		.innerJoin(syllabusNode, eq(syllabusNode.id, syllabusNodeLink.syllabusNodeId))
		.innerJoin(syllabus, eq(syllabus.id, syllabusNode.syllabusId))
		.where(eq(syllabusNodeLink.knowledgeNodeId, knowledgeNodeId));
	const classFilter = options.classes ?? [];
	return rows
		.filter((r) => leafPassesClassFilter(r.leaf.classes, classFilter))
		.map((r) => ({ leaf: r.leaf, syllabus: r.syllabus, weight: r.weight }));
}

/** True when a leaf's `classes` column is null OR intersects the filter array. */
function leafPassesClassFilter(leafClasses: readonly string[] | null, filter: readonly string[]): boolean {
	if (filter.length === 0) return true;
	if (leafClasses === null) return true;
	for (const cls of leafClasses) {
		if (filter.includes(cls)) return true;
	}
	return false;
}

// ---------------------------------------------------------------------------
// airboss-ref validation (BC + seed layer)
// ---------------------------------------------------------------------------

/**
 * Validate an `airboss-ref:` identifier as it applies to a syllabus leaf.
 * Throws {@link AirbossRefValidationError} on shape mismatch.
 *
 * Rules:
 *
 * 1. Must parse via the `@ab/sources` parser (well-formed scheme).
 * 2. Corpus must be enumerated in ADR 019 §1.2 (a registered resolver
 *    exists for it).
 * 3. For ACS / PTS-kind syllabi, corpus must be `acs` and the per-corpus
 *    resolver must accept the locator. The seed pre-checks the kind so
 *    an authored mistake (CFR identifier on an ACS leaf) is caught.
 *
 * Pure given a parser + resolver lookup; no DB access.
 */
export function validateAirbossRefForLeaf(identifier: string, expectations: { syllabusKind: SyllabusKind }): void {
	const parsed = parseIdentifier(identifier);
	if (isParseError(parsed)) {
		throw new AirbossRefValidationError(identifier, `airboss-ref does not parse: ${parsed.message}`);
	}
	const resolver = getCorpusResolver(parsed.corpus);
	if (resolver === null) {
		throw new AirbossRefValidationError(
			identifier,
			`airboss-ref corpus "${parsed.corpus}" is not enumerated in ADR 019 §1.2`,
		);
	}
	if (expectations.syllabusKind === 'acs') {
		if (parsed.corpus !== 'acs') {
			throw new AirbossRefValidationError(identifier, `ACS leaves require the "acs" corpus; got "${parsed.corpus}"`);
		}
		const locResult = resolver.parseLocator(parsed.locator);
		if (locResult.kind !== 'ok') {
			throw new AirbossRefValidationError(
				identifier,
				`airboss-ref locator does not parse for the acs corpus: ${locResult.message}`,
			);
		}
	}
	if (expectations.syllabusKind === 'pts') {
		if (parsed.corpus !== 'pts') {
			throw new AirbossRefValidationError(identifier, `PTS leaves require the "pts" corpus; got "${parsed.corpus}"`);
		}
		const locResult = resolver.parseLocator(parsed.locator);
		if (locResult.kind !== 'ok') {
			throw new AirbossRefValidationError(
				identifier,
				`airboss-ref locator does not parse for the pts corpus: ${locResult.message}`,
			);
		}
	}
}

// ---------------------------------------------------------------------------
// Tree-shape validation (seed layer)
// ---------------------------------------------------------------------------

export interface SyllabusTreeValidationInput {
	syllabusId: string;
	syllabusKind: SyllabusKind;
	rows: readonly NewSyllabusNodeRow[];
}

/**
 * Validate a proposed syllabus tree before it lands in the DB.
 *
 * Rules surfaced as {@link SyllabusValidationError}:
 *
 * - Every `area`-level row has `parent_id IS NULL`.
 * - Every non-area row has a `parent_id` that points at a row in the same
 *   syllabus.
 * - `(syllabus_id, code)` is unique.
 * - No cycles (a node may not be its own ancestor).
 * - For ACS / PTS: every `element`-level row carries a `triad`.
 * - For ACS / PTS: every leaf has `airboss_ref` set.
 * - Every leaf has `required_bloom` set.
 * - `is_leaf=true` is consistent with "no children present in the input".
 *
 * Pure -- the seed runs this BEFORE issuing inserts.
 */
export function validateSyllabusTree(input: SyllabusTreeValidationInput): void {
	const { rows, syllabusId, syllabusKind } = input;
	const byId = new Map<string, NewSyllabusNodeRow>();
	const seenCodes = new Set<string>();
	for (const row of rows) {
		if (row.syllabusId !== syllabusId) {
			throw new SyllabusValidationError(`row id=${row.id} has syllabus_id=${row.syllabusId}; expected ${syllabusId}`);
		}
		if (seenCodes.has(row.code)) {
			throw new SyllabusValidationError(`duplicate code "${row.code}" within syllabus ${syllabusId}`);
		}
		seenCodes.add(row.code);
		byId.set(row.id, row);
	}
	const childrenByParent = new Map<string, NewSyllabusNodeRow[]>();
	for (const row of rows) {
		if (row.level === SYLLABUS_NODE_LEVELS.AREA) {
			if (row.parentId !== null && row.parentId !== undefined) {
				throw new SyllabusValidationError(`area row "${row.code}" must have parent_id=null`);
			}
			continue;
		}
		if (row.parentId === null || row.parentId === undefined) {
			throw new SyllabusValidationError(`row "${row.code}" (level=${row.level}) must have a parent_id`);
		}
		if (!byId.has(row.parentId)) {
			throw new SyllabusValidationError(`row "${row.code}" parent_id=${row.parentId} not present in input`);
		}
		const list = childrenByParent.get(row.parentId) ?? [];
		list.push(row);
		childrenByParent.set(row.parentId, list);
	}

	// Cycle check.
	for (const row of rows) {
		const visited = new Set<string>();
		let cur: string | null | undefined = row.parentId;
		while (cur !== null && cur !== undefined) {
			if (cur === row.id) {
				throw new SyllabusValidationError(`row "${row.code}" is its own ancestor (cycle)`);
			}
			if (visited.has(cur)) break;
			visited.add(cur);
			cur = byId.get(cur)?.parentId;
		}
	}

	const isAcsOrPts = syllabusKind === 'acs' || syllabusKind === 'pts';
	const validTriads = new Set<string>(ACS_TRIAD_VALUES);

	for (const row of rows) {
		const declaredLeaf = row.isLeaf === true;
		const hasChildren = (childrenByParent.get(row.id) ?? []).length > 0;
		if (declaredLeaf && hasChildren) {
			throw new SyllabusValidationError(`row "${row.code}" is_leaf=true but has children in input`);
		}
		if (!declaredLeaf && !hasChildren && row.level !== SYLLABUS_NODE_LEVELS.AREA) {
			// A non-area node with no children should be a leaf.
			throw new SyllabusValidationError(`row "${row.code}" (level=${row.level}) has no children but is_leaf=false`);
		}

		if (declaredLeaf) {
			if (row.requiredBloom === null || row.requiredBloom === undefined) {
				throw new SyllabusValidationError(`leaf row "${row.code}" must declare required_bloom`);
			}
			if (isAcsOrPts) {
				if (row.airbossRef === null || row.airbossRef === undefined) {
					throw new SyllabusValidationError(`leaf row "${row.code}" on an ACS / PTS syllabus must declare airboss_ref`);
				}
			}
		}

		if (row.level === SYLLABUS_NODE_LEVELS.ELEMENT) {
			if (isAcsOrPts) {
				if (row.triad === null || row.triad === undefined || !validTriads.has(row.triad)) {
					throw new SyllabusValidationError(`element row "${row.code}" on ACS / PTS must declare a triad`);
				}
			}
		} else if (row.triad !== null && row.triad !== undefined) {
			throw new SyllabusValidationError(`row "${row.code}" (level=${row.level}) must not declare a triad`);
		}

		if (row.airbossRef !== null && row.airbossRef !== undefined) {
			validateAirbossRefForLeaf(row.airbossRef, { syllabusKind });
		}
	}
}

// ---------------------------------------------------------------------------
// Build helpers (consumed by the seed)
// ---------------------------------------------------------------------------

/** Upsert a syllabus row by primary key. Idempotent across re-seeds. */
export async function upsertSyllabus(input: NewSyllabusRow, db: Db = defaultDb): Promise<SyllabusRow> {
	const [row] = await db
		.insert(syllabus)
		.values(input)
		.onConflictDoUpdate({
			target: syllabus.id,
			set: {
				slug: input.slug,
				kind: input.kind,
				title: input.title,
				edition: input.edition,
				sourceUrl: input.sourceUrl,
				status: input.status,
				supersededById: input.supersededById,
				referenceId: input.referenceId,
				seedOrigin: input.seedOrigin,
				updatedAt: new Date(),
			},
		})
		.returning();
	if (!row) throw new Error(`upsertSyllabus failed for ${input.id}`);
	return row;
}

/** Upsert a syllabus_node row. Idempotent. */
export async function upsertSyllabusNode(input: NewSyllabusNodeRow, db: Db = defaultDb): Promise<SyllabusNodeRow> {
	const [row] = await db
		.insert(syllabusNode)
		.values(input)
		.onConflictDoUpdate({
			target: syllabusNode.id,
			set: {
				syllabusId: input.syllabusId,
				parentId: input.parentId,
				level: input.level,
				ordinal: input.ordinal,
				code: input.code,
				title: input.title,
				description: input.description,
				triad: input.triad,
				requiredBloom: input.requiredBloom,
				isLeaf: input.isLeaf,
				airbossRef: input.airbossRef,
				citations: input.citations,
				classes: input.classes,
				contentHash: input.contentHash,
				seedOrigin: input.seedOrigin,
				updatedAt: new Date(),
			},
		})
		.returning();
	if (!row) throw new Error(`upsertSyllabusNode failed for ${input.id}`);
	return row;
}

/**
 * Replace every syllabus_node_link for a leaf with the provided list. Used
 * by the seed to rewrite link sets idempotently when the YAML changes.
 *
 * Wraps in a transaction so the leaf doesn't end up half-linked between the
 * delete and insert.
 */
export async function replaceSyllabusNodeLinks(
	syllabusNodeId: string,
	links: readonly NewSyllabusNodeLinkRow[],
	db: Db = defaultDb,
): Promise<SyllabusNodeLinkRow[]> {
	const linkRows = links.map((l) => ({ ...l, syllabusNodeId }));
	return db.transaction(async (tx) => {
		await tx.delete(syllabusNodeLink).where(eq(syllabusNodeLink.syllabusNodeId, syllabusNodeId));
		if (linkRows.length === 0) return [];
		const result = await tx.insert(syllabusNodeLink).values(linkRows).returning();
		return result;
	});
}

/**
 * Returns the proposed leaf-level level value when an authored YAML node
 * has no children. Helper for the seed: callers don't have to know the
 * parent-level rules to decide if this row is a leaf.
 *
 * `is_leaf=true` ONLY applies to non-area, non-chapter levels per the
 * underlying CHECK; this helper enforces the same rule so the seed
 * produces consistent rows.
 */
export function levelIsLeafEligible(level: SyllabusNodeLevel): boolean {
	return level !== SYLLABUS_NODE_LEVELS.AREA && level !== SYLLABUS_NODE_LEVELS.CHAPTER;
}
