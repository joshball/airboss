<script lang="ts">
/**
 * `<TagChipInput>` -- chip-style tag editor used by `<NoteComposer>`
 * and `<NoteContextPicker>`. Press Enter or comma to commit a chip;
 * Backspace on an empty input pops the last chip.
 *
 * Pure component: emits `onchange(tags)` with the updated array. The
 * parent decides what to do with the value (form serialization, BC
 * call, etc.). Deduplication + length cap mirror the BC validator
 * (`tagsSchema` in `libs/bc/study/src/notes.ts`).
 *
 * Phase-3 autocomplete: when `suggestionsEndpoint` is set, the
 * component fetches `{ tags: string[] }` once on first focus (cached
 * for the lifetime of the component) and renders a dropdown of matches
 * keyed off the current draft. ↑/↓ navigates; Enter / Tab commits the
 * highlighted suggestion (or the typed draft when nothing's
 * highlighted). Click on a suggestion commits it.
 *
 * The endpoint contract is intentionally minimal so any surface
 * (notes / cards / future) can wire its own tag corpus.
 */

import { NOTE_TAG_MAX_LENGTH, NOTE_TAGS_MAX } from '@ab/constants';

let {
	tags = [],
	onchange,
	disabled = false,
	id = 'note-tags-input',
	'aria-describedby': ariaDescribedBy,
	suggestionsEndpoint = null,
	suggestions: suggestionsProp = null,
}: {
	tags?: string[];
	onchange: (tags: string[]) => void;
	disabled?: boolean;
	id?: string;
	'aria-describedby'?: string;
	/**
	 * URL of an endpoint returning `{ tags: string[] }`. Fetched once
	 * on first focus. Pass `null` to disable autocomplete.
	 */
	suggestionsEndpoint?: string | null;
	/**
	 * Synchronous suggestion source. When set, autocomplete uses this
	 * list and does NOT fetch from the endpoint. Useful for tests and
	 * for surfaces that already loaded the list server-side.
	 */
	suggestions?: string[] | null;
} = $props();

let draft = $state('');
let inputEl = $state<HTMLInputElement | null>(null);

// `suggestionsProp` is captured at mount time to seed the initial cache;
// later prop changes re-flow into `fetched` via the $derived below.
let fetched = $state<string[] | null>(null);
let highlightIndex = $state(-1);
let dropdownOpen = $state(false);
let pendingFetch = false;
$effect(() => {
	if (suggestionsProp !== null) fetched = suggestionsProp;
});

async function ensureFetched(): Promise<void> {
	if (fetched !== null) return;
	if (suggestionsProp !== null) {
		fetched = suggestionsProp;
		return;
	}
	if (suggestionsEndpoint === null) return;
	if (pendingFetch) return;
	pendingFetch = true;
	try {
		const res = await fetch(suggestionsEndpoint, { credentials: 'same-origin' });
		if (!res.ok) {
			fetched = [];
			return;
		}
		const data = (await res.json()) as { tags?: unknown };
		fetched = Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === 'string') : [];
	} catch {
		fetched = [];
	} finally {
		pendingFetch = false;
	}
}

const filteredSuggestions = $derived.by<string[]>(() => {
	if (fetched === null) return [];
	const lowerSelected = new Set(tags.map((t) => t.toLowerCase()));
	const draftLower = draft.trim().toLowerCase();
	const candidates = fetched.filter((t) => !lowerSelected.has(t.toLowerCase()));
	if (draftLower.length === 0) return candidates.slice(0, 8);
	return candidates.filter((t) => t.toLowerCase().includes(draftLower)).slice(0, 8);
});

function commit(value?: string): void {
	const raw = value ?? draft;
	const trimmed = raw.trim();
	draft = '';
	highlightIndex = -1;
	if (trimmed.length === 0) return;
	if (trimmed.length > NOTE_TAG_MAX_LENGTH) return;
	if (tags.length >= NOTE_TAGS_MAX) return;
	const lower = trimmed.toLowerCase();
	if (tags.some((t) => t.toLowerCase() === lower)) return;
	onchange([...tags, trimmed]);
}

function removeAt(index: number): void {
	const next = tags.slice();
	next.splice(index, 1);
	onchange(next);
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'ArrowDown' && filteredSuggestions.length > 0) {
		event.preventDefault();
		highlightIndex = (highlightIndex + 1) % filteredSuggestions.length;
		return;
	}
	if (event.key === 'ArrowUp' && filteredSuggestions.length > 0) {
		event.preventDefault();
		highlightIndex = highlightIndex <= 0 ? filteredSuggestions.length - 1 : highlightIndex - 1;
		return;
	}
	if (event.key === 'Escape') {
		dropdownOpen = false;
		highlightIndex = -1;
		return;
	}
	if (event.key === 'Enter' || event.key === ',') {
		event.preventDefault();
		const choice =
			highlightIndex >= 0 && filteredSuggestions[highlightIndex] !== undefined
				? filteredSuggestions[highlightIndex]
				: draft;
		commit(choice);
		return;
	}
	if (event.key === 'Tab' && draft.length > 0 && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
		event.preventDefault();
		const choice =
			highlightIndex >= 0 && filteredSuggestions[highlightIndex] !== undefined
				? filteredSuggestions[highlightIndex]
				: draft;
		commit(choice);
		return;
	}
	if (event.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
		event.preventDefault();
		const next = tags.slice(0, -1);
		onchange(next);
	}
}

function onFocus(): void {
	dropdownOpen = true;
	void ensureFetched();
}

function onBlur(): void {
	if (draft.trim().length > 0) commit();
	// Defer dropdown close so a click on a suggestion lands.
	window.setTimeout(() => {
		dropdownOpen = false;
		highlightIndex = -1;
	}, 120);
}

function onSuggestionMousedown(event: MouseEvent, value: string): void {
	// Use mousedown + preventDefault so the input doesn't blur before we
	// commit. (blur clears the dropdown.)
	event.preventDefault();
	commit(value);
	inputEl?.focus();
}

const showDropdown = $derived(dropdownOpen && filteredSuggestions.length > 0);
</script>

<div class="root" data-testid="tag-chip-input">
	{#each tags as tag, i (tag)}
		<span class="chip" data-testid="tag-chip">
			<span class="label">{tag}</span>
			<button
				type="button"
				class="remove"
				aria-label={`Remove tag ${tag}`}
				onclick={() => removeAt(i)}
				{disabled}
				data-testid="tag-chip-remove"
			>
				×
			</button>
		</span>
	{/each}
	<div class="input-wrap">
		<input
			bind:this={inputEl}
			bind:value={draft}
			type="text"
			{id}
			class="input"
			placeholder={tags.length === 0 ? 'Add tags' : ''}
			onkeydown={onKeydown}
			onfocus={onFocus}
			onblur={onBlur}
			maxlength={NOTE_TAG_MAX_LENGTH}
			{disabled}
			aria-describedby={ariaDescribedBy}
			aria-autocomplete={suggestionsEndpoint !== null || suggestionsProp !== null ? 'list' : undefined}
			data-testid="tag-chip-input-field"
		/>
		{#if showDropdown}
			<ul class="dropdown" data-testid="tag-chip-suggestions">
				{#each filteredSuggestions as suggestion, i (suggestion)}
					<li>
						<button
							type="button"
							class="suggestion"
							class:active={i === highlightIndex}
							onmousedown={(e) => onSuggestionMousedown(e, suggestion)}
							onmouseenter={() => (highlightIndex = i)}
							data-testid="tag-chip-suggestion"
						>
							#{suggestion}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.root {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		align-items: center;
		padding: var(--space-2xs) var(--space-xs);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		position: relative;
	}
	.root:focus-within {
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-2xs);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
	}
	.label {
		color: var(--ink-body);
	}
	.remove {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		cursor: pointer;
		font-size: var(--font-size-sm);
		line-height: 1;
		padding: 0 var(--space-3xs);
	}
	.remove:hover {
		color: var(--ink-body);
	}
	.input-wrap {
		flex: 1;
		min-width: 6rem;
		position: relative;
	}
	.input {
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: var(--ink-body);
		font: inherit;
		padding: var(--space-3xs) 0;
	}
	.dropdown {
		list-style: none;
		margin: 0;
		padding: var(--space-3xs) 0;
		position: absolute;
		top: calc(100% + var(--space-3xs));
		left: 0;
		min-width: 12rem;
		max-height: 14rem;
		overflow-y: auto;
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
		z-index: 12;
	}
	.suggestion {
		display: block;
		width: 100%;
		text-align: left;
		padding: var(--space-2xs) var(--space-sm);
		background: transparent;
		border: none;
		color: var(--ink-body);
		font: inherit;
		cursor: pointer;
	}
	.suggestion.active,
	.suggestion:hover {
		background: var(--surface-sunken);
	}
</style>
