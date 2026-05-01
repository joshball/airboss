/**
 * Smoke test for the `seed-references.ts` zod schema -- specifically the
 * Wave 1 addition of the optional `primary_cert` field to YAML reference
 * entries (library-by-cert WP).
 *
 * Covers:
 *   - valid `primary_cert` value (must be one of CERT_APPLICABILITY_VALUES) passes
 *   - invalid `primary_cert` value fails with a Zod enum error
 *   - omitted `primary_cert` passes (field is optional)
 *   - explicit `primary_cert: null` passes (nullable on the wire)
 *
 * Lives next to the loader so a `bun test scripts/db/seed-references.test.ts`
 * is enough to validate the schema in isolation; no DB needed.
 */

import { describe, expect, it } from 'vitest';
import { referenceEntrySchema } from './seed-references';

const baseEntry = {
	slug: 'phak',
	kind: 'handbook' as const,
	edition: 'FAA-H-8083-25C',
	title: "Pilot's Handbook of Aeronautical Knowledge",
	subjects: ['aerodynamics'] as const,
};

describe('seed-references zod schema -- primary_cert', () => {
	it('accepts a valid CERT_APPLICABILITY value', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: 'private' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBe('private');
		}
	});

	it('rejects an unknown primary_cert value', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: 'bogus' });
		expect(result.success).toBe(false);
		if (!result.success) {
			// Zod enum failures surface the offending path; assert it points at primary_cert.
			const hasPrimaryCertIssue = result.error.issues.some((issue) => issue.path.includes('primary_cert'));
			expect(hasPrimaryCertIssue).toBe(true);
		}
	});

	it('accepts an entry with primary_cert omitted (optional)', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBeUndefined();
		}
	});

	it('accepts an explicit null primary_cert (cert-agnostic)', () => {
		const result = referenceEntrySchema.safeParse({ ...baseEntry, primary_cert: null });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.primary_cert).toBeNull();
		}
	});
});
