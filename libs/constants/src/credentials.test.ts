/**
 * Constants tests for the credential / syllabus / goal taxonomies.
 *
 * The runtime values double as a CHECK-constraint source of truth for
 * Drizzle (`libs/bc/study/src/schema.ts`) and as enums consumed by Zod
 * schemas. Tests here are guards: a regression in the closed-enum invariants
 * propagates silently into bad rows + bad runtime narrowing.
 */

import { describe, expect, it } from 'vitest';
import {
	AIRPLANE_CLASS_LABELS,
	AIRPLANE_CLASS_VALUES,
	AIRPLANE_CLASSES,
	type AirplaneClass,
	CREDENTIAL_CLASS_VALUES,
	CREDENTIAL_CLASSES,
} from './credentials';

describe('AIRPLANE_CLASSES', () => {
	it('exposes the four FAA airplane classes (ASEL/AMEL/ASES/AMES)', () => {
		expect(AIRPLANE_CLASS_VALUES).toStrictEqual(['asel', 'amel', 'ases', 'ames']);
	});

	it('label record covers every value', () => {
		for (const value of AIRPLANE_CLASS_VALUES) {
			expect(AIRPLANE_CLASS_LABELS[value]).toBeTruthy();
		}
	});

	it('uses lowercase kebab-case slugs (matches DB CHECK constraint)', () => {
		for (const value of AIRPLANE_CLASS_VALUES) {
			expect(value).toMatch(/^[a-z]+$/);
		}
	});

	it('every key maps to its lowercased value', () => {
		expect(AIRPLANE_CLASSES.ASEL).toBe('asel');
		expect(AIRPLANE_CLASSES.AMEL).toBe('amel');
		expect(AIRPLANE_CLASSES.ASES).toBe('ases');
		expect(AIRPLANE_CLASSES.AMES).toBe('ames');
	});

	it('AirplaneClass type narrows on the const map values', () => {
		const cls: AirplaneClass = AIRPLANE_CLASSES.AMEL;
		expect(cls).toBe('amel');
	});

	it('does not collide with the broader CREDENTIAL_CLASSES taxonomy', () => {
		// CREDENTIAL_CLASSES carries the full set including helicopter / glider /
		// airship / balloon / etc. AIRPLANE_CLASSES is the airplane-only subset
		// used for `syllabus_node.classes` scoping. The overlapping keys (single-
		// engine-land, multi-engine-land, etc.) intentionally use different slugs
		// (`asel` vs `single-engine-land`) so the two enums never get confused.
		const credentialSlugs = new Set<string>(CREDENTIAL_CLASS_VALUES);
		for (const slug of AIRPLANE_CLASS_VALUES) {
			expect(credentialSlugs.has(slug)).toBe(false);
		}
		expect(CREDENTIAL_CLASSES.SINGLE_ENGINE_LAND).toBe('single-engine-land');
		expect(AIRPLANE_CLASSES.ASEL).toBe('asel');
	});
});
