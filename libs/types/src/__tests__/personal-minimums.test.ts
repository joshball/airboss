import { PERSONAL_MINIMUMS_DEFAULTS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { personalMinimumsInputSchema } from '../personal-minimums';

/**
 * The defaults const carries SCREAMING_SNAKE keys; the Zod schema expects
 * camelCase field names. This is the canonical "seed the form from defaults"
 * shape -- the editor surface (Phase C) maps the const to the form the same
 * way.
 */
const defaultsInput = {
	ceilingFt: PERSONAL_MINIMUMS_DEFAULTS.CEILING_FT,
	visibilitySm: PERSONAL_MINIMUMS_DEFAULTS.VISIBILITY_SM,
	windTotalKt: PERSONAL_MINIMUMS_DEFAULTS.WIND_TOTAL_KT,
	crosswindTotalKt: PERSONAL_MINIMUMS_DEFAULTS.CROSSWIND_TOTAL_KT,
	nightRequiredRecencyLandings: PERSONAL_MINIMUMS_DEFAULTS.NIGHT_REQUIRED_RECENCY_LANDINGS,
	imcRequiredRecencyApproaches: PERSONAL_MINIMUMS_DEFAULTS.IMC_REQUIRED_RECENCY_APPROACHES,
	paxMax: PERSONAL_MINIMUMS_DEFAULTS.PAX_MAX,
	terrainBufferAgl: PERSONAL_MINIMUMS_DEFAULTS.TERRAIN_BUFFER_AGL,
} as const;

describe('personalMinimumsInputSchema', () => {
	it('accepts the FAA P-8740-25 defaults shape', () => {
		const result = personalMinimumsInputSchema.safeParse(defaultsInput);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.ceilingFt).toBe(1500);
			expect(result.data.visibilitySm).toBe(5.0);
		}
	});

	it('accepts a record with an optional notes body', () => {
		const result = personalMinimumsInputSchema.safeParse({ ...defaultsInput, notes: '# tightening night ceiling' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.notes).toBe('# tightening night ceiling');
		}
	});

	it('rejects a negative ceiling with a ceilingFt path', () => {
		const result = personalMinimumsInputSchema.safeParse({ ...defaultsInput, ceilingFt: -1 });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('ceilingFt'))).toBe(true);
		}
	});

	it('rejects crosswind greater than wind total with a crosswindTotalKt path', () => {
		const result = personalMinimumsInputSchema.safeParse({
			...defaultsInput,
			crosswindTotalKt: 25,
			windTotalKt: 20,
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues.find((i) => i.path.includes('crosswindTotalKt'));
			expect(issue).toBeDefined();
			expect(issue?.message).toBe('crosswindTotalKt must be <= windTotalKt');
		}
	});

	it('rejects an over-max visibility with a visibilitySm path', () => {
		const result = personalMinimumsInputSchema.safeParse({ ...defaultsInput, visibilitySm: 150 });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('visibilitySm'))).toBe(true);
		}
	});

	it('rejects an over-length notes body with a notes path', () => {
		const result = personalMinimumsInputSchema.safeParse({ ...defaultsInput, notes: 'x'.repeat(4001) });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('notes'))).toBe(true);
		}
	});

	it('rejects a non-integer crosswind value', () => {
		const result = personalMinimumsInputSchema.safeParse({ ...defaultsInput, crosswindTotalKt: 10.5 });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('crosswindTotalKt'))).toBe(true);
		}
	});
});
