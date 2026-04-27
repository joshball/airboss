/**
 * Phase 7 Zod schema unit tests -- validate credential / syllabus / goal
 * authoring shapes plus the StructuredCitation extension (framing +
 * airboss_ref). Citation discriminated-union narrowing across every kind
 * is also exercised.
 */

import { describe, expect, it } from 'vitest';
import {
	addGoalNodeInputSchema,
	addGoalSyllabusInputSchema,
	createGoalInputSchema,
	credentialYamlSchema,
	syllabusManifestSchema,
	syllabusNodeYamlSchema,
	updateGoalInputSchema,
} from './credentials.validation';
import { citationSchema, legacyCitationSchema, structuredCitationSchema } from './handbook-validation';

describe('structuredCitationSchema framing + airboss_ref extension', () => {
	it('accepts a WP #1-style handbook citation without framing or airboss_ref', () => {
		const parsed = structuredCitationSchema.parse({
			kind: 'handbook',
			reference_id: 'ref_123',
			locator: { chapter: 12, section: 3 },
			note: 'PHAK Ch 12',
		});
		expect(parsed.kind).toBe('handbook');
	});

	it('accepts a handbook citation with framing + airboss_ref', () => {
		const parsed = structuredCitationSchema.parse({
			kind: 'handbook',
			reference_id: 'ref_123',
			locator: { chapter: 12 },
			framing: 'survey',
			airboss_ref: 'airboss-ref:handbooks/phak/8083-25C/12',
		});
		// Discriminated union narrows on `kind`.
		if (parsed.kind === 'handbook') {
			expect(parsed.framing).toBe('survey');
			expect(parsed.airboss_ref).toBe('airboss-ref:handbooks/phak/8083-25C/12');
		} else {
			throw new Error('expected handbook variant');
		}
	});

	it('rejects an airboss_ref string without the airboss-ref: prefix', () => {
		const result = structuredCitationSchema.safeParse({
			kind: 'cfr',
			reference_id: 'ref_cfr',
			locator: { title: 14, part: 61, section: '109' },
			airboss_ref: 'cfr:14/61/109',
		});
		expect(result.success).toBe(false);
	});

	it('rejects an unknown framing value', () => {
		const result = structuredCitationSchema.safeParse({
			kind: 'cfr',
			reference_id: 'ref_cfr',
			locator: { title: 14, part: 61, section: '109' },
			framing: 'bogus',
		});
		expect(result.success).toBe(false);
	});

	it('narrows across every StructuredCitation kind', () => {
		const cases = [
			{ kind: 'handbook', locator: { chapter: 1 } },
			{ kind: 'cfr', locator: { title: 14, part: 61, section: '109' } },
			{ kind: 'ac', locator: { paragraph: '5-1' } },
			{ kind: 'acs', locator: { area: 'V', task: 'A', element: 'K1' } },
			{ kind: 'pts', locator: { area: 'V', task: 'A', element: 'K1' } },
			{ kind: 'aim', locator: { paragraph: '5-1-7' } },
			{ kind: 'pcg', locator: { term: 'CTAF' } },
			{ kind: 'ntsb', locator: { detail: 'CHI06FA126' } },
			{ kind: 'poh', locator: { detail: 'C172S 4-3' } },
			{ kind: 'other', locator: { detail: 'school manual page 3' } },
		];
		for (const c of cases) {
			const parsed = structuredCitationSchema.parse({ ...c, reference_id: 'ref_x' });
			expect(parsed.kind).toBe(c.kind);
		}
	});
});

describe('citationSchema legacy + structured union', () => {
	it('accepts a legacy citation', () => {
		const parsed = legacyCitationSchema.parse({
			source: 'PHAK',
			detail: 'Chapter 12',
			note: 'aerodynamics',
		});
		expect(parsed.source).toBe('PHAK');
	});

	it('accepts both shapes via citationSchema', () => {
		const legacy = citationSchema.parse({ source: 'PHAK', detail: 'Ch 12', note: '' });
		const structured = citationSchema.parse({
			kind: 'handbook',
			reference_id: 'ref_123',
			locator: { chapter: 12 },
		});
		expect('kind' in legacy).toBe(false);
		expect('kind' in structured).toBe(true);
	});
});

describe('credentialYamlSchema', () => {
	it('accepts a minimal student credential', () => {
		const parsed = credentialYamlSchema.parse({
			slug: 'student',
			kind: 'student',
			title: 'Student',
			category: 'none',
		});
		expect(parsed.slug).toBe('student');
		expect(parsed.regulatory_basis).toEqual([]);
		expect(parsed.prereqs).toEqual([]);
	});

	it('accepts a private cert with regulatory basis + prereqs + syllabi', () => {
		const parsed = credentialYamlSchema.parse({
			slug: 'private',
			kind: 'pilot-cert',
			title: 'Private Pilot Certificate',
			category: 'airplane',
			class: 'single-engine-land',
			regulatory_basis: [
				{
					kind: 'cfr',
					reference_id: 'ref_14cfr61',
					locator: { title: 14, part: 61, section: '103' },
					framing: 'regulatory',
				},
			],
			prereqs: [{ prereq_slug: 'student', kind: 'required', notes: '' }],
			syllabi: [{ syllabus_slug: 'ppl-acs-faa-s-acs-25', primacy: 'primary' }],
		});
		expect(parsed.prereqs).toHaveLength(1);
		expect(parsed.syllabi[0].primacy).toBe('primary');
	});

	it('rejects an invalid slug', () => {
		const result = credentialYamlSchema.safeParse({
			slug: 'INVALID UPPERCASE',
			kind: 'pilot-cert',
			title: 'Bad',
			category: 'airplane',
		});
		expect(result.success).toBe(false);
	});
});

describe('syllabusManifestSchema', () => {
	it('accepts a PPL ACS manifest', () => {
		const parsed = syllabusManifestSchema.parse({
			slug: 'ppl-acs-faa-s-acs-25',
			kind: 'acs',
			title: 'Private Pilot Airplane ACS',
			edition: 'faa-s-acs-25',
			source_url: 'https://www.faa.gov/training_testing/testing/acs/private_acs.pdf',
			credentials: [{ credential_slug: 'private', primacy: 'primary' }],
		});
		expect(parsed.kind).toBe('acs');
	});
});

describe('syllabusNodeYamlSchema', () => {
	it('accepts an area with nested tasks and elements', () => {
		const parsed = syllabusNodeYamlSchema.parse({
			level: 'area',
			code: 'V',
			title: 'Performance Maneuvers',
			children: [
				{
					level: 'task',
					code: 'V.A',
					title: 'Steep Turns',
					children: [
						{
							level: 'element',
							code: 'V.A.K1',
							title: 'Aerodynamics of steep turns',
							triad: 'knowledge',
							required_bloom: 'understand',
							airboss_ref: 'airboss-ref:acs/private/faa-s-acs-25/area-V/task-A/element-K1',
							citations: [
								{
									kind: 'handbook',
									reference_id: 'ref_phak',
									locator: { chapter: 5 },
									framing: 'survey',
								},
							],
							knowledge_nodes: [{ node_slug: 'aerodynamics-load-factor', weight: 1.0 }],
							children: [],
						},
					],
				},
			],
		});
		expect(parsed.children).toHaveLength(1);
		const task = parsed.children[0];
		expect(task.children[0].triad).toBe('knowledge');
		expect(task.children[0].airboss_ref).toMatch(/^airboss-ref:acs\//);
	});

	it('rejects an airboss_ref without the airboss-ref: prefix', () => {
		const result = syllabusNodeYamlSchema.safeParse({
			level: 'element',
			code: 'V.A.K1',
			title: 'x',
			airboss_ref: 'invalid',
		});
		expect(result.success).toBe(false);
	});
});

describe('goal-input schemas', () => {
	it('createGoalInputSchema requires a title', () => {
		expect(createGoalInputSchema.safeParse({ title: '' }).success).toBe(false);
		expect(createGoalInputSchema.parse({ title: 'Pass the PPL practical' }).title).toBe('Pass the PPL practical');
	});

	it('updateGoalInputSchema accepts a partial update', () => {
		const parsed = updateGoalInputSchema.parse({ status: 'paused' });
		expect(parsed.status).toBe('paused');
	});

	it('addGoalSyllabusInputSchema enforces the weight bounds', () => {
		expect(addGoalSyllabusInputSchema.safeParse({ syllabusId: 'syl_1', weight: 11 }).success).toBe(false);
		expect(addGoalSyllabusInputSchema.parse({ syllabusId: 'syl_1', weight: 1 }).weight).toBe(1);
	});

	it('addGoalNodeInputSchema rejects a negative weight', () => {
		expect(addGoalNodeInputSchema.safeParse({ knowledgeNodeId: 'kn_1', weight: -1 }).success).toBe(false);
	});
});
