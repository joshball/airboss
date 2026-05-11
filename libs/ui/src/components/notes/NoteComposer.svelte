<script lang="ts">
/**
 * `<NoteComposer>` -- markdown textarea + title + tag chip input +
 * follow-up toggle + context picker. Pure component: emits
 * `oncreate(input)` (when `mode === 'create'`) or `onsave(input)`
 * (when `mode === 'edit'`) with the form values; the parent wires it
 * to a form action.
 *
 * Cmd/Ctrl + Enter from any field submits.
 *
 * The component does not POST -- it serializes its state via `onsubmit`
 * and lets SvelteKit form actions handle the round trip. The native
 * `<form>` is included so a non-JS fallback still works.
 */

import { NOTE_BODY_MAX_LENGTH, NOTE_FOLLOW_UP_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '@ab/constants';
import NoteContextPicker from './NoteContextPicker.svelte';
import { EMPTY_NOTE_CONTEXT, type NoteContext, type NoteContextOptions } from './note-context-types';
import TagChipInput from './TagChipInput.svelte';

interface ComposerInput {
	bodyMd: string;
	title: string;
	context: NoteContext;
	tags: string[];
	followUpMd: string;
	quotedExcerpt: string;
}

let {
	mode = 'create',
	initial,
	contextOptions = {},
	oncreate,
	onsave,
	oncancel,
	disabled = false,
	formAction,
	formMethod = 'POST',
	intentName = 'create',
	submitLabel,
	cancelLabel = 'Cancel',
	bodyError,
	titleError,
	followUpError,
	autofocusBody = true,
	tagSuggestionsEndpoint = null,
	tagSuggestions = null,
}: {
	mode?: 'create' | 'edit';
	initial?: Partial<ComposerInput>;
	contextOptions?: NoteContextOptions;
	oncreate?: (input: ComposerInput) => void;
	onsave?: (input: ComposerInput) => void;
	oncancel?: () => void;
	disabled?: boolean;
	/** Form action target when used inside a SvelteKit form. */
	formAction?: string;
	formMethod?: 'POST' | 'GET';
	intentName?: string;
	submitLabel?: string;
	cancelLabel?: string;
	bodyError?: string | null;
	titleError?: string | null;
	followUpError?: string | null;
	autofocusBody?: boolean;
	/**
	 * Optional URL of an autocomplete endpoint returning `{ tags: string[] }`.
	 * Forwarded to `<TagChipInput>`. Pass `null` to disable autocomplete.
	 */
	tagSuggestionsEndpoint?: string | null;
	/**
	 * Synchronous suggestion source. When set, autocomplete uses this list
	 * instead of fetching the endpoint. Forwarded to `<TagChipInput>`.
	 */
	tagSuggestions?: string[] | null;
} = $props();

let bodyMd = $state(initial?.bodyMd ?? '');
let title = $state(initial?.title ?? '');
let context = $state<NoteContext>({ ...EMPTY_NOTE_CONTEXT, ...(initial?.context ?? {}) });
let tags = $state<string[]>(initial?.tags ?? []);
let followUpMd = $state(initial?.followUpMd ?? '');
let quotedExcerpt = $state(initial?.quotedExcerpt ?? '');

let bodyEl = $state<HTMLTextAreaElement | null>(null);
let formEl = $state<HTMLFormElement | null>(null);

const remainingBody = $derived(NOTE_BODY_MAX_LENGTH - bodyMd.length);
const bodyOverflow = $derived(remainingBody < 0);

function snapshot(): ComposerInput {
	return { bodyMd, title, context, tags, followUpMd, quotedExcerpt };
}

function onSubmit(event: SubmitEvent): void {
	if (mode === 'create' && oncreate !== undefined) {
		event.preventDefault();
		oncreate(snapshot());
	} else if (mode === 'edit' && onsave !== undefined) {
		event.preventDefault();
		onsave(snapshot());
	}
	// Otherwise -- let the native form submit through to formAction.
}

function onKeydown(event: KeyboardEvent): void {
	if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
		event.preventDefault();
		formEl?.requestSubmit();
	}
}

function setContext(next: NoteContext): void {
	context = next;
}

function setTags(next: string[]): void {
	tags = next;
}

const submitText = $derived(submitLabel ?? (mode === 'create' ? 'Create note' : 'Save'));

$effect(() => {
	if (autofocusBody && bodyEl !== null) {
		bodyEl.focus();
	}
});
</script>

<form
	bind:this={formEl}
	method={formMethod}
	action={formAction}
	onsubmit={onSubmit}
	onkeydown={onKeydown}
	class="composer"
	data-testid="note-composer"
>
	<label class="field">
		<span class="label">Title (optional)</span>
		<input
			type="text"
			name="title"
			bind:value={title}
			maxlength={NOTE_TITLE_MAX_LENGTH}
			placeholder="Stall recovery"
			{disabled}
			data-testid="note-composer-title"
			aria-invalid={titleError != null}
			aria-describedby={titleError ? 'note-composer-title-error' : undefined}
		/>
		{#if titleError}<span class="error" id="note-composer-title-error">{titleError}</span>{/if}
	</label>

	<label class="field">
		<span class="label">Note (markdown)</span>
		<textarea
			bind:this={bodyEl}
			bind:value={bodyMd}
			name="bodyMd"
			rows="6"
			maxlength={NOTE_BODY_MAX_LENGTH}
			placeholder="Write what's on your mind. Markdown is supported."
			required
			{disabled}
			data-testid="note-composer-body"
			aria-invalid={bodyError != null || bodyOverflow}
			aria-describedby="note-composer-body-counter"
		></textarea>
		<div class="footer-row">
			<span id="note-composer-body-counter" class="counter" class:overflow={bodyOverflow} aria-live="polite">
				{remainingBody} characters remaining
			</span>
			{#if bodyError}<span class="error">{bodyError}</span>{/if}
		</div>
	</label>

	<label class="field">
		<span class="label">Quoted excerpt (optional)</span>
		<textarea
			bind:value={quotedExcerpt}
			name="quotedExcerpt"
			rows="2"
			placeholder="The passage you're responding to."
			{disabled}
			data-testid="note-composer-excerpt"
		></textarea>
	</label>

	<label class="field">
		<span class="label">Tags</span>
		<TagChipInput
			{tags}
			onchange={setTags}
			{disabled}
			suggestionsEndpoint={tagSuggestionsEndpoint}
			suggestions={tagSuggestions}
		/>
		{#each tags as tag, i (tag)}
			<input type="hidden" name="tags[]" value={tag} data-tag-index={i} />
		{/each}
	</label>

	<NoteContextPicker {context} options={contextOptions} onchange={setContext} {disabled} />
	<input type="hidden" name="referenceId" value={context.referenceId ?? ''} />
	<input type="hidden" name="referenceSectionId" value={context.referenceSectionId ?? ''} />
	<input type="hidden" name="knowledgeNodeId" value={context.knowledgeNodeId ?? ''} />
	<input type="hidden" name="courseId" value={context.courseId ?? ''} />
	<input type="hidden" name="goalId" value={context.goalId ?? ''} />
	<input type="hidden" name="syllabusNodeId" value={context.syllabusNodeId ?? ''} />

	<label class="field">
		<span class="label">Follow-up (optional)</span>
		<textarea
			bind:value={followUpMd}
			name="followUpMd"
			rows="2"
			maxlength={NOTE_FOLLOW_UP_MAX_LENGTH}
			placeholder="Something to come back to."
			{disabled}
			data-testid="note-composer-followup"
			aria-invalid={followUpError != null}
		></textarea>
		{#if followUpError}<span class="error">{followUpError}</span>{/if}
	</label>

	<div class="actions">
		{#if oncancel}
			<button type="button" class="btn ghost" onclick={() => oncancel?.()} {disabled} data-testid="note-composer-cancel">
				{cancelLabel}
			</button>
		{/if}
		<button
			type="submit"
			name="intent"
			value={intentName}
			class="btn primary"
			disabled={disabled || bodyOverflow || bodyMd.trim().length === 0}
			data-testid="note-composer-submit"
		>
			{submitText}
		</button>
	</div>
</form>

<style>
	.composer {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}
	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		color: var(--ink-strong);
	}
	textarea,
	input[type='text'] {
		font: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}
	textarea {
		resize: vertical;
		min-height: 3rem;
	}
	textarea:focus,
	input[type='text']:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}
	.footer-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.counter {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}
	.counter.overflow {
		color: var(--signal-danger, #dc2626);
	}
	.error {
		color: var(--signal-danger, #dc2626);
		font-size: var(--type-ui-label-size);
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}
	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}
	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}
	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
