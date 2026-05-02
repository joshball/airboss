/**
 * A11y wiring -- audit actor combobox + job log stream toggle group.
 *
 * Closes critical #5 (audit combobox) and critical #6 (job-detail tablist)
 * from the chunk-6 hangar cluster review. Both fixes have to hold the
 * exact ARIA contract their pages declare; if a future refactor drops a
 * keyboard handler or breaks the active-descendant wiring, these tests
 * fail loudly.
 */

import { cleanup, render, screen, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import ActorComboboxHarness from './harnesses/ActorComboboxHarness.svelte';
import JobLogStreamToggleHarness from './harnesses/JobLogStreamToggleHarness.svelte';

afterEach(() => {
	cleanup();
});

const ACTORS = [
	{ id: 'usr_alpha', name: 'Alice Pilot', email: 'alice@example.test' },
	{ id: 'usr_bravo', name: 'Bob Pilot', email: 'bob@example.test' },
	{ id: 'usr_charlie', name: 'Carol Pilot', email: 'carol@example.test' },
];

describe('audit actor combobox -- ARIA + keyboard', () => {
	it('input declares the combobox contract on mount (collapsed, controls listbox)', () => {
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.getAttribute('aria-controls')).toBe('audit-actor-menu');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
		// No active descendant before the menu is open.
		expect(input.hasAttribute('aria-activedescendant')).toBe(false);
	});

	it('typing populates listbox with role="option" children (not buttons) and announces count', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');

		const listbox = screen.getByRole('listbox');
		const optionEls = within(listbox).getAllByRole('option');
		expect(optionEls).toHaveLength(3);
		// Children are <li> elements with role=option, not buttons. The
		// review explicitly called out the button-wrapper anti-pattern.
		for (const el of optionEls) {
			expect(el.tagName).toBe('LI');
		}
		// Polite live region announces the result count for screen readers.
		const announcement = document.getElementById('audit-actor-live');
		expect(announcement?.textContent).toMatch(/3 actors found/);
		expect(announcement?.getAttribute('aria-live')).toBe('polite');
	});

	it('ArrowDown opens the menu and updates aria-activedescendant', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');

		// First option auto-active after the search resolves.
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-0');

		await user.keyboard('{ArrowDown}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-1');

		await user.keyboard('{ArrowDown}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-2');

		// Wrap to first.
		await user.keyboard('{ArrowDown}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-0');
	});

	it('ArrowUp wraps from first to last; Home/End jump to bounds', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');

		// At index 0 -> ArrowUp wraps to last.
		await user.keyboard('{ArrowUp}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-2');

		await user.keyboard('{Home}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-0');

		await user.keyboard('{End}');
		expect(input.getAttribute('aria-activedescendant')).toBe('audit-actor-option-2');
	});

	it('only the active option carries aria-selected="true"', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');
		await user.keyboard('{ArrowDown}'); // index 1

		const options = screen.getAllByRole('option');
		expect(options[0].getAttribute('aria-selected')).toBe('false');
		expect(options[1].getAttribute('aria-selected')).toBe('true');
		expect(options[2].getAttribute('aria-selected')).toBe('false');
	});

	it('Enter commits the active option without using the mouse', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');
		await user.keyboard('{ArrowDown}{ArrowDown}'); // bob then carol -> index 2
		await user.keyboard('{Enter}');

		// Listbox closed after commit, picked id reflects the active option.
		expect(screen.queryByRole('listbox')).toBeNull();
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(screen.getByTestId('picked-id').textContent).toBe('usr_charlie');
	});

	it('Escape closes the menu and drops aria-activedescendant', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('Pilot');
		expect(input.getAttribute('aria-expanded')).toBe('true');

		await user.keyboard('{Escape}');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.hasAttribute('aria-activedescendant')).toBe(false);
		expect(screen.queryByRole('listbox')).toBeNull();
	});

	it('zero-result search announces "No actors found." and leaves no listbox', async () => {
		const user = userEvent.setup();
		render(ActorComboboxHarness, { options: ACTORS });
		const input = screen.getByRole('combobox');
		await user.click(input);
		await user.keyboard('zzzzz-no-match');

		expect(screen.queryByRole('listbox')).toBeNull();
		const announcement = document.getElementById('audit-actor-live');
		expect(announcement?.textContent).toBe('No actors found.');
	});
});

describe('job log stream filter -- toggle group, not tablist', () => {
	it('renders as a role="group" container, not a tablist', () => {
		render(JobLogStreamToggleHarness);
		// Must NOT shape-shift back into the tablist anti-pattern.
		expect(screen.queryByRole('tablist')).toBeNull();
		expect(screen.queryAllByRole('tab')).toHaveLength(0);
		const group = screen.getByRole('group', { name: 'Filter log stream' });
		expect(group).toBeTruthy();
	});

	it('exposes 4 toggle buttons with aria-pressed reflecting selection', async () => {
		const user = userEvent.setup();
		render(JobLogStreamToggleHarness);
		const group = screen.getByRole('group', { name: 'Filter log stream' });
		const buttons = within(group).getAllByRole('button');
		expect(buttons).toHaveLength(4);

		// Initial state: 'all' is pressed.
		expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
		expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
		expect(buttons[2].getAttribute('aria-pressed')).toBe('false');
		expect(buttons[3].getAttribute('aria-pressed')).toBe('false');

		await user.click(buttons[2]); // stderr
		expect(buttons[0].getAttribute('aria-pressed')).toBe('false');
		expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
		expect(screen.getByTestId('active-stream').textContent).toBe('stderr');
	});

	it('keyboard activation (Space / Enter) toggles selection', async () => {
		const user = userEvent.setup();
		render(JobLogStreamToggleHarness);
		const group = screen.getByRole('group', { name: 'Filter log stream' });
		const [, stdout, , event] = within(group).getAllByRole('button');

		stdout.focus();
		await user.keyboard(' ');
		expect(stdout.getAttribute('aria-pressed')).toBe('true');
		expect(screen.getByTestId('active-stream').textContent).toBe('stdout');

		event.focus();
		await user.keyboard('{Enter}');
		expect(event.getAttribute('aria-pressed')).toBe('true');
		expect(stdout.getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByTestId('active-stream').textContent).toBe('event');
	});
});
