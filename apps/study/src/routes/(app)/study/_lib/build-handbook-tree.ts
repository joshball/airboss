/**
 * Handbook map projection -- shows FAA references with at least one
 * citing knowledge node.
 *
 * Top level: handbooks (PHAK / AFH / AvWX / IFH / IPH / etc.). One row per
 * non-superseded reference whose union of citing knowledge nodes is
 * non-empty.
 *
 * Second level: chapter rows from `reference_section` with `level =
 * 'chapter'`. Per-chapter rollup pulls every node that cites the chapter
 * (`getNodesCitingSection`, one round trip per (reference, chapter)) and
 * rolls evidence-state via `getNodeEvidenceStateMap`.
 *
 * Auto-expand: the handbook + chapter holding the focus leaf's primary
 * handbook citation. The loader supplies the focus citation; this builder
 * doesn't re-derive it.
 */

import {
	getNodeEvidenceStateMap,
	getNodesCitingSection,
	listHandbookChapters,
	listReferences,
	type NodeEvidenceState,
	type ReferenceSectionRow,
} from '@ab/bc-study';
import { NODE_MASTERY_GATES, REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { MapNode } from './map-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface FocusHandbookCitation {
	referenceId: string;
	chapter: number | null;
}

/**
 * Public entry point.
 *
 * @param userId  user the rollup is computed for
 * @param focus   handbook citation to auto-expand, or null
 * @param db      drizzle handle
 */
export async function buildHandbookTree(
	userId: string,
	focus: FocusHandbookCitation | null,
	db: Db = defaultDb,
): Promise<MapNode[]> {
	const handbookRefs = await listReferences({ kind: REFERENCE_KINDS.HANDBOOK }, db);
	if (handbookRefs.length === 0) return [];

	// Load chapters for every handbook in parallel. N round-trips for N
	// handbooks (~10) is acceptable; a future optimization could batch.
	const chaptersByRef = new Map<string, ReferenceSectionRow[]>();
	await Promise.all(
		handbookRefs.map(async (ref) => {
			const chapters = await listHandbookChapters(ref.id, db);
			chaptersByRef.set(ref.id, chapters);
		}),
	);

	// Per-chapter citing-node lookup. One indexed JSONB-containment query per
	// (reference, chapter); we fan out across all chapters and pool the
	// resulting node ids for a single batched evidence-state query.
	const citingByChapter = new Map<string, string[]>(); // chapterId -> nodeIds
	const allNodeIds = new Set<string>();
	const fetches: Promise<void>[] = [];
	for (const ref of handbookRefs) {
		const chapters = chaptersByRef.get(ref.id) ?? [];
		for (const chapter of chapters) {
			const chapterNumber = Number.parseInt(chapter.code, 10);
			if (!Number.isFinite(chapterNumber)) continue;
			fetches.push(
				(async () => {
					const nodes = await getNodesCitingSection({ referenceId: ref.id, chapter: chapterNumber }, db);
					const ids = nodes.map((n) => n.id);
					citingByChapter.set(chapter.id, ids);
					for (const id of ids) allNodeIds.add(id);
				})(),
			);
		}
	}
	await Promise.all(fetches);

	// Single batched evidence-state query over the union of citing nodes.
	const nodeStateMap =
		allNodeIds.size === 0
			? new Map<string, NodeEvidenceState>()
			: await getNodeEvidenceStateMap(userId, [...allNodeIds], db);

	// Render the tree. Hide handbooks with no citing chapters.
	const tree: MapNode[] = [];
	for (const ref of handbookRefs) {
		const chapters = chaptersByRef.get(ref.id) ?? [];
		const childChapters: MapNode[] = [];
		let refMastered = 0;
		let refCovered = 0;
		let refTotal = 0;
		const focusChapter = focus !== null && focus.referenceId === ref.id ? focus.chapter : null;
		for (const chapter of chapters) {
			const nodeIds = citingByChapter.get(chapter.id) ?? [];
			if (nodeIds.length === 0) continue; // Hide chapters without citing nodes.
			const { mastered, covered } = rollupOverNodes(nodeIds, nodeStateMap);
			const total = nodeIds.length;
			refMastered += mastered;
			refCovered += covered;
			refTotal += total;
			const chapterNumber = Number.parseInt(chapter.code, 10);
			const isFocusChapter = focusChapter !== null && Number.isFinite(chapterNumber) && chapterNumber === focusChapter;
			childChapters.push({
				id: chapter.id,
				label: chapter.title,
				level: 'subgroup',
				code: chapter.code,
				rollup: { masteredLeaves: mastered, coveredLeaves: covered, totalLeaves: total },
				href: Number.isFinite(chapterNumber)
					? ROUTES.LIBRARY_HANDBOOK_CHAPTER(ref.documentSlug, chapterNumber)
					: ROUTES.LIBRARY_HANDBOOK(ref.documentSlug),
				children: [],
				defaultOpen: isFocusChapter,
			});
		}
		if (childChapters.length === 0) continue; // Hide handbook with zero citing chapters.
		tree.push({
			id: ref.id,
			label: ref.title,
			level: 'group',
			code: ref.documentSlug.toUpperCase(),
			rollup: { masteredLeaves: refMastered, coveredLeaves: refCovered, totalLeaves: refTotal },
			href: ROUTES.LIBRARY_HANDBOOK(ref.documentSlug),
			children: childChapters,
			defaultOpen: focus !== null && focus.referenceId === ref.id,
		});
	}
	return tree;
}

/**
 * Pure rollup over a set of node ids. `covered` = node has any non-NA gate;
 * `mastered` = node has any PASS gate. Mirrors the loose "covered/mastered"
 * semantic the credential rollup uses but for arbitrary node sets (the
 * Handbook projection doesn't have leaves-with-required-kinds metadata).
 */
export function rollupOverNodes(
	nodeIds: readonly string[],
	stateMap: ReadonlyMap<string, NodeEvidenceState>,
): { mastered: number; covered: number } {
	let mastered = 0;
	let covered = 0;
	for (const id of nodeIds) {
		const state = stateMap.get(id);
		if (state === undefined) continue;
		const anyEvidence =
			state.recall !== NODE_MASTERY_GATES.NOT_APPLICABLE ||
			state.calculation !== NODE_MASTERY_GATES.NOT_APPLICABLE ||
			state.scenario !== NODE_MASTERY_GATES.NOT_APPLICABLE ||
			state.demonstration !== NODE_MASTERY_GATES.NOT_APPLICABLE ||
			state.teaching !== NODE_MASTERY_GATES.NOT_APPLICABLE;
		const masteredAny =
			state.recall === NODE_MASTERY_GATES.PASS ||
			state.calculation === NODE_MASTERY_GATES.PASS ||
			state.scenario === NODE_MASTERY_GATES.PASS ||
			state.demonstration === NODE_MASTERY_GATES.PASS ||
			state.teaching === NODE_MASTERY_GATES.PASS;
		if (anyEvidence) covered += 1;
		if (masteredAny) mastered += 1;
	}
	return { mastered, covered };
}
