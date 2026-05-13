/**
 * Tests for the in-memory `PaletteCommandRegistry` -- Phase 4.
 */

import type { AppId } from '@ab/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedQuery } from '../schema/help-registry';
import { paletteCommands } from './registry';
import type { PaletteCommand } from './types';

function makeQuery(freeText: string): ParsedQuery {
	return { freeText, filters: [], warnings: [] };
}

function makeCommand(overrides: Partial<PaletteCommand> & { id: string; surface: AppId }): PaletteCommand {
	return {
		id: overrides.id,
		type: overrides.type ?? 'cmd.goto',
		label: overrides.label ?? `Command ${overrides.id}`,
		keywords: overrides.keywords ?? [],
		surface: overrides.surface,
		handler: overrides.handler ?? (() => undefined),
		subtitle: overrides.subtitle,
		icon: overrides.icon,
	};
}

describe('paletteCommands', () => {
	beforeEach(() => {
		paletteCommands.clear();
	});

	describe('register / unregister / list', () => {
		it('registers a command and lists it', () => {
			const cmd = makeCommand({ id: 'study.new-plan', surface: 'study' });
			paletteCommands.register(cmd);
			expect(paletteCommands.list()).toEqual([cmd]);
		});

		it('preserves insertion order in list()', () => {
			const a = makeCommand({ id: 'study.a', surface: 'study', label: 'Zeta' });
			const b = makeCommand({ id: 'study.b', surface: 'study', label: 'Alpha' });
			paletteCommands.register(a);
			paletteCommands.register(b);
			const ids = paletteCommands.list().map((c) => c.id);
			expect(ids).toEqual(['study.a', 'study.b']);
		});

		it('throws on duplicate id', () => {
			const cmd = makeCommand({ id: 'study.new-plan', surface: 'study' });
			paletteCommands.register(cmd);
			expect(() => paletteCommands.register(cmd)).toThrow(/duplicate id/);
		});

		it('unregister removes the command', () => {
			const cmd = makeCommand({ id: 'study.new-plan', surface: 'study' });
			paletteCommands.register(cmd);
			paletteCommands.unregister('study.new-plan');
			expect(paletteCommands.list()).toEqual([]);
		});

		it('unregister is a no-op for unknown ids', () => {
			paletteCommands.unregister('does.not.exist');
			expect(paletteCommands.list()).toEqual([]);
		});

		it('clear() wipes the registry', () => {
			paletteCommands.register(makeCommand({ id: 'a', surface: 'study' }));
			paletteCommands.register(makeCommand({ id: 'b', surface: 'sim' }));
			paletteCommands.clear();
			expect(paletteCommands.list()).toEqual([]);
		});
	});

	describe('search', () => {
		it('matches against the label (case-insensitive)', () => {
			paletteCommands.register(makeCommand({ id: 'study.new-plan', surface: 'study', label: 'New plan' }));
			paletteCommands.register(makeCommand({ id: 'study.reps', surface: 'study', label: "Go to today's reps" }));
			const results = paletteCommands.search(makeQuery('PLAN'), 'study');
			expect(results.map((r) => r.id)).toEqual(['study.new-plan']);
		});

		it('matches against keywords (case-insensitive)', () => {
			paletteCommands.register(
				makeCommand({
					id: 'study.memory',
					surface: 'study',
					label: 'Memory inbox',
					keywords: ['inbox', 'cards', 'pending'],
				}),
			);
			const results = paletteCommands.search(makeQuery('cards'), 'study');
			expect(results.map((r) => r.id)).toEqual(['study.memory']);
		});

		it('returns every command for an empty query', () => {
			paletteCommands.register(makeCommand({ id: 'study.a', surface: 'study', label: 'Alpha' }));
			paletteCommands.register(makeCommand({ id: 'sim.b', surface: 'sim', label: 'Bravo' }));
			const results = paletteCommands.search(makeQuery(''), 'study');
			expect(results).toHaveLength(2);
		});

		it('applies host-surface boost: host commands sort first', () => {
			paletteCommands.register(makeCommand({ id: 'sim.start', surface: 'sim', label: 'Start new sim' }));
			paletteCommands.register(makeCommand({ id: 'study.new-plan', surface: 'study', label: 'New plan' }));
			paletteCommands.register(makeCommand({ id: 'hangar.audit', surface: 'hangar', label: 'Open audit log' }));
			const results = paletteCommands.search(makeQuery(''), 'study');
			// study.new-plan first (host); the other two follow in alpha order
			// by label ("Open audit log" before "Start new sim").
			expect(results.map((r) => r.id)).toEqual(['study.new-plan', 'hangar.audit', 'sim.start']);
		});

		it('within the same surface, sorts alphabetically by label', () => {
			paletteCommands.register(makeCommand({ id: 'study.zeta', surface: 'study', label: 'Zeta thing' }));
			paletteCommands.register(makeCommand({ id: 'study.alpha', surface: 'study', label: 'Alpha thing' }));
			paletteCommands.register(makeCommand({ id: 'study.middle', surface: 'study', label: 'Middle thing' }));
			const results = paletteCommands.search(makeQuery(''), 'study');
			expect(results.map((r) => r.id)).toEqual(['study.alpha', 'study.middle', 'study.zeta']);
		});

		it('filters by free-text AND respects host boost', () => {
			paletteCommands.register(makeCommand({ id: 'study.new-plan', surface: 'study', label: 'New plan' }));
			paletteCommands.register(makeCommand({ id: 'hangar.new-doc', surface: 'hangar', label: 'New doc' }));
			paletteCommands.register(makeCommand({ id: 'study.reps', surface: 'study', label: "Go to today's reps" }));
			const results = paletteCommands.search(makeQuery('new'), 'hangar');
			// Host hangar.new-doc first; then study.new-plan.
			expect(results.map((r) => r.id)).toEqual(['hangar.new-doc', 'study.new-plan']);
		});
	});

	describe('handler invocation', () => {
		it('handlers are stored verbatim and invokable from list()', async () => {
			const handler = vi.fn();
			paletteCommands.register(makeCommand({ id: 'study.action', surface: 'study', type: 'cmd.action', handler }));
			const [cmd] = paletteCommands.list();
			expect(cmd).toBeDefined();
			if (!cmd) return;
			await cmd.handler();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('supports async handlers', async () => {
			let resolved = false;
			paletteCommands.register(
				makeCommand({
					id: 'study.async',
					surface: 'study',
					type: 'cmd.action',
					handler: async () => {
						await Promise.resolve();
						resolved = true;
					},
				}),
			);
			const [cmd] = paletteCommands.list();
			expect(cmd).toBeDefined();
			if (!cmd) return;
			await cmd.handler();
			expect(resolved).toBe(true);
		});
	});
});
