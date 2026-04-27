/**
 * Credential BC tests. Real Postgres for read paths; pure-function tests
 * for the cycle-detector + DAG validator.
 *
 * Per-suite scoped fixture so parallel suites don't collide on the unique
 * `credential.slug` constraint or on per-syllabus uniqueness.
 */

import { bauthUser } from '@ab/auth/schema';
import { CREDENTIAL_PREREQ_KINDS, CREDENTIAL_STATUSES, SYLLABUS_PRIMACY, SYLLABUS_STATUSES } from '@ab/constants';
import { db } from '@ab/db';
import {
	generateAuthId,
	generateCredentialId,
	generateSyllabusId,
	generateSyllabusNodeId,
	generateSyllabusNodeLinkId,
} from '@ab/utils';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	CredentialNotFoundError,
	CredentialPrereqCycleError,
	getCertsCoveredBy,
	getCredentialBySlug,
	getCredentialIdsCoveredBy,
	getCredentialMastery,
	getCredentialPrereqDag,
	getCredentialPrereqs,
	getCredentialPrimarySyllabus,
	getCredentialSyllabi,
	listCredentials,
	upsertCredential,
	upsertCredentialPrereq,
	upsertCredentialSyllabus,
	validateCredentialDag,
} from './credentials';
import {
	credential,
	credentialPrereq,
	credentialSyllabus,
	knowledgeNode,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from './schema';

// -- pure cycle-detector tests ---------------------------------------------

describe('validateCredentialDag', () => {
	it('accepts an empty graph', () => {
		expect(() => validateCredentialDag(new Map())).not.toThrow();
	});

	it('accepts a linear chain', () => {
		const adj = new Map<string, string[]>([
			['cfi', ['private', 'commercial']],
			['commercial', ['private']],
			['private', []],
		]);
		expect(() => validateCredentialDag(adj)).not.toThrow();
	});

	it('accepts the user-zero CFI/CFII/MEI shape', () => {
		const adj = new Map<string, string[]>([
			['private', []],
			['commercial', ['private']],
			['instrument', ['private']],
			['cfi', ['commercial', 'private']],
			['cfii', ['cfi', 'instrument']],
			['multi-engine-land', ['private']],
			['mei', ['cfi', 'multi-engine-land']],
			['meii', ['mei', 'instrument']],
		]);
		expect(() => validateCredentialDag(adj)).not.toThrow();
	});

	it('detects a self-cycle', () => {
		const adj = new Map<string, string[]>([['private', ['private']]]);
		expect(() => validateCredentialDag(adj)).toThrowError(CredentialPrereqCycleError);
	});

	it('detects a two-node cycle', () => {
		const adj = new Map<string, string[]>([
			['a', ['b']],
			['b', ['a']],
		]);
		try {
			validateCredentialDag(adj);
			throw new Error('expected throw');
		} catch (e) {
			expect(e).toBeInstanceOf(CredentialPrereqCycleError);
			const cycleErr = e as CredentialPrereqCycleError;
			// Cycle path includes both nodes.
			expect(cycleErr.cycle).toContain('a');
			expect(cycleErr.cycle).toContain('b');
		}
	});

	it('detects a longer cycle', () => {
		const adj = new Map<string, string[]>([
			['a', ['b']],
			['b', ['c']],
			['c', ['d']],
			['d', ['a']],
		]);
		expect(() => validateCredentialDag(adj)).toThrowError(CredentialPrereqCycleError);
	});

	it('reports the cycle path through the cycle field', () => {
		const adj = new Map<string, string[]>([
			['a', ['b']],
			['b', ['c']],
			['c', ['a']],
		]);
		try {
			validateCredentialDag(adj);
			throw new Error('expected throw');
		} catch (e) {
			const err = e as CredentialPrereqCycleError;
			expect(err.cycle.length).toBeGreaterThanOrEqual(3);
			// The DFS-found cycle starts and ends on the same node.
			expect(err.cycle[0]).toBe(err.cycle[err.cycle.length - 1]);
		}
	});
});

// -- DB-backed tests --------------------------------------------------------

const SUITE_TAG = `cred-test-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const SUITE_TOKEN = Math.floor(Math.random() * 0x100_000_000)
	.toString(16)
	.padStart(8, '0');

const slug = (s: string): string => `${s}-${SUITE_TOKEN}`;

const PRIVATE_SLUG = slug('private');
const COMMERCIAL_SLUG = slug('commercial');
const INSTRUMENT_SLUG = slug('instrument');
const CFI_SLUG = slug('cfi');
const CFII_SLUG = slug('cfii');

const PRIVATE_ID = generateCredentialId();
const COMMERCIAL_ID = generateCredentialId();
const INSTRUMENT_ID = generateCredentialId();
const CFI_ID = generateCredentialId();
const CFII_ID = generateCredentialId();

const PRIVATE_SYLLABUS_ID = generateSyllabusId();
const PRIVATE_SYLLABUS_SLUG = slug('ppl-acs');

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `${SUITE_TAG}@airboss.test`;

beforeAll(async () => {
	const now = new Date();

	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Credential BC Test',
		firstName: 'Credential',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	// Five credentials forming a small DAG: PPL -> CPL/IR -> CFI -> CFII.
	await db.insert(credential).values([
		{
			id: PRIVATE_ID,
			slug: PRIVATE_SLUG,
			kind: 'pilot-cert',
			title: 'Private Pilot',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: COMMERCIAL_ID,
			slug: COMMERCIAL_SLUG,
			kind: 'pilot-cert',
			title: 'Commercial Pilot',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: INSTRUMENT_ID,
			slug: INSTRUMENT_SLUG,
			kind: 'category-rating',
			title: 'Instrument -- Airplane',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFI_ID,
			slug: CFI_SLUG,
			kind: 'instructor-cert',
			title: 'Certified Flight Instructor',
			category: 'airplane',
			class: 'single-engine-land',
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: CFII_ID,
			slug: CFII_SLUG,
			kind: 'instructor-cert',
			title: 'CFI -- Instrument',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Edges: PPL is the root; CPL and IR require PPL; CFI requires CPL+PPL;
	// CFII requires CFI+IR.
	await db.insert(credentialPrereq).values([
		{
			credentialId: COMMERCIAL_ID,
			prereqId: PRIVATE_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: INSTRUMENT_ID,
			prereqId: PRIVATE_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: CFI_ID,
			prereqId: COMMERCIAL_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: CFI_ID,
			prereqId: PRIVATE_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: CFII_ID,
			prereqId: CFI_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
		{
			credentialId: CFII_ID,
			prereqId: INSTRUMENT_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: '',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		},
	]);

	// One syllabus tied to PPL as primary.
	await db.insert(syllabus).values({
		id: PRIVATE_SYLLABUS_ID,
		slug: PRIVATE_SYLLABUS_SLUG,
		kind: 'acs',
		title: 'Private Pilot ACS (test)',
		edition: `faa-s-acs-test-${SUITE_TOKEN}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		seedOrigin: SUITE_TAG,
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(credentialSyllabus).values({
		credentialId: PRIVATE_ID,
		syllabusId: PRIVATE_SYLLABUS_ID,
		primacy: SYLLABUS_PRIMACY.PRIMARY,
		seedOrigin: SUITE_TAG,
		createdAt: now,
	});
});

afterAll(async () => {
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.seedOrigin, SUITE_TAG));
	await db.delete(syllabusNode).where(eq(syllabusNode.seedOrigin, SUITE_TAG));
	await db.delete(credentialSyllabus).where(eq(credentialSyllabus.seedOrigin, SUITE_TAG));
	await db.delete(syllabus).where(eq(syllabus.seedOrigin, SUITE_TAG));
	await db.delete(credentialPrereq).where(eq(credentialPrereq.seedOrigin, SUITE_TAG));
	await db.delete(credential).where(eq(credential.seedOrigin, SUITE_TAG));
	await db.delete(knowledgeNode).where(eq(knowledgeNode.seedOrigin, SUITE_TAG));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('listCredentials', () => {
	it('lists every active credential by default', async () => {
		const rows = await listCredentials({ status: CREDENTIAL_STATUSES.ACTIVE });
		const slugs = rows.map((r) => r.slug);
		expect(slugs).toContain(PRIVATE_SLUG);
		expect(slugs).toContain(CFI_SLUG);
	});

	it('filters by kind', async () => {
		const rows = await listCredentials({ kind: 'instructor-cert' });
		const slugs = rows.map((r) => r.slug);
		expect(slugs).toContain(CFI_SLUG);
		expect(slugs).toContain(CFII_SLUG);
		expect(slugs).not.toContain(PRIVATE_SLUG);
	});
});

describe('getCredentialBySlug / getCredentialById', () => {
	it('resolves by slug', async () => {
		const row = await getCredentialBySlug(PRIVATE_SLUG);
		expect(row.id).toBe(PRIVATE_ID);
	});

	it('throws CredentialNotFoundError on unknown slug', async () => {
		await expect(getCredentialBySlug('not-a-cred')).rejects.toBeInstanceOf(CredentialNotFoundError);
	});
});

describe('getCredentialPrereqs', () => {
	it('returns direct prereqs only', async () => {
		const rows = await getCredentialPrereqs(CFI_ID);
		const prereqIds = rows.map((r) => r.prereqId).sort();
		expect(prereqIds).toEqual([COMMERCIAL_ID, PRIVATE_ID].sort());
	});
});

describe('getCredentialIdsCoveredBy', () => {
	it('walks the DAG transitively for CFII', async () => {
		const ids = await getCredentialIdsCoveredBy(CFII_ID);
		const set = new Set(ids);
		expect(set.has(CFII_ID)).toBe(true);
		expect(set.has(CFI_ID)).toBe(true);
		expect(set.has(INSTRUMENT_ID)).toBe(true);
		expect(set.has(COMMERCIAL_ID)).toBe(true);
		expect(set.has(PRIVATE_ID)).toBe(true);
	});

	it('includes self only for a root credential', async () => {
		const ids = await getCredentialIdsCoveredBy(PRIVATE_ID);
		expect(ids).toEqual([PRIVATE_ID]);
	});

	it('respects the required-only filter', async () => {
		const all = await getCredentialIdsCoveredBy(CFII_ID, { kind: 'all' });
		const required = await getCredentialIdsCoveredBy(CFII_ID, { kind: 'required' });
		// All edges in this fixture are 'required', so the two should match.
		expect(new Set(required)).toEqual(new Set(all));
	});
});

describe('getCertsCoveredBy', () => {
	it('returns slugs for the transitive cover', async () => {
		const slugs = await getCertsCoveredBy(CFI_ID);
		expect(new Set(slugs)).toEqual(new Set([CFI_SLUG, COMMERCIAL_SLUG, PRIVATE_SLUG]));
	});
});

describe('getCredentialPrereqDag', () => {
	it('returns nodes + edges for the seeded test credentials', async () => {
		const dag = await getCredentialPrereqDag();
		const nodes = dag.nodes.filter((n) => n.seedOrigin === SUITE_TAG);
		const edges = dag.edges.filter((e) => e.seedOrigin === SUITE_TAG);
		expect(nodes.length).toBe(5);
		expect(edges.length).toBe(6);
	});
});

describe('getCredentialPrimarySyllabus', () => {
	it('returns the primary syllabus when one exists', async () => {
		const syl = await getCredentialPrimarySyllabus(PRIVATE_ID);
		expect(syl).not.toBeNull();
		expect(syl?.id).toBe(PRIVATE_SYLLABUS_ID);
	});

	it('returns null when no primary is set', async () => {
		const syl = await getCredentialPrimarySyllabus(CFII_ID);
		expect(syl).toBeNull();
	});
});

describe('getCredentialSyllabi', () => {
	it('returns the link + syllabus for primary', async () => {
		const rows = await getCredentialSyllabi(PRIVATE_ID, { primacy: 'primary' });
		expect(rows.length).toBe(1);
		expect(rows[0]?.syllabus.id).toBe(PRIVATE_SYLLABUS_ID);
	});
});

describe('getCredentialMastery', () => {
	it('returns zero rollup when the primary syllabus has no leaves', async () => {
		const result = await getCredentialMastery(TEST_USER_ID, PRIVATE_ID);
		expect(result.credentialSlug).toBe(PRIVATE_SLUG);
		expect(result.primarySyllabusId).toBe(PRIVATE_SYLLABUS_ID);
		expect(result.totalLeaves).toBe(0);
		expect(result.coveredLeaves).toBe(0);
		expect(result.masteredLeaves).toBe(0);
		expect(result.areas).toEqual([]);
	});

	it('returns null primary when no primary syllabus is set', async () => {
		const result = await getCredentialMastery(TEST_USER_ID, CFII_ID);
		expect(result.primarySyllabusId).toBeNull();
		expect(result.totalLeaves).toBe(0);
	});

	it('rolls up mastery when leaves + links exist', async () => {
		// Seed a small Area / Task / Element subtree on the PPL syllabus and
		// link two element leaves to two knowledge nodes.
		const now = new Date();
		const areaId = generateSyllabusNodeId();
		const taskId = generateSyllabusNodeId();
		const k1Id = generateSyllabusNodeId();
		const r1Id = generateSyllabusNodeId();
		const knNode1Id = `kn-${SUITE_TAG}-1`;
		const knNode2Id = `kn-${SUITE_TAG}-2`;

		await db.insert(syllabusNode).values([
			{
				id: areaId,
				syllabusId: PRIVATE_SYLLABUS_ID,
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
				id: taskId,
				syllabusId: PRIVATE_SYLLABUS_ID,
				parentId: areaId,
				level: 'task',
				ordinal: 1,
				code: `${SUITE_TOKEN}-V.A`,
				title: 'Steep Turns',
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
				id: k1Id,
				syllabusId: PRIVATE_SYLLABUS_ID,
				parentId: taskId,
				level: 'element',
				ordinal: 1,
				code: `${SUITE_TOKEN}-V.A.K1`,
				title: 'Aerodynamics of steep turns',
				description: '',
				triad: 'knowledge',
				requiredBloom: 'understand',
				isLeaf: true,
				airbossRef: null,
				citations: [],
				contentHash: null,
				seedOrigin: SUITE_TAG,
				createdAt: now,
				updatedAt: now,
			},
			{
				id: r1Id,
				syllabusId: PRIVATE_SYLLABUS_ID,
				parentId: taskId,
				level: 'element',
				ordinal: 2,
				code: `${SUITE_TOKEN}-V.A.R1`,
				title: 'Failure to maintain coordinated flight',
				description: '',
				triad: 'risk_management',
				requiredBloom: 'apply',
				isLeaf: true,
				airbossRef: null,
				citations: [],
				contentHash: null,
				seedOrigin: SUITE_TAG,
				createdAt: now,
				updatedAt: now,
			},
		]);

		await db.insert(knowledgeNode).values([
			{
				id: knNode1Id,
				title: 'k-node 1',
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
			},
			{
				id: knNode2Id,
				title: 'k-node 2',
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
			},
		]);

		await db.insert(syllabusNodeLink).values([
			{
				id: generateSyllabusNodeLinkId(),
				syllabusNodeId: k1Id,
				knowledgeNodeId: knNode1Id,
				weight: 1.0,
				notes: '',
				seedOrigin: SUITE_TAG,
				createdAt: now,
			},
			{
				id: generateSyllabusNodeLinkId(),
				syllabusNodeId: r1Id,
				knowledgeNodeId: knNode2Id,
				weight: 1.0,
				notes: '',
				seedOrigin: SUITE_TAG,
				createdAt: now,
			},
		]);

		const result = await getCredentialMastery(TEST_USER_ID, PRIVATE_ID);
		expect(result.totalLeaves).toBe(2);
		// User has no cards or scenarios -> nothing covered or mastered.
		expect(result.coveredLeaves).toBe(0);
		expect(result.masteredLeaves).toBe(0);
		expect(result.areas.length).toBe(1);
		expect(result.areas[0]?.totalLeaves).toBe(2);
	});
});

describe('upsert helpers', () => {
	it('upsertCredential is idempotent', async () => {
		const now = new Date();
		const id = generateCredentialId();
		const slugLocal = slug('upsert-test');
		await upsertCredential({
			id,
			slug: slugLocal,
			kind: 'endorsement',
			title: 'Upsert Test',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		await upsertCredential({
			id,
			slug: slugLocal,
			kind: 'endorsement',
			title: 'Upsert Test (renamed)',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		const row = await getCredentialBySlug(slugLocal);
		expect(row.title).toBe('Upsert Test (renamed)');
	});

	it('upsertCredentialPrereq is idempotent', async () => {
		const id = generateCredentialId();
		const now = new Date();
		const localSlug = slug('upsert-prereq-1');
		await upsertCredential({
			id,
			slug: localSlug,
			kind: 'pilot-cert',
			title: 'Upsert prereq parent',
			category: 'airplane',
			class: null,
			regulatoryBasis: [],
			status: CREDENTIAL_STATUSES.ACTIVE,
			seedOrigin: SUITE_TAG,
			createdAt: now,
			updatedAt: now,
		});
		await upsertCredentialPrereq({
			credentialId: id,
			prereqId: PRIVATE_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: 'first',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		});
		await upsertCredentialPrereq({
			credentialId: id,
			prereqId: PRIVATE_ID,
			kind: CREDENTIAL_PREREQ_KINDS.REQUIRED,
			notes: 'second',
			seedOrigin: SUITE_TAG,
			createdAt: now,
		});
		const rows = await getCredentialPrereqs(id);
		expect(rows.length).toBe(1);
		expect(rows[0]?.notes).toBe('second');
	});

	it('upsertCredentialSyllabus is idempotent', async () => {
		await upsertCredentialSyllabus({
			credentialId: COMMERCIAL_ID,
			syllabusId: PRIVATE_SYLLABUS_ID,
			primacy: SYLLABUS_PRIMACY.SUPPLEMENTAL,
			seedOrigin: SUITE_TAG,
			createdAt: new Date(),
		});
		await upsertCredentialSyllabus({
			credentialId: COMMERCIAL_ID,
			syllabusId: PRIVATE_SYLLABUS_ID,
			primacy: SYLLABUS_PRIMACY.SUPPLEMENTAL,
			seedOrigin: SUITE_TAG,
			createdAt: new Date(),
		});
		const supplemental = await getCredentialSyllabi(COMMERCIAL_ID, { primacy: 'supplemental' });
		expect(supplemental.length).toBe(1);

		// Cleanup so other tests don't see this extra link.
		await db
			.delete(credentialSyllabus)
			.where(
				sql`${credentialSyllabus.credentialId} = ${COMMERCIAL_ID} AND ${credentialSyllabus.syllabusId} = ${PRIVATE_SYLLABUS_ID}`,
			);
	});
});
