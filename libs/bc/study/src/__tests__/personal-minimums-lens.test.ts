/**
 * Personal-minimums lens tests (personal-minimums-as-typed-contract WP).
 *
 * Pure-function tests -- no DB. Covers all-within / per-field-below cases,
 * the `unknown` verdict for a null minimums row, and the purity guarantee.
 */

import type { PersonalMinimumsObservation } from '@ab/types';
import { describe, expect, it } from 'vitest';
import { type PersonalMinimumsFloors, projectAgainstPersonalMinimums } from '../personal-minimums-lens';

const floors: PersonalMinimumsFloors = {
	ceilingFt: 1500,
	visibilitySm: 5,
	windTotalKt: 20,
	crosswindTotalKt: 12,
};

const withinObservation: PersonalMinimumsObservation = {
	ceilingFtAgl: 3000,
	visibilitySm: 10,
	windTotalKt: 8,
	crosswindKt: 4,
	isNight: false,
};

describe('projectAgainstPersonalMinimums', () => {
	it('reports pass: within when every field conforms', () => {
		const result = projectAgainstPersonalMinimums(floors, withinObservation);
		expect(result.pass).toBe('within');
		expect(result.fields.ceiling.withinFloor).toBe(true);
		expect(result.fields.visibility.withinFloor).toBe(true);
		expect(result.fields.windTotal.withinFloor).toBe(true);
		expect(result.fields.crosswind.withinFloor).toBe(true);
		expect(result.notes).toEqual([]);
	});

	it('reports pass: below with a per-field message when the ceiling is below floor', () => {
		const result = projectAgainstPersonalMinimums(floors, { ...withinObservation, ceilingFtAgl: 800 });
		expect(result.pass).toBe('below');
		expect(result.fields.ceiling.withinFloor).toBe(false);
		expect(result.fields.ceiling.observed).toBe(800);
		expect(result.fields.ceiling.floor).toBe(1500);
		expect(result.notes).toContain('ceiling 800 ft AGL below your 1500 ft floor');
	});

	it('reports pass: below when the crosswind exceeds the floor', () => {
		const result = projectAgainstPersonalMinimums(floors, { ...withinObservation, crosswindKt: 18 });
		expect(result.pass).toBe('below');
		expect(result.fields.crosswind.withinFloor).toBe(false);
		expect(result.notes).toContain('crosswind 18 kt above your 12 kt floor');
	});

	it('reports pass: below when the visibility is below floor', () => {
		const result = projectAgainstPersonalMinimums(floors, { ...withinObservation, visibilitySm: 3 });
		expect(result.pass).toBe('below');
		expect(result.fields.visibility.withinFloor).toBe(false);
		expect(result.notes).toContain('visibility 3 SM below your 5 SM floor');
	});

	it('reports pass: unknown when called with a null minimums row', () => {
		const result = projectAgainstPersonalMinimums(null, withinObservation);
		expect(result.pass).toBe('unknown');
		expect(result.notes).toEqual([]);
	});

	it('treats the observation at exactly the floor as within', () => {
		const atFloor: PersonalMinimumsObservation = {
			ceilingFtAgl: 1500,
			visibilitySm: 5,
			windTotalKt: 20,
			crosswindKt: 12,
			isNight: false,
		};
		expect(projectAgainstPersonalMinimums(floors, atFloor).pass).toBe('within');
	});

	it('is pure -- repeated calls with the same input deep-equal and do not mutate inputs', () => {
		const floorsCopy = { ...floors };
		const obsCopy = { ...withinObservation };
		const first = projectAgainstPersonalMinimums(floorsCopy, obsCopy);
		const second = projectAgainstPersonalMinimums(floorsCopy, obsCopy);
		expect(first).toEqual(second);
		expect(floorsCopy).toEqual(floors);
		expect(obsCopy).toEqual(withinObservation);
	});
});
