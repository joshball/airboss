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
 */

import { NOTE_TAG_MAX_LENGTH, NOTE_TAGS_MAX } from '@ab/constants';

let {
	tags = [],
	onchange,
	disabled = false,
	id = 'note-tags-input',
	'aria-describedby': ariaDescribedBy,
}: {
	tags?: string[];
	onchange: (tags: string[]) => void;
	disabled?: boolean;
	id?: string;
	'aria-describedby'?: string;
} = $props();

let draft = $state('');
let inputEl = $state<HTMLInputElement | null>(null);

function commit(): void {
	const trimmed = draft.trim();
	draft = '';
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
	if (event.key === 'Enter' || event.key === ',') {
		event.preventDefault();
		commit();
	} else if (event.key === 'Backspace' && draft.length === 0 && tags.length > 0) {
		event.preventDefault();
		const next = tags.slice(0, -1);
		onchange(next);
	}
}

function onBlur(): void {
	if (draft.trim().length > 0) commit();
}
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
	<input
		bind:this={inputEl}
		bind:value={draft}
		type="text"
		{id}
		class="input"
		placeholder={tags.length === 0 ? 'Add tags' : ''}
		onkeydown={onKeydown}
		onblur={onBlur}
		maxlength={NOTE_TAG_MAX_LENGTH}
		{disabled}
		aria-describedby={ariaDescribedBy}
		data-testid="tag-chip-input-field"
	/>
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
	.input {
		flex: 1;
		min-width: 6rem;
		border: none;
		outline: none;
		background: transparent;
		color: var(--ink-body);
		font: inherit;
		padding: var(--space-3xs) 0;
	}
</style>
