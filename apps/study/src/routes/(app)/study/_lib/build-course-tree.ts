/**
 * Course map projection -- the FAR-navigation course at
 * `course/regulations/`.
 *
 * Top level: weeks 1-10 (plus an "orals" group for the cumulative
 * scenario lessons in `course/regulations/orals/`). Second level: each
 * lesson under its week. Per-lesson rollup walks the authored
 * `cites:` block (knowledge_nodes + acs_leaves) and rolls evidence
 * state via `getNodeEvidenceStateMap` over the union of linked
 * knowledge nodes, plus per-leaf mastery for the cited ACS leaves.
 *
 * Lessons that cite only `handbook_sections` (no knowledge_nodes,
 * no acs_leaves) render as "(reading)" badges -- they contribute to
 * the week's lesson count but not to the mastery rollup.
 *
 * The lesson tree is parsed once at module load (cached) since lesson
 * markdown ships with the deploy. Dev-mode invalidation is a future
 * nice-to-have; today the page will pick up new lessons after a server
 * restart.
 */

import { getKnowledgeNodesForSyllabusLeaves, getNodeEvidenceStateMap, type NodeEvidenceState } from '@ab/bc-study/server';
import { db as defaultDb } from '@ab/db/connection';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type LessonRecord, listLessonsCached } from './lesson-tree';
import type { MapNode } from './map-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Public entry point. The tree is grouped by week 1-10; the
 * `orals/` lessons carry `week: 10` in their frontmatter so they
 * fold into the capstone week alongside `week-10-capstone/`.
 */
export async function buildCourseTree(userId: string, db: Db = defaultDb): Promise<MapNode[]> {
	const lessons = await listLessonsCached();
	if (lessons.length === 0) return [];

	// Resolve `cites.knowledge_nodes` slugs to knowledge_node ids and
	// `cites.acs_leaves` codes to syllabus_node ids in two batched
	// lookups.
	const knowledgeSlugs = new Set<string>();
	const acsCodes = new Set<string>();
	for (const lesson of lessons) {
		for (const slug of lesson.cites.knowledge_nodes) knowledgeSlugs.add(slug);
		for (const code of lesson.cites.acs_leaves) acsCodes.add(code);
	}
	const [slugToNodeId, codeToLeafId] = await Promise.all([
		resolveKnowledgeSlugsToIds([...knowledgeSlugs], db),
		resolveAcsCodesToLeafIds([...acsCodes], db),
	]);

	// All linked knowledge node ids, plus the linked-knowledge-node ids
	// reachable via the cited ACS leaves (one query for the leaves' link
	// table). We pool them all for a single batched evidence-state read.
	const allKnowledgeNodeIds = new Set<string>();
	for (const id of slugToNodeId.values()) allKnowledgeNodeIds.add(id);

	const leafIds = [...codeToLeafId.values()];
	const linkedByLeaf =
		leafIds.length === 0
			? new Map<string, Array<{ node: { id: string }; weight: number }>>()
			: await getKnowledgeNodesForSyllabusLeaves(leafIds, {}, db);
	for (const list of linkedByLeaf.values()) {
		for (const link of list) allKnowledgeNodeIds.add(link.node.id);
	}

	const nodeStateMap =
		allKnowledgeNodeIds.size === 0
			? new Map<string, NodeEvidenceState>()
			: await getNodeEvidenceStateMap(userId, [...allKnowledgeNodeIds], db);

	// Group lessons by week.
	const lessonsByWeek = new Map<number, LessonRecord[]>();
	for (const lesson of lessons) {
		const list = lessonsByWeek.get(lesson.week) ?? [];
		list.push(lesson);
		lessonsByWeek.set(lesson.week, list);
	}
	for (const list of lessonsByWeek.values()) {
		list.sort((a, b) => a.sectionOrder.localeCompare(b.sectionOrder));
	}

	// Render the projection tree.
	const weeks = [...lessonsByWeek.keys()].sort((a, b) => a - b);
	const tree: MapNode[] = [];
	for (const week of weeks) {
		const lessonRecords = lessonsByWeek.get(week) ?? [];
		const children: MapNode[] = lessonRecords.map((lesson) =>
			buildLessonNode(lesson, slugToNodeId, codeToLeafId, linkedByLeaf, nodeStateMap),
		);
		const totalsForWeek = children.reduce(
			(acc, c) => {
				if (c.rollup === null) return acc;
				return {
					mastered: acc.mastered + c.rollup.masteredLeaves,
					covered: acc.covered + c.rollup.coveredLeaves,
					total: acc.total + c.rollup.totalLeaves,
				};
			},
			{ mastered: 0, covered: 0, total: 0 },
		);
		tree.push({
			id: `course-week-${week}`,
			label: weekLabel(week),
			level: 'group',
			code: `Wk ${week}`,
			rollup:
				totalsForWeek.total === 0
					? null
					: {
							masteredLeaves: totalsForWeek.mastered,
							coveredLeaves: totalsForWeek.covered,
							totalLeaves: totalsForWeek.total,
						},
			children,
		});
	}
	return tree;
}

function buildLessonNode(
	lesson: LessonRecord,
	slugToNodeId: Map<string, string>,
	codeToLeafId: Map<string, string>,
	linkedByLeaf: Map<string, Array<{ node: { id: string }; weight: number }>>,
	nodeStateMap: Map<string, NodeEvidenceState>,
): MapNode {
	const knowledgeIds: string[] = [];
	for (const slug of lesson.cites.knowledge_nodes) {
		const id = slugToNodeId.get(slug);
		if (id !== undefined) knowledgeIds.push(id);
	}
	for (const code of lesson.cites.acs_leaves) {
		const leafId = codeToLeafId.get(code);
		if (leafId === undefined) continue;
		const links = linkedByLeaf.get(leafId) ?? [];
		for (const link of links) knowledgeIds.push(link.node.id);
	}

	// Reading-only lesson (handbook_sections only): no rollup, "(reading)"
	// badge.
	const isReading =
		lesson.cites.knowledge_nodes.length === 0 &&
		lesson.cites.acs_leaves.length === 0 &&
		lesson.cites.handbook_sections.length > 0;

	if (isReading || knowledgeIds.length === 0) {
		return {
			id: lesson.id,
			label: lesson.title,
			level: 'leaf',
			code: lesson.sectionOrder,
			rollup: null,
			badge: lesson.cites.handbook_sections.length > 0 && knowledgeIds.length === 0 ? '(reading)' : undefined,
			children: [],
		};
	}

	let mastered = 0;
	let covered = 0;
	const seen = new Set<string>();
	for (const id of knowledgeIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		const state = nodeStateMap.get(id);
		if (state === undefined) continue;
		const anyEvidence =
			state.recall !== 'not_applicable' ||
			state.calculation !== 'not_applicable' ||
			state.scenario !== 'not_applicable' ||
			state.demonstration !== 'not_applicable' ||
			state.teaching !== 'not_applicable';
		const masteredAny =
			state.recall === 'pass' ||
			state.calculation === 'pass' ||
			state.scenario === 'pass' ||
			state.demonstration === 'pass' ||
			state.teaching === 'pass';
		if (anyEvidence) covered += 1;
		if (masteredAny) mastered += 1;
	}
	return {
		id: lesson.id,
		label: lesson.title,
		level: 'leaf',
		code: lesson.sectionOrder,
		rollup: { masteredLeaves: mastered, coveredLeaves: covered, totalLeaves: seen.size },
		children: [],
	};
}

function weekLabel(week: number): string {
	const titles: Record<number, string> = {
		1: 'Architecture of Title 14',
		2: 'Part 61 -- the pilot (certificates and currency)',
		3: 'Part 61 -- the CFI (subpart H, endorsements)',
		4: 'Part 91 -- general + flight rules',
		5: 'Part 91 -- equipment + maintenance',
		6: 'Part 91 -- special operations',
		7: 'Parts 141 + 135 -- the operation',
		8: 'Companion documents',
		9: 'Enforcement + NTSB Part 830',
		10: 'Capstone -- integrated oral',
	};
	return `Week ${week}: ${titles[week] ?? ''}`.trim();
}

async function resolveKnowledgeSlugsToIds(slugs: string[], db: Db): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	if (slugs.length === 0) return out;
	// Knowledge nodes use the slug as the primary key id (per ADR 011 +
	// the seed pipeline). Confirm via a row read so a stale cite (slug
	// renamed under us) is silently dropped from the rollup, with an
	// optional dev-mode warning per spec edge cases.
	const ids = slugs.map((slug) => slug);
	const rows = await db.execute(
		sql`SELECT id FROM study.knowledge_node WHERE id = ANY(ARRAY[${sql.join(
			ids.map((id) => sql`${id}`),
			sql`, `,
		)}]::text[])`,
	);
	type Row = { id: string };
	const rowList = rows as unknown as Row[];
	for (const row of rowList) {
		out.set(row.id, row.id);
	}
	return out;
}

async function resolveAcsCodesToLeafIds(codes: string[], db: Db): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	if (codes.length === 0) return out;
	// `study.syllabus_node.code` carries the `<area>.<task>.<element>` form
	// (`V.A.K1`). The authored `cites.acs_leaves` use `PA.<area>.<task>.<triad><ordinal>`,
	// which we split on the leading `PA.` prefix before lookup.
	const lookupCodes: string[] = [];
	const reverse = new Map<string, string>();
	for (const code of codes) {
		const stripped = code.startsWith('PA.') ? code.slice(3) : code;
		lookupCodes.push(stripped);
		reverse.set(stripped, code);
	}
	const rows = await db.execute(
		sql`SELECT id, code FROM study.syllabus_node WHERE code = ANY(ARRAY[${sql.join(
			lookupCodes.map((c) => sql`${c}`),
			sql`, `,
		)}]::text[])`,
	);
	type Row = { id: string; code: string };
	const rowList = rows as unknown as Row[];
	for (const row of rowList) {
		const original = reverse.get(row.code);
		if (original !== undefined) out.set(original, row.id);
	}
	return out;
}
