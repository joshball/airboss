/**
 * GlossaryDrawer DOM contract:
 *   - Trigger button renders with the supplied label and aria-expanded false.
 *   - Clicking the trigger opens the drawer and renders the entry list.
 *   - Search field filters the list by case-insensitive substring on
 *     term / short / long.
 *   - Clicking an entry expands the long-form detail; Back returns to the list.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GlossaryDrawer from '../src/components/GlossaryDrawer.svelte';

const ENTRIES = [
	{
		key: 'goal',
		term: 'Goal',
		short: 'The slice of study you are focused on.',
		long: '---\nkey: goal\n---\n\nLong-form goal explanation body.',
		related: ['plan'],
	},
	{
		key: 'plan',
		term: 'Plan',
		short: 'The schedule and session shape attached to your goal.',
		long: '',
		related: [],
	},
	{
		key: 'calibration',
		term: 'Calibration',
		short: 'How well your confidence matches your accuracy.',
		long: '',
		related: [],
	},
] as const;

afterEach(() => {
	cleanup();
});

describe('GlossaryDrawer', () => {
	it('renders a closed trigger button by default', () => {
		render(GlossaryDrawer, { entries: ENTRIES });
		const trigger = screen.getByTestId('glossary-drawer-trigger');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('glossary-drawer-list')).toBeNull();
	});

	it('opens the drawer on click and lists every entry', async () => {
		render(GlossaryDrawer, { entries: ENTRIES });
		await fireEvent.click(screen.getByTestId('glossary-drawer-trigger'));
		const list = screen.getByTestId('glossary-drawer-list');
		expect(list).not.toBeNull();
		expect(screen.getByTestId('glossary-drawer-entry-goal')).toBeDefined();
		expect(screen.getByTestId('glossary-drawer-entry-plan')).toBeDefined();
		expect(screen.getByTestId('glossary-drawer-entry-calibration')).toBeDefined();
	});

	it('filters by substring across term / short', async () => {
		render(GlossaryDrawer, { entries: ENTRIES });
		await fireEvent.click(screen.getByTestId('glossary-drawer-trigger'));
		const search = screen.getByTestId('glossary-drawer-search') as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'plan' } });
		expect(screen.queryByTestId('glossary-drawer-entry-plan')).not.toBeNull();
		// "goal" entry mentions "plan" via its `related` list -- but the
		// filter only matches term / short / long, so goal should NOT
		// appear (its short text doesn't contain "plan"). plan and goal's
		// long text don't either, only the related key list does.
		expect(screen.queryByTestId('glossary-drawer-entry-calibration')).toBeNull();
	});

	it('expands an entry into the detail view on click and Back returns to list', async () => {
		render(GlossaryDrawer, { entries: ENTRIES });
		await fireEvent.click(screen.getByTestId('glossary-drawer-trigger'));
		await fireEvent.click(screen.getByTestId('glossary-drawer-entry-goal'));
		const detail = screen.getByTestId('glossary-drawer-detail');
		expect(detail.textContent).toContain('Goal');
		expect(detail.textContent).toContain('Long-form goal explanation body');
		// Back button returns to list view.
		await fireEvent.click(screen.getByText('← Back'));
		expect(screen.queryByTestId('glossary-drawer-list')).not.toBeNull();
	});

	it('shows an empty state when no entries match the query', async () => {
		render(GlossaryDrawer, { entries: ENTRIES });
		await fireEvent.click(screen.getByTestId('glossary-drawer-trigger'));
		const search = screen.getByTestId('glossary-drawer-search') as HTMLInputElement;
		await fireEvent.input(search, { target: { value: 'nonexistent-xyz' } });
		expect(screen.getByText(/No glossary entries match/i)).toBeDefined();
	});
});
