/**
 * Syllabus BC tests. Pure functions (validators, tree builder, airboss-ref
 * validation) run with no DB; read paths run against real Postgres.
 */

import { bauthUser } from '@ab/auth/schema';
import { SYLLABUS_NODE_LEVELS, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateSyllabusId, generateSyllabusNodeId, generateSyllabusNodeLinkId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knowledgeNode, type NewSyllabusNodeRow, syllabus, syllabusNode, syllabusNodeLink } from './schema';
import {
	AirbossRefValidationError,
	buildSyllabusTreeFromRows,
	getCitationsForSyllabusNode,
	getKnowledgeNodesForSyllabusLeaf,
	getSyllabusArea,
	getSyllabusBySlug,
	getSyllabusLeaves,
	getSyllabusLeavesForKnowledgeNode,
	getSyllabusTree,
	levelIsLeafEligible,
	listSyllabi,
	rebuildKnowledgeNodeRelevanceCache,
	replaceSyllabusNodeLinks,
	SyllabusNotFoundError,
	SyllabusValidationError,
	upsertSyllabus,
	upsertSyllabusNode,
	validateAirbossRefForLeaf,
	validateSyllabusTree,
} from './syllabi';

// -- Pure validators --------------------------------------------------------

describe('validateAirbossRefForLeaf', () => {
	it('accepts a well-formed acs identifier on an acs syllabus', () => {
		expect(() =>
			validateAirbossRefForLeaf('airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1', {
				syllabusKind: 'acs',
			}),
		).not.toThrow();
	});

	it('rejects a malformed identifier', () => {
		expect(() => validateAirbossRefForLeaf('not-an-airboss-ref', { syllabusKind: 'acs' })).toThrowError(
			AirbossRefValidationError,
		);
	});

	it('rejects an unknown corpus', () => {
		expect(() =>
			validateAirbossRefForLeaf('airboss-ref:made-up-corpus/something', { syllabusKind: 'acs' }),
		).toThrowError(AirbossRefValidationError);
	});

	it('rejects an non-acs corpus on an acs syllabus', () => {
		expect(() =>
			validateAirbossRefForLeaf('airboss-ref:handbooks/phak/8083-25C/12/3', { syllabusKind: 'acs' }),
		).toThrowError(AirbossRefValidationError);
	});

	it('rejects acs identifier whose locator does not parse', () => {
		expect(() =>
			validateAirbossRefForLeaf('airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-x9', {
				syllabusKind: 'acs',
			}),
		).toThrowError(AirbossRefValidationError);
	});

	it('accepts non-acs corpora on a school / personal syllabus', () => {
		expect(() =>
			validateAirbossRefForLeaf('airboss-ref:handbooks/phak/8083-25C/12/3', { syllabusKind: 'school' }),
		).not.toThrow();
	});
});

describe('validateSyllabusTree', () => {
	const SYL_ID = 'syl_test_validate';

	function makeRow(over: Partial<NewSyllabusNodeRow>): NewSyllabusNodeRow {
		return {
			id: 'sln_test',
			syllabusId: SYL_ID,
			parentId: null,
			level: SYLLABUS_NODE_LEVELS.AREA,
			ordinal: 0,
			code: 'I',
			title: 'Test',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: null,
			...over,
		};
	}

	it('accepts a minimal area-only tree (areas can be leafless)', () => {
		const rows: NewSyllabusNodeRow[] = [makeRow({ id: 'sln_a', code: 'I', isLeaf: false })];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'acs', rows })).not.toThrow();
	});

	it('accepts a complete area->task->element shape on an ACS syllabus', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a', code: 'I', isLeaf: false }),
			makeRow({
				id: 't',
				code: 'I.A',
				level: SYLLABUS_NODE_LEVELS.TASK,
				parentId: 'a',
				ordinal: 0,
				isLeaf: false,
			}),
			makeRow({
				id: 'k',
				code: 'I.A.K1',
				level: SYLLABUS_NODE_LEVELS.ELEMENT,
				parentId: 't',
				ordinal: 0,
				triad: 'knowledge',
				requiredBloom: 'understand',
				isLeaf: true,
				airbossRef: 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-i/task-a/element-k1',
			}),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'acs', rows })).not.toThrow();
	});

	it('rejects a duplicate code', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a1', code: 'I', isLeaf: false }),
			makeRow({ id: 'a2', code: 'I', isLeaf: false }),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'school', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects an area with a parent_id', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a1', code: 'I', isLeaf: false }),
			makeRow({ id: 'a2', code: 'II', isLeaf: false, parentId: 'a1' }),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'school', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects a non-area without parent_id', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({
				id: 't',
				code: 'I.A',
				level: SYLLABUS_NODE_LEVELS.TASK,
				parentId: null,
				ordinal: 0,
				isLeaf: false,
			}),
		];
		// A task with no children + no parent fails parent-required check
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'school', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects a parent_id that points outside the input', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({
				id: 't',
				code: 'I.A',
				level: SYLLABUS_NODE_LEVELS.TASK,
				parentId: 'orphan',
				ordinal: 0,
				isLeaf: false,
			}),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'school', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects an ACS element without triad', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a', code: 'I', isLeaf: false }),
			makeRow({
				id: 't',
				code: 'I.A',
				level: SYLLABUS_NODE_LEVELS.TASK,
				parentId: 'a',
				ordinal: 0,
				isLeaf: false,
			}),
			makeRow({
				id: 'k',
				code: 'I.A.K1',
				level: SYLLABUS_NODE_LEVELS.ELEMENT,
				parentId: 't',
				ordinal: 0,
				triad: null,
				requiredBloom: 'understand',
				isLeaf: true,
				airbossRef: 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-i/task-a/element-k1',
			}),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'acs', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects an ACS leaf without airboss_ref', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a', code: 'I', isLeaf: false }),
			makeRow({
				id: 't',
				code: 'I.A',
				level: SYLLABUS_NODE_LEVELS.TASK,
				parentId: 'a',
				ordinal: 0,
				isLeaf: false,
			}),
			makeRow({
				id: 'k',
				code: 'I.A.K1',
				level: SYLLABUS_NODE_LEVELS.ELEMENT,
				parentId: 't',
				ordinal: 0,
				triad: 'knowledge',
				requiredBloom: 'understand',
				isLeaf: true,
				airbossRef: null,
			}),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'acs', rows })).toThrowError(
			SyllabusValidationError,
		);
	});

	it('rejects a leaf without required_bloom', () => {
		const rows: NewSyllabusNodeRow[] = [
			makeRow({ id: 'a', code: 'I', isLeaf: false }),
			makeRow({
				id: 'sec',
				code: 'I.1',
				level: SYLLABUS_NODE_LEVELS.SECTION,
				parentId: 'a',
				ordinal: 0,
				isLeaf: true,
				requiredBloom: null,
			}),
		];
		expect(() => validateSyllabusTree({ syllabusId: SYL_ID, syllabusKind: 'school', rows })).toThrowError(
			SyllabusValidationError,
		);
	});
});

describe('buildSyllabusTreeFromRows', () => {
	function row(id: string, parent: string | null, ordinal: number, level = 'area'): NewSyllabusNodeRow {
		return {
			id,
			syllabusId: 'syl_test',
			parentId: parent,
			level,
			ordinal,
			code: id,
			title: id,
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: null,
		};
	}

	it('builds a parent->children tree ordered by ordinal', () => {
		const rows = [row('a', null, 0), row('b', null, 1), row('a1', 'a', 0, 'task'), row('a2', 'a', 1, 'task')];
		const tree = buildSyllabusTreeFromRows(
			rows.map((r) => ({ ...r, createdAt: new Date(), updatedAt: new Date() })) as never,
		);
		expect(tree.length).toBe(2);
		expect(tree[0]?.row.id).toBe('a');
		expect(tree[0]?.children.map((c) => c.row.id)).toEqual(['a1', 'a2']);
	});
});

describe('levelIsLeafEligible', () => {
	it('returns false for area / chapter and true otherwise', () => {
		expect(levelIsLeafEligible('area')).toBe(false);
		expect(levelIsLeafEligible('chapter')).toBe(false);
		expect(levelIsLeafEligible('task')).toBe(true);
		expect(levelIsLeafEligible('element')).toBe(true);
		expect(levelIsLeafEligible('section')).toBe(true);
		expect(levelIsLeafEligible('subsection')).toBe(true);
	});
});

// -- DB-backed tests --------------------------------------------------------

const SUITE_TAG = `syl-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');
const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const TEST_USER_ID = generateAuthId();
const SYL_ID = generateSyllabusId();
const SYL_SLUG = slug('syl-bc-test');
const AREA_ID = generateSyllabusNodeId();
const TASK_ID = generateSyllabusNodeId();
const K1_ID = generateSyllabusNodeId();
const KN_NODE_ID = `kn-${SUITE_TAG}-1`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: `${SUITE_TAG}@airboss.test`,
		name: 'syl test',
		firstName: 'syl',
		lastName: 'test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(syllabus).values({
		id: SYL_ID,
		slug: SYL_SLUG,
		kind: 'acs',
		title: 'Test ACS',
		edition: `faa-s-acs-test-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(syllabusNode).values([
		{
			id: AREA_ID,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V`,
			title: 'Performance Maneuvers',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: TASK_ID,
			syllabusId: SYL_ID,
			parentId: AREA_ID,
			level: 'task',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A`,
			title: 'Steep Turns',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [
				{
					kind: 'handbook',
					reference_id: 'ref_phak',
					locator: { chapter: 5 },
					framing: 'survey',
				},
			],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: K1_ID,
			syllabusId: SYL_ID,
			parentId: TASK_ID,
			level: 'element',
			ordinal: 1,
			code: `${SUITE_TOKEN}-V.A.K1`,
			title: 'Aerodynamics of steep turns',
			description: 'Aerodynamic forces in steep turns.',
			triad: 'knowledge',
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: 'airboss-ref:acs/ppl-asel/faa-s-acs-25/area-v/task-a/element-k1',
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	await db.insert(knowledgeNode).values({
		id: KN_NODE_ID,
		title: 'aerodynamics test node',
		domain: 'aerodynamics',
		crossDomains: [],
		knowledgeTypes: [],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: [],
		assessable: false,
		assessmentMethods: [],
		masteryCriteria: null,
		seedOrigin: SUITE_TAG,
		contentMd: 'test',
		contentHash: null,
		version: 1,
		authorId: null,
		lifecycle: null,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(syllabusNodeLink).values({
		id: generateSyllabusNodeLinkId(),
		syllabusNodeId: K1_ID,
		knowledgeNodeId: KN_NODE_ID,
		weight: 0.8,
		notes: '',
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
});

afterAll(async () => {
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('listSyllabi / getSyllabusBy*', () => {
	it('returns the seeded syllabus', async () => {
		const rows = await listSyllabi({ kind: 'acs' });
		expect(rows.some((r) => r.slug === SYL_SLUG)).toBe(true);
	});

	it('throws SyllabusNotFoundError on unknown slug', async () => {
		await expect(getSyllabusBySlug('not-a-syllabus')).rejects.toBeInstanceOf(SyllabusNotFoundError);
	});

	it('returns the row by slug', async () => {
		const row = await getSyllabusBySlug(SYL_SLUG);
		expect(row.id).toBe(SYL_ID);
	});
});

describe('getSyllabusTree / getSyllabusArea / getSyllabusLeaves', () => {
	it('returns every node in the seeded syllabus', async () => {
		const tree = await getSyllabusTree(SYL_ID);
		expect(tree.length).toBe(3);
	});

	it('returns the area + task + elements via getSyllabusArea', async () => {
		const view = await getSyllabusArea(SYL_ID, `${SUITE_TOKEN}-V`);
		expect(view.area.id).toBe(AREA_ID);
		expect(view.tasks.length).toBe(1);
		expect(view.elements.length).toBe(1);
	});

	it('returns only leaves via getSyllabusLeaves', async () => {
		const leaves = await getSyllabusLeaves(SYL_ID);
		expect(leaves.length).toBe(1);
		expect(leaves[0]?.id).toBe(K1_ID);
	});
});

describe('getCitationsForSyllabusNode', () => {
	it('returns the inline citations array', async () => {
		const cites = await getCitationsForSyllabusNode(TASK_ID);
		expect(cites.length).toBe(1);
		expect(cites[0]?.kind).toBe('handbook');
	});

	it('returns empty for a node with no citations', async () => {
		const cites = await getCitationsForSyllabusNode(K1_ID);
		expect(cites).toEqual([]);
	});
});

describe('getKnowledgeNodesForSyllabusLeaf', () => {
	it('returns the linked nodes with weight', async () => {
		const links = await getKnowledgeNodesForSyllabusLeaf(K1_ID);
		expect(links.length).toBe(1);
		expect(links[0]?.node.id).toBe(KN_NODE_ID);
		expect(links[0]?.weight).toBeCloseTo(0.8);
	});

	it('passes class-agnostic leaves through every class filter', async () => {
		// K1_ID's syllabus_node has classes=null. Any class filter must let it
		// pass.
		const links = await getKnowledgeNodesForSyllabusLeaf(K1_ID, { classes: ['amel', 'ames'] });
		expect(links.length).toBe(1);
	});
});

describe('getSyllabusLeavesForKnowledgeNode', () => {
	it('reverses the link walk', async () => {
		const rows = await getSyllabusLeavesForKnowledgeNode(KN_NODE_ID);
		expect(rows.length).toBe(1);
		expect(rows[0]?.leaf.id).toBe(K1_ID);
		expect(rows[0]?.syllabus.id).toBe(SYL_ID);
	});

	it('passes class-agnostic leaves through every class filter', async () => {
		const rows = await getSyllabusLeavesForKnowledgeNode(KN_NODE_ID, { classes: ['asel'] });
		expect(rows.length).toBe(1);
	});
});

describe('replaceSyllabusNodeLinks', () => {
	it('replaces the link list for a leaf transactionally', async () => {
		// Add an extra link, then replace with a smaller set, verify count.
		const otherNodeId = `kn-${SUITE_TAG}-2`;
		const now = new Date();
		await db.insert(knowledgeNode).values({
			id: otherNodeId,
			title: 'other node',
			domain: 'aerodynamics',
			crossDomains: [],
			knowledgeTypes: [],
			technicalDepth: null,
			stability: null,
			minimumCert: null,
			studyPriority: null,
			modalities: [],
			estimatedTimeMinutes: null,
			reviewTimeMinutes: null,
			references: [],
			assessable: false,
			assessmentMethods: [],
			masteryCriteria: null,
			seedOrigin: SUITE_TAG,
			contentMd: 'test',
			contentHash: null,
			version: 1,
			authorId: null,
			lifecycle: null,
			createdAt: now,
			updatedAt: now,
		});

		await replaceSyllabusNodeLinks(K1_ID, [
			{
				id: generateSyllabusNodeLinkId(),
				syllabusNodeId: K1_ID,
				knowledgeNodeId: KN_NODE_ID,
				weight: 1.0,
				notes: '',
				seedOrigin: SUITE_TAG,
				createdAt: now,
			},
			{
				id: generateSyllabusNodeLinkId(),
				syllabusNodeId: K1_ID,
				knowledgeNodeId: otherNodeId,
				weight: 0.5,
				notes: '',
				seedOrigin: SUITE_TAG,
				createdAt: now,
			},
		]);
		const links = await getKnowledgeNodesForSyllabusLeaf(K1_ID);
		expect(links.length).toBe(2);

		await replaceSyllabusNodeLinks(K1_ID, [
			{
				id: generateSyllabusNodeLinkId(),
				syllabusNodeId: K1_ID,
				knowledgeNodeId: KN_NODE_ID,
				weight: 0.8,
				notes: '',
				seedOrigin: SUITE_TAG,
				createdAt: now,
			},
		]);
		const after = await getKnowledgeNodesForSyllabusLeaf(K1_ID);
		expect(after.length).toBe(1);
		expect(after[0]?.weight).toBeCloseTo(0.8);
	});
});

describe('upsertSyllabus / upsertSyllabusNode', () => {
	it('upsertSyllabus is idempotent', async () => {
		const id = generateSyllabusId();
		const localSlug = slug('upsert-syllabus');
		const now = new Date();
		await upsertSyllabus({
			id,
			slug: localSlug,
			kind: 'school',
			title: 'Upsert',
			edition: 'v1',
			status: SYLLABUS_STATUSES.DRAFT,
			supersededById: null,
			referenceId: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		await upsertSyllabus({
			id,
			slug: localSlug,
			kind: 'school',
			title: 'Upsert (renamed)',
			edition: 'v1',
			status: SYLLABUS_STATUSES.DRAFT,
			supersededById: null,
			referenceId: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const row = await getSyllabusBySlug(localSlug);
		expect(row.title).toBe('Upsert (renamed)');
	});

	it('upsertSyllabusNode is idempotent', async () => {
		const id = generateSyllabusNodeId();
		const now = new Date();
		await upsertSyllabusNode({
			id,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 99,
			code: `${SUITE_TOKEN}-test-upsert`,
			title: 'orig',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		await upsertSyllabusNode({
			id,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 99,
			code: `${SUITE_TOKEN}-test-upsert`,
			title: 'updated',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(syllabusNode).where(eq(syllabusNode.id, id));
		expect(rows[0]?.title).toBe('updated');
	});
});

describe('rebuildKnowledgeNodeRelevanceCache (placeholder)', () => {
	it('returns a zero report; full impl ships in phase 18', async () => {
		const report = await rebuildKnowledgeNodeRelevanceCache({ dryRun: true });
		expect(report.dryRun).toBe(true);
		expect(report.knowledgeNodesUpdated).toBe(0);
	});
});

describe('syllabus_node.classes column (Phase 14 schema delta)', () => {
	it('accepts NULL (class-agnostic, the common case)', async () => {
		const id = generateSyllabusNodeId();
		const now = new Date();
		await upsertSyllabusNode({
			id,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 200,
			code: `${SUITE_TOKEN}-classes-null`,
			title: 'class-agnostic area',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			classes: null,
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(syllabusNode).where(eq(syllabusNode.id, id));
		expect(rows[0]?.classes).toBeNull();
	});

	it('accepts a non-empty subset of AIRPLANE_CLASS_VALUES', async () => {
		const id = generateSyllabusNodeId();
		const now = new Date();
		await upsertSyllabusNode({
			id,
			syllabusId: SYL_ID,
			parentId: null,
			level: 'area',
			ordinal: 201,
			code: `${SUITE_TOKEN}-classes-amel-ames`,
			title: 'AMEL/AMES-only task',
			description: '',
			triad: null,
			requiredBloom: null,
			isLeaf: false,
			airbossRef: null,
			citations: [],
			classes: ['amel', 'ames'],
			contentHash: null,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const rows = await db.select().from(syllabusNode).where(eq(syllabusNode.id, id));
		expect(rows[0]?.classes).toStrictEqual(['amel', 'ames']);
	});

	it('rejects an empty array (use NULL for class-agnostic)', async () => {
		const id = generateSyllabusNodeId();
		const now = new Date();
		await expect(
			upsertSyllabusNode({
				id,
				syllabusId: SYL_ID,
				parentId: null,
				level: 'area',
				ordinal: 202,
				code: `${SUITE_TOKEN}-classes-empty`,
				title: 'empty classes',
				description: '',
				triad: null,
				requiredBloom: null,
				isLeaf: false,
				airbossRef: null,
				citations: [],
				classes: [],
				contentHash: null,
				seedOrigin: SUITE_TAG,
				createdAt: now,
				updatedAt: now,
			}),
		).rejects.toThrow();
	});

	it('rejects a value outside AIRPLANE_CLASS_VALUES', async () => {
		const id = generateSyllabusNodeId();
		const now = new Date();
		await expect(
			upsertSyllabusNode({
				id,
				syllabusId: SYL_ID,
				parentId: null,
				level: 'area',
				ordinal: 203,
				code: `${SUITE_TOKEN}-classes-bogus`,
				title: 'bogus class',
				description: '',
				triad: null,
				requiredBloom: null,
				isLeaf: false,
				airbossRef: null,
				citations: [],
				classes: ['helicopter'],
				contentHash: null,
				seedOrigin: SUITE_TAG,
				createdAt: now,
				updatedAt: now,
			}),
		).rejects.toThrow();
	});
});
