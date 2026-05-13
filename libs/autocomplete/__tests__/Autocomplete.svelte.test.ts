/**
 * Autocomplete component DOM contract.
 *
 * Asserts the APG combobox semantics, keyboard model (Tab / Enter / Esc /
 * Cmd+Enter / arrow keys), and the source-pluggable trigger / commit cycle.
 *
 * Phase 3.5 / slice 3.5g of the command-palette WP. The tests use a
 * synthetic source so the component contract is exercised independently of
 * the real `@ab/aviation` registry.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Autocomplete from '../src/Autocomplete.svelte';
import type { AutocompleteEntry, AutocompleteSource } from '../src/types';

afterEach(() => {
	cleanup();
});

function makeStaticSource(entries: readonly AutocompleteEntry[]): AutocompleteSource {
	return {
		id: 'test-source',
		match(input: string) {
			const trimmed = input.trim().toLowerCase();
			if (trimmed.length === 0) return null;
			return entries.filter((e) => e.display.toLowerCase().includes(trimmed));
		},
	};
}

const SAMPLE: readonly AutocompleteEntry[] = [
	{ id: 'a', display: 'Apple', secondary: 'A-1', canonicalForm: 'Apple', sourceId: 'test-source' },
	{ id: 'b', display: 'Apricot', secondary: 'A-2', canonicalForm: 'Apricot', sourceId: 'test-source' },
	{ id: 'c', display: 'Banana', secondary: 'B-1', canonicalForm: 'Banana', sourceId: 'test-source' },
];

describe('Autocomplete -- mounting', () => {
	it('renders the input with role=combobox', () => {
		render(Autocomplete, { value: '', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		expect(input.tagName).toBe('INPUT');
		expect(input.getAttribute('role')).toBe('combobox');
		expect(input.getAttribute('aria-autocomplete')).toBe('list');
	});

	it('exposes aria-controls + aria-expanded on the input', () => {
		render(Autocomplete, { value: '', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		expect(input.getAttribute('aria-controls')).toBe('autocomplete-listbox');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	it('renders nothing in the dropdown when value is empty', () => {
		render(Autocomplete, { value: '', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		expect(screen.queryByTestId('autocomplete-listbox')).toBeNull();
	});
});

describe('Autocomplete -- source resolution', () => {
	it('opens the listbox when the first source returns matches', () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const listbox = screen.getByTestId('autocomplete-listbox');
		expect(listbox.getAttribute('role')).toBe('listbox');
		const options = listbox.querySelectorAll('[role="option"]');
		expect(options.length).toBe(2); // Apple, Apricot
	});

	it('marks the first option as aria-selected by default', () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const options = screen.getByTestId('autocomplete-listbox').querySelectorAll('[role="option"]');
		expect(options[0]?.getAttribute('aria-selected')).toBe('true');
		expect(options[1]?.getAttribute('aria-selected')).toBe('false');
	});

	it('reflects aria-expanded=true when dropdown is open', () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		expect(input.getAttribute('aria-expanded')).toBe('true');
	});

	it('falls through to the second source when the first returns null', () => {
		const first: AutocompleteSource = {
			id: 'first',
			match: () => null,
		};
		const second: AutocompleteSource = {
			id: 'second',
			match: (input) =>
				input
					? [{ id: 'x', display: 'Second source hit', canonicalForm: 'Second source hit', sourceId: 'second' }]
					: null,
		};
		render(Autocomplete, { value: 'q', sources: [first, second], onCommit: vi.fn() });
		const options = screen.getByTestId('autocomplete-listbox').querySelectorAll('[role="option"]');
		expect(options.length).toBe(1);
		expect(options[0]?.textContent ?? '').toMatch(/Second source hit/);
	});

	it('does NOT fall through when the first source returns an empty array', () => {
		const first: AutocompleteSource = { id: 'first', match: () => [] };
		const second: AutocompleteSource = {
			id: 'second',
			match: () => [{ id: 'x', display: 'Should not appear', canonicalForm: 'x', sourceId: 'second' }],
		};
		render(Autocomplete, { value: 'q', sources: [first, second], onCommit: vi.fn() });
		// Empty array from first source means "applied but empty"; listbox closes.
		expect(screen.queryByTestId('autocomplete-listbox')).toBeNull();
	});
});

describe('Autocomplete -- keyboard navigation', () => {
	it('ArrowDown moves selection to the next entry', async () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		const options = screen.getByTestId('autocomplete-listbox').querySelectorAll('[role="option"]');
		expect(options[0]?.getAttribute('aria-selected')).toBe('false');
		expect(options[1]?.getAttribute('aria-selected')).toBe('true');
	});

	it('ArrowDown wraps from last entry to first', async () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		const options = screen.getByTestId('autocomplete-listbox').querySelectorAll('[role="option"]');
		expect(options[0]?.getAttribute('aria-selected')).toBe('true');
	});

	it('ArrowUp from first entry wraps to last', async () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		const options = screen.getByTestId('autocomplete-listbox').querySelectorAll('[role="option"]');
		expect(options[1]?.getAttribute('aria-selected')).toBe('true');
	});

	it('Escape dismisses the dropdown but preserves the value and fires onDismiss', async () => {
		const onDismiss = vi.fn();
		render(Autocomplete, {
			value: 'ap',
			sources: [makeStaticSource(SAMPLE)],
			onCommit: vi.fn(),
			onDismiss,
		});
		expect(screen.queryByTestId('autocomplete-listbox')).not.toBeNull();
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByTestId('autocomplete-listbox')).toBeNull();
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});
});

describe('Autocomplete -- commit', () => {
	it('Tab commits the highlighted entry and fires onCommit', async () => {
		const onCommit = vi.fn();
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Tab' });
		expect(onCommit).toHaveBeenCalledTimes(1);
		const arg = onCommit.mock.calls[0]?.[0] as AutocompleteEntry | undefined;
		expect(arg?.canonicalForm).toBe('Apple');
	});

	it('Enter (dropdown open) commits the highlighted entry', async () => {
		const onCommit = vi.fn();
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it('Cmd+Enter prefers onCommitMeta when supplied', async () => {
		const onCommit = vi.fn();
		const onCommitMeta = vi.fn();
		render(Autocomplete, {
			value: 'ap',
			sources: [makeStaticSource(SAMPLE)],
			onCommit,
			onCommitMeta,
		});
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
		expect(onCommitMeta).toHaveBeenCalledTimes(1);
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('Cmd+Enter falls back to onCommit when onCommitMeta is omitted', async () => {
		const onCommit = vi.fn();
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit });
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it('Enter with dropdown closed invokes onEnter, not onCommit', async () => {
		const onCommit = vi.fn();
		const onEnter = vi.fn();
		// Empty value -> source returns null -> dropdown closed.
		render(Autocomplete, {
			value: '',
			sources: [makeStaticSource(SAMPLE)],
			onCommit,
			onEnter,
		});
		const input = screen.getByTestId('autocomplete-input');
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onEnter).toHaveBeenCalledTimes(1);
		expect(onCommit).not.toHaveBeenCalled();
	});

	it('clicking an entry commits it', async () => {
		const onCommit = vi.fn();
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit });
		const buttons = screen
			.getByTestId('autocomplete-listbox')
			.querySelectorAll('[data-testid="autocomplete-option-button"]');
		await fireEvent.click(buttons[1] as Element);
		expect(onCommit).toHaveBeenCalledTimes(1);
		const arg = onCommit.mock.calls[0]?.[0] as AutocompleteEntry | undefined;
		expect(arg?.canonicalForm).toBe('Apricot');
	});

	it('clicking with metaKey routes to onCommitMeta', async () => {
		const onCommit = vi.fn();
		const onCommitMeta = vi.fn();
		render(Autocomplete, {
			value: 'ap',
			sources: [makeStaticSource(SAMPLE)],
			onCommit,
			onCommitMeta,
		});
		const button = screen
			.getByTestId('autocomplete-listbox')
			.querySelector('[data-testid="autocomplete-option-button"]') as HTMLButtonElement | null;
		await fireEvent.click(button as Element, { metaKey: true });
		expect(onCommitMeta).toHaveBeenCalledTimes(1);
		expect(onCommit).not.toHaveBeenCalled();
	});
});

describe('Autocomplete -- a11y identifiers', () => {
	it('aria-activedescendant points at the highlighted option id', async () => {
		render(Autocomplete, { value: 'ap', sources: [makeStaticSource(SAMPLE)], onCommit: vi.fn() });
		const input = screen.getByTestId('autocomplete-input');
		const activeId = input.getAttribute('aria-activedescendant');
		expect(activeId).toMatch(/autocomplete-option-a$/);
		// Move down and re-check.
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(input.getAttribute('aria-activedescendant')).toMatch(/autocomplete-option-b$/);
	});

	it('uses the testId prop to namespace ids and data attributes', () => {
		render(Autocomplete, {
			value: 'ap',
			sources: [makeStaticSource(SAMPLE)],
			onCommit: vi.fn(),
			testId: 'palette-ac',
		});
		expect(screen.getByTestId('palette-ac-input')).not.toBeNull();
		expect(screen.getByTestId('palette-ac-listbox')).not.toBeNull();
		const input = screen.getByTestId('palette-ac-input');
		expect(input.getAttribute('aria-controls')).toBe('palette-ac-listbox');
	});
});
