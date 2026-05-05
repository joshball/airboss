/**
 * Tests for the ACS map projection builder.
 *
 * Most of `buildAcsTree` is DB-bound, so the unit suite focuses on the
 * pure helpers (`mergeNodeEvidenceStates`, `buildCitationStacks`) plus a
 * shape assertion that exercises the empty paths. Full integration of
 * the tree against seeded data is covered by the Playwright e2e in
 * `tests/e2e/study-home.spec.ts`.
 */

import { NODE_MASTERY_GATES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { buildAcsTree, buildCitationStacks, mergeNodeEvidenceStates } from './build-acs-tree.server';

const NA = NODE_MASTERY_GATES.NOT_APPLICABLE;
const PASS = NODE_MASTERY_GATES.PASS;
const FAIL = NODE_MASTERY_GATES.FAIL;
const INSUF = NODE_MASTERY_GATES.INSUFFICIENT_DATA;

describe('mergeNodeEvidenceStates', () => {
	it('returns all NA for an empty input', () => {
		const merged = mergeNodeEvidenceStates('leaf-1', []);
		expect(merged.recall).toBe(NA);
		expect(merged.calculation).toBe(NA);
		expect(merged.scenario).toBe(NA);
		expect(merged.demonstration).toBe(NA);
		expect(merged.teaching).toBe(NA);
	});

	it('lifts a passing gate from a single linked node', () => {
		const merged = mergeNodeEvidenceStates('leaf-1', [
			{ nodeId: 'k1', recall: PASS, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
		]);
		expect(merged.recall).toBe(PASS);
		expect(merged.calculation).toBe(NA);
	});

	it('PASS wins across multiple linked nodes (any-passes)', () => {
		const merged = mergeNodeEvidenceStates('leaf-1', [
			{ nodeId: 'k1', recall: FAIL, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
			{ nodeId: 'k2', recall: PASS, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
		]);
		expect(merged.recall).toBe(PASS);
	});

	it('FAIL beats INSUFFICIENT_DATA when no PASS is present', () => {
		const merged = mergeNodeEvidenceStates('leaf-1', [
			{ nodeId: 'k1', recall: INSUF, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
			{ nodeId: 'k2', recall: FAIL, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
		]);
		expect(merged.recall).toBe(FAIL);
	});

	it('INSUFFICIENT_DATA beats NOT_APPLICABLE when nothing else is present', () => {
		const merged = mergeNodeEvidenceStates('leaf-1', [
			{ nodeId: 'k1', recall: INSUF, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
			{ nodeId: 'k2', recall: NA, calculation: NA, scenario: NA, demonstration: NA, teaching: NA },
		]);
		expect(merged.recall).toBe(INSUF);
	});
});

describe('buildCitationStacks', () => {
	it('splits handbook + cfr citations into the two stacks', () => {
		const stacks = buildCitationStacks([
			{
				kind: 'handbook',
				reference_id: 'phak',
				locator: { chapter: 10, section: 4 },
				airboss_ref: 'airboss-ref:handbooks/phak/8083-25C/10/4',
			},
			{
				kind: 'cfr',
				reference_id: '14cfr91',
				locator: { title: 14, part: 91, section: '91.103' },
				airboss_ref: 'airboss-ref:regs/cfr-14/91/103',
			},
		]);
		expect(stacks.handbook).toHaveLength(1);
		expect(stacks.regulation).toHaveLength(1);
		expect(stacks.handbook[0]?.label).toBe('Chapter 10.4');
		expect(stacks.regulation[0]?.label).toBe('14 CFR 91.103');
	});

	it('drops citations without an airboss_ref (no resolvable URL)', () => {
		const stacks = buildCitationStacks([
			{
				kind: 'handbook',
				reference_id: 'phak',
				locator: { chapter: 10 },
			},
		]);
		expect(stacks.handbook).toHaveLength(0);
		expect(stacks.regulation).toHaveLength(0);
	});

	it('routes AC + AIM citations into the handbook stack (guidance-shaped)', () => {
		const stacks = buildCitationStacks([
			{
				kind: 'ac',
				reference_id: 'ac-61-65',
				locator: { paragraph: '5' },
				airboss_ref: 'airboss-ref:ac/61-65/j/section-5',
			},
			{
				kind: 'aim',
				reference_id: 'aim',
				locator: { paragraph: '5-1-7' },
				airboss_ref: 'airboss-ref:aim/5-1-7',
			},
		]);
		expect(stacks.handbook).toHaveLength(2);
		expect(stacks.regulation).toHaveLength(0);
		expect(stacks.handbook[0]?.source).toBe('ac');
		expect(stacks.handbook[1]?.source).toBe('handbook');
	});
});

describe('buildAcsTree -- empty paths', () => {
	it('returns [] when the credential has no primary syllabus', async () => {
		const tree = await buildAcsTree(
			'user-1',
			{ id: 'cred-1', slug: 'private', kind: 'cert', title: 'PPL', category: 'airplane', class: null } as never,
			{
				credentialId: 'cred-1',
				credentialSlug: 'private',
				primarySyllabusId: null,
				totalLeaves: 0,
				coveredLeaves: 0,
				masteredLeaves: 0,
				byEvidenceKind: {},
				areas: [],
			},
			null,
			null,
		);
		expect(tree).toEqual([]);
	});

	it('returns [] when the rollup has no areas', async () => {
		const tree = await buildAcsTree(
			'user-1',
			{ id: 'cred-1', slug: 'private', kind: 'cert', title: 'PPL', category: 'airplane', class: null } as never,
			{
				credentialId: 'cred-1',
				credentialSlug: 'private',
				primarySyllabusId: 'syl-1',
				totalLeaves: 0,
				coveredLeaves: 0,
				masteredLeaves: 0,
				byEvidenceKind: {},
				areas: [],
			},
			'syl-1',
			null,
		);
		expect(tree).toEqual([]);
	});
});
