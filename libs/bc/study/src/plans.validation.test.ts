/**
 * Plan-validation Zod schema tests.
 *
 * These exercise the schemas in isolation (no DB) so the cap on
 * focusDomains / skipDomains is locked to the canonical domain count.
 * The Private Pilot overview preset configures 8 focus domains, which
 * the prior cap of 5 rejected -- a regression of the preset's intent.
 */

import { DOMAIN_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { createPlanSchema, updatePlanSchema } from './plans.validation';

describe('createPlanSchema focusDomains cap', () => {
	it('accepts every canonical domain as a focus selection', () => {
		const parsed = createPlanSchema.parse({
			focusDomains: [...DOMAIN_VALUES],
			skipDomains: [],
		});
		expect(parsed.focusDomains).toHaveLength(DOMAIN_VALUES.length);
	});

	it('accepts the Private Pilot overview shape (8 focus domains)', () => {
		// Same shape as PRIVATE_PILOT_OVERVIEW in libs/constants/src/presets.ts.
		// The original cap of 5 rejected this preset and crashed startFromPreset.
		const ppl = DOMAIN_VALUES.slice(0, 8);
		const parsed = createPlanSchema.parse({ focusDomains: ppl });
		expect(parsed.focusDomains).toEqual(ppl);
	});
});

describe('updatePlanSchema focusDomains cap', () => {
	it('accepts every canonical domain as a focus selection', () => {
		const parsed = updatePlanSchema.parse({ focusDomains: [...DOMAIN_VALUES] });
		expect(parsed.focusDomains).toHaveLength(DOMAIN_VALUES.length);
	});
});
