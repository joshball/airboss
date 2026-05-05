/**
 * Unit tests for the glossary-drawer state machine. The state lives in
 * `.svelte.ts` so the rune-backed fields are reactive when consumed by
 * a Svelte component; assignment-and-read works fine in plain Vitest
 * tests too (Svelte 5's runes degrade to regular property accessors
 * outside a tracking context).
 */

import { describe, expect, it } from 'vitest';
import { GlossaryDrawerState } from '../src/lib/glossary-drawer-state.svelte';

describe('GlossaryDrawerState', () => {
	it('starts closed with empty query and no selection', () => {
		const s = new GlossaryDrawerState();
		expect(s.open).toBe(false);
		expect(s.query).toBe('');
		expect(s.selected).toBeNull();
	});

	it('open / close transitions update the open flag', () => {
		const s = new GlossaryDrawerState();
		s.openDrawer();
		expect(s.open).toBe(true);
		s.closeDrawer();
		expect(s.open).toBe(false);
	});

	it('toggle flips between open and closed', () => {
		const s = new GlossaryDrawerState();
		s.toggle();
		expect(s.open).toBe(true);
		s.toggle();
		expect(s.open).toBe(false);
	});

	it('closing clears the selection but preserves the query', () => {
		const s = new GlossaryDrawerState();
		s.openDrawer();
		s.setQuery('cal');
		s.select('calibration');
		expect(s.selected).toBe('calibration');
		s.closeDrawer();
		expect(s.selected).toBeNull();
		expect(s.query).toBe('cal');
	});

	it('typing into the search clears the selection so the filtered list re-renders', () => {
		const s = new GlossaryDrawerState();
		s.openDrawer();
		s.select('plan');
		expect(s.selected).toBe('plan');
		s.setQuery('go');
		expect(s.selected).toBeNull();
		expect(s.query).toBe('go');
	});

	it('select / clearSelection round-trip', () => {
		const s = new GlossaryDrawerState();
		s.select('goal');
		expect(s.selected).toBe('goal');
		s.clearSelection();
		expect(s.selected).toBeNull();
	});
});
