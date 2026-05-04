/**
 * Identity tests for cross-file BC error classes. The barrel re-exports
 * `SourceRefRequiredError` and `UpsertReturnedNoRowError` from one place;
 * sibling modules (`cards`, `scenarios`) re-export the same class. These
 * assertions guard against the regression that motivated the dedupe:
 * previously two distinct classes shared a name, only one was barreled,
 * and `instanceof` against the barrel-exported class silently missed the
 * other module's variant.
 */

import { describe, expect, it } from 'vitest';
import { SourceRefRequiredError as CardsSourceRefRequiredError } from './cards';
import { SourceRefRequiredError as BarrelSourceRefRequiredError, UpsertReturnedNoRowError } from './errors';
import { SourceRefRequiredError as ScenariosSourceRefRequiredError } from './scenarios';

describe('SourceRefRequiredError class identity', () => {
	it('cards re-exports the barrel class (same constructor)', () => {
		expect(CardsSourceRefRequiredError).toBe(BarrelSourceRefRequiredError);
	});

	it('scenarios re-exports the barrel class (same constructor)', () => {
		expect(ScenariosSourceRefRequiredError).toBe(BarrelSourceRefRequiredError);
	});

	it('an instance from cards passes instanceof against the barrel class', () => {
		const err = new CardsSourceRefRequiredError();
		expect(err).toBeInstanceOf(BarrelSourceRefRequiredError);
	});

	it('an instance from scenarios passes instanceof against the barrel class', () => {
		const err = new ScenariosSourceRefRequiredError();
		expect(err).toBeInstanceOf(BarrelSourceRefRequiredError);
	});

	it('error.name is stable for log search', () => {
		expect(new BarrelSourceRefRequiredError().name).toBe('SourceRefRequiredError');
	});
});

describe('UpsertReturnedNoRowError', () => {
	it('exposes entity + id as structured public fields', () => {
		const err = new UpsertReturnedNoRowError('goal', 'goal_01');
		expect(err.entity).toBe('goal');
		expect(err.id).toBe('goal_01');
	});

	it('error.name is stable for log search', () => {
		expect(new UpsertReturnedNoRowError('credential', 'cred_01').name).toBe('UpsertReturnedNoRowError');
	});

	it('extends Error so existing instanceof Error catches still work', () => {
		const err = new UpsertReturnedNoRowError('syllabus', 'syl_01');
		expect(err).toBeInstanceOf(Error);
	});

	it('message includes both entity and id for plain-text log scans', () => {
		const err = new UpsertReturnedNoRowError('syllabus_node', 'sn_01');
		expect(err.message).toContain('syllabus_node');
		expect(err.message).toContain('sn_01');
	});
});
