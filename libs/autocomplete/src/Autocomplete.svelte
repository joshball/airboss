<script lang="ts">
import { tick } from 'svelte';
import type { AutocompleteEntry, AutocompleteSource } from './types';

/**
 * Generic autocomplete-wrapped input. Hosts pass pluggable sources; the
 * component handles trigger / highlight / commit / dismiss.
 *
 * APG combobox semantics (W3C ARIA Authoring Practices, combobox + listbox):
 *   - Input: `role="combobox"`, `aria-autocomplete="list"`,
 *     `aria-controls`, `aria-expanded`, `aria-activedescendant`.
 *   - Listbox: `role="listbox"` with each row `role="option"` +
 *     `aria-selected`.
 *
 * Keyboard model (see design/mockups/search/mockup-03-autocomplete.md):
 *   - Up/Down               move highlight inside the dropdown
 *   - Tab                   commit highlighted entry; dropdown closes
 *   - Enter (open)          same as Tab
 *   - Enter (closed)        invoke `onEnter` (host runs the search)
 *   - Cmd/Ctrl+Enter (open) commit + signal meta intent (filter chip)
 *   - Esc                   dismiss dropdown only; value preserved
 *
 * The dropdown is positioned absolutely under the input via the wrapper's
 * relative positioning. Hosts can re-style via the `.autocomplete` /
 * `.dropdown` class hooks below.
 */

import type { AutocompleteProps } from './types';

let {
	value = $bindable(''),
	sources,
	onCommit,
	onCommitMeta,
	onDismiss,
	onEnter,
	placeholder,
	ariaLabel,
	inputId,
	testId = 'autocomplete',
	autofocus = false,
}: AutocompleteProps = $props();

let inputEl = $state<HTMLInputElement | null>(null);

/** True when the user has dismissed the dropdown for the current input. */
let dismissed = $state(false);

/**
 * Derived match list. Sources fire in order; the first source returning
 * a non-null value wins. A source returning `[]` is "applied but empty"
 * and the dropdown closes (we don't fall through to a different source).
 * A source returning `null` defers to the next source.
 */
const matches = $derived<readonly AutocompleteEntry[]>(buildMatches(value, sources));

function buildMatches(input: string, available: readonly AutocompleteSource[]): readonly AutocompleteEntry[] {
	for (const source of available) {
		const result = source.match(input);
		if (result === null) continue;
		return result;
	}
	return [];
}

let highlighted = $state(0);

// Keep the highlighted index inside bounds whenever the match set changes.
// Reset to top when the user types: fresh keystroke -> fresh highlight.
$effect(() => {
	void matches.length;
	highlighted = 0;
});

// Re-arm the dropdown whenever the user types. A dismissed dropdown reopens
// on the next keystroke so the user can recover from an accidental Esc.
$effect(() => {
	void value;
	dismissed = false;
});

const isOpen = $derived(!dismissed && matches.length > 0);
const listboxId = $derived(`${testId}-listbox`);
const activeOptionId = $derived<string | undefined>(
	isOpen && matches[highlighted] ? `${testId}-option-${matches[highlighted].id}` : undefined,
);

/**
 * Commit an entry: replace the input value with its canonical form, hide
 * the dropdown, signal the host. Caller picks whether to invoke the
 * primary callback (Tab / Enter) or the meta callback (Cmd+Enter) before
 * the commit lands.
 */
function commitEntry(entry: AutocompleteEntry, meta: boolean): void {
	value = entry.canonicalForm;
	dismissed = true;
	if (meta) {
		(onCommitMeta ?? onCommit)(entry);
	} else {
		onCommit(entry);
	}
	// Keep the cursor at end of the newly-committed text so the user can
	// keep typing past the canonical form (e.g. add a refining word).
	void tick().then(() => {
		if (!inputEl) return;
		const end = inputEl.value.length;
		inputEl.setSelectionRange(end, end);
	});
}

function handleKey(event: KeyboardEvent): void {
	if (isOpen) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlighted = (highlighted + 1) % matches.length;
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlighted = (highlighted - 1 + matches.length) % matches.length;
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			dismissed = true;
			onDismiss?.();
			return;
		}
		if (event.key === 'Tab') {
			const chosen = matches[highlighted];
			if (!chosen) return;
			event.preventDefault();
			commitEntry(chosen, false);
			return;
		}
		if (event.key === 'Enter') {
			const chosen = matches[highlighted];
			if (!chosen) return;
			event.preventDefault();
			const meta = event.metaKey || event.ctrlKey;
			commitEntry(chosen, meta);
			return;
		}
	} else if (event.key === 'Enter') {
		// Dropdown closed (no matches OR dismissed): defer to the host.
		// The host runs its search / submit; we never reopen the dropdown
		// from inside `onEnter`.
		event.preventDefault();
		onEnter?.();
	}
}

function onClickEntry(entry: AutocompleteEntry, ev: MouseEvent): void {
	const meta = ev.metaKey || ev.ctrlKey;
	commitEntry(entry, meta);
	// After mouse commit, return focus to the input so the keyboard model
	// stays continuous.
	void tick().then(() => inputEl?.focus());
}

function onMouseEnterEntry(index: number): void {
	highlighted = index;
}

// Expose the input element so hosts can `bind:this` and focus it without
// duplicating the input markup.
export function focus(): void {
	inputEl?.focus();
}

// Mount: optional autofocus.
$effect(() => {
	if (autofocus && inputEl) {
		inputEl.focus();
	}
});
</script>

<div class="autocomplete" data-testid={testId}>
	<input
		bind:this={inputEl}
		bind:value
		onkeydown={handleKey}
		type="text"
		role="combobox"
		id={inputId}
		placeholder={placeholder}
		autocomplete="off"
		spellcheck="false"
		aria-label={ariaLabel}
		aria-autocomplete="list"
		aria-controls={listboxId}
		aria-expanded={isOpen ? 'true' : 'false'}
		aria-activedescendant={activeOptionId}
		data-testid="{testId}-input"
	/>

	{#if isOpen}
		<ul
			class="dropdown"
			role="listbox"
			id={listboxId}
			aria-label={ariaLabel ? `${ariaLabel} suggestions` : 'Suggestions'}
			data-testid="{testId}-listbox"
		>
			{#each matches as entry, index (entry.id)}
				{@const isHighlighted = index === highlighted}
				<li
					role="option"
					id="{testId}-option-{entry.id}"
					aria-selected={isHighlighted}
					class:highlighted={isHighlighted}
					data-source-id={entry.sourceId ?? ''}
				>
					<!-- svelte-ignore a11y_click_events_have_key_events -- keyboard
						navigation lives on the input via the combobox pattern; the
						listbox itself is mouse-only. -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<button
						type="button"
						class="entry"
						onclick={(ev) => onClickEntry(entry, ev)}
						onmouseenter={() => onMouseEnterEntry(index)}
						data-testid="{testId}-option-button"
						data-entry-id={entry.id}
					>
						<span class="display">{entry.display}</span>
						{#if entry.secondary}
							<span class="secondary">{entry.secondary}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.autocomplete {
		position: relative;
		width: 100%;
	}

	input {
		width: 100%;
		border: 0;
		outline: none;
		background: transparent;
		font: inherit;
		color: inherit;
		padding: var(--space-sm) 0;
	}

	input:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin: 0;
		padding: var(--space-2xs);
		list-style: none;
		max-height: 18rem;
		overflow-y: auto;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		z-index: 1;
	}

	li {
		list-style: none;
	}

	.entry {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: baseline;
		gap: var(--space-sm);
		width: 100%;
		text-align: left;
		font: inherit;
		font-size: var(--font-size-sm);
		padding: var(--space-2xs) var(--space-sm);
		border: 0;
		background: transparent;
		color: inherit;
		border-radius: var(--radius-xs);
		cursor: pointer;
	}

	.entry:hover,
	li.highlighted .entry {
		background: var(--palette-accent-amber-wash);
		color: var(--ink-body);
	}

	.display {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.secondary {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--palette-accent-amber);
		font-weight: var(--font-weight-semibold);
	}
</style>
