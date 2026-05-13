/**
 * Smoke test for the study app's palette command declarations.
 *
 * The full command-flow integration (host-app boost, search-pipeline merge)
 * is covered by `libs/help/src/commands/registry.test.ts`. This test
 * only verifies that the per-app command file declares the expected
 * commands and that register/unregister round-trips through the singleton
 * registry without throwing.
 */

import { paletteCommands } from '@ab/help';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `$app/navigation` is unavailable in vitest's node environment. Stub
// `goto` so the module under test loads without exploding; we never
// invoke a handler in this suite (per-app handlers exercise navigation,
// which is tested end-to-end in the playwright suite).
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

import { registerStudyCommands, STUDY_PALETTE_COMMANDS, unregisterStudyCommands } from './commands';

describe('study palette commands', () => {
	beforeEach(() => {
		paletteCommands.clear();
	});

	it('declares the expected commands', () => {
		const ids = STUDY_PALETTE_COMMANDS.map((c) => c.id);
		expect(ids).toEqual([
			'study.new-plan',
			'study.todays-reps',
			'study.memory-inbox',
			'study.open-dashboard',
			'study.new-card',
		]);
	});

	it('every command has surface=study (drives the host-boost story)', () => {
		for (const cmd of STUDY_PALETTE_COMMANDS) {
			expect(cmd.surface).toBe('study');
		}
	});

	it('register installs every command in the registry', () => {
		registerStudyCommands();
		const ids = paletteCommands.list().map((c) => c.id);
		expect(ids.length).toBe(STUDY_PALETTE_COMMANDS.length);
		for (const cmd of STUDY_PALETTE_COMMANDS) {
			expect(ids).toContain(cmd.id);
		}
	});

	it('register is idempotent (re-register does not throw)', () => {
		registerStudyCommands();
		expect(() => registerStudyCommands()).not.toThrow();
	});

	it('unregister removes every command', () => {
		registerStudyCommands();
		unregisterStudyCommands();
		expect(paletteCommands.list()).toEqual([]);
	});
});
