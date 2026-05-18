<script lang="ts" module>
import type { ReviewOutcome } from '@ab/constants';

export interface WalkerStepRowProps {
	readonly stepIndex: number;
	readonly stepRef: string;
	readonly title: string;
	readonly action: string;
	readonly expected: string;
	readonly recordedOutcome: ReviewOutcome | null;
	readonly recordedNote: string;
	readonly disabled?: boolean;
	/** Saving flag for the row's textarea -- shows a hint that the note save
	 * is in flight without blocking further typing. Falls back to false. */
	readonly saving?: boolean;
	/** Per-row error message (e.g. last save failed). Surfaced inline below
	 * the textarea so the user knows which row reverted. */
	readonly errorMessage?: string | null;
	/** Notify when the user picks an outcome. The container submits a form
	 * action with the outcome + current note in the same round-trip; the
	 * caller passes the row's CURRENT note draft so unblurred typing is not
	 * dropped. */
	readonly onPick: (outcome: ReviewOutcome, currentNote: string) => void;
	/** Notify when the user blurs out of the note textarea so the container
	 * can persist the note via the `?/recordStep` action. */
	readonly onNoteCommit: (note: string) => void;
	/** Notify whenever the textarea content changes so the container can
	 * track the in-flight draft and pass it back through `onPick`. */
	readonly onNoteChange?: (note: string) => void;
}
</script>

<script lang="ts">
import { REVIEW_OUTCOME_LABELS, REVIEW_OUTCOME_VALUES, WALKER_KEYBOARD_SHORTCUTS } from '@ab/constants';
import { onMount } from 'svelte';

/**
 * One row inside the test-plan walker. Renders the step's Title / Action /
 * Expected from the parsed test-plan plus three outcome buttons + a note
 * textarea. Notes save on blur (debounced upstream by the form action),
 * outcomes save on click.
 *
 * The component is purely presentational: it raises `onPick(outcome, note)`
 * and `onNoteCommit(note)` and lets the page own the form submission, which
 * keeps this component reusable on top of any session-step backend (the
 * walker wires it to the SvelteKit `?/recordStep` action).
 *
 * Note-draft sync rule: the component initialises `noteDraft` from
 * `recordedNote` once on mount, then never re-mirrors from the prop while
 * the textarea is focused. This is the load-bearing fix for "typed words
 * vanish when a sibling row finishes saving". Once the textarea blurs, the
 * row re-syncs to whatever the prop says (so a save round-trip from a
 * different tab still wins).
 */

let {
	stepIndex,
	stepRef,
	title,
	action,
	expected,
	recordedOutcome,
	recordedNote,
	disabled = false,
	saving = false,
	errorMessage = null,
	onPick,
	onNoteCommit,
	onNoteChange,
}: WalkerStepRowProps = $props();

// noteDraft holds the textarea's editable copy. Initialised empty so Svelte
// doesn't warn about reading reactive props in the `$state()` initializer;
// the onMount + $effect below keep it synced to `recordedNote` while the
// textarea isn't focused.
//
// Sync rule (load-bearing for "no clobbered typing"): prop changes only
// sync IN to `noteDraft` when the textarea is not focused. This avoids
// clobbering in-flight typing when a sibling row's `?/recordStep` round-
// trip triggers `invalidateAll()`.
let noteDraft = $state('');
let textareaEl = $state<HTMLTextAreaElement | null>(null);
let articleEl = $state<HTMLElement | null>(null);

onMount(() => {
	noteDraft = recordedNote;
});

$effect(() => {
	const incoming = recordedNote;
	if (typeof document !== 'undefined' && textareaEl !== null && document.activeElement === textareaEl) return;
	if (incoming === noteDraft) return;
	noteDraft = incoming;
});

function commitNote(): void {
	if (noteDraft === recordedNote) return;
	onNoteCommit(noteDraft);
}

function handleInput(event: Event): void {
	const target = event.target;
	if (!(target instanceof HTMLTextAreaElement)) return;
	noteDraft = target.value;
	onNoteChange?.(noteDraft);
}

function pickOutcome(outcome: (typeof REVIEW_OUTCOME_VALUES)[number]): void {
	// Hand the parent the row's CURRENT note draft so unblurred typing is
	// committed in the same round-trip as the outcome. Without this, the
	// page reads a stale `recorded?.note` from its optimistic map and the
	// user's mid-keystroke note is dropped on the floor.
	onPick(outcome, noteDraft);
}

/**
 * Keyboard shortcuts when the row is focused (or focus is inside the row's
 * outcome buttons / textarea). Disabled while the textarea is focused
 * (typing 'p' should add 'p' to the note, not record a pass), except for
 * Escape which always blurs.
 */
function handleKeydown(event: KeyboardEvent): void {
	if (disabled) return;
	if (event.metaKey || event.ctrlKey || event.altKey) return;
	const target = event.target;
	const inTextarea = target instanceof HTMLTextAreaElement;
	if (inTextarea) {
		if (event.key === 'Escape') {
			event.preventDefault();
			textareaEl?.blur();
		}
		return;
	}
	switch (event.key) {
		case WALKER_KEYBOARD_SHORTCUTS.OUTCOME_PASS:
			event.preventDefault();
			pickOutcome('pass');
			break;
		case WALKER_KEYBOARD_SHORTCUTS.OUTCOME_FAIL:
			event.preventDefault();
			pickOutcome('fail');
			break;
		case WALKER_KEYBOARD_SHORTCUTS.OUTCOME_BLOCKED:
			event.preventDefault();
			pickOutcome('blocked');
			break;
		case WALKER_KEYBOARD_SHORTCUTS.FOCUS_NOTE:
			event.preventDefault();
			textareaEl?.focus();
			break;
	}
}

/** Public-ish helper: focus the row container so j/k can land here. */
export function focus(): void {
	articleEl?.focus();
}
</script>

<!-- The row hosts a keyboard-shortcut group (j/k/p/f/b/n) that scopes to
	 the focused step; the keyboard handler is the load-bearing UX for fast
	 walk-through. role="group" + tabindex=-1 lets the row receive focus
	 from the page's j/k navigation. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	bind:this={articleEl}
	class="step"
	data-step-ref={stepRef}
	aria-labelledby={`step-${stepRef}-title`}
	role="group"
	tabindex="-1"
	onkeydown={handleKeydown}
>
	<header class="step-head">
		<h3 class="step-title" id={`step-${stepRef}-title`}>{title}</h3>
		{#if recordedOutcome !== null}
			<span class="recorded-pill" data-outcome={recordedOutcome}>{REVIEW_OUTCOME_LABELS[recordedOutcome]}</span>
		{/if}
		{#if saving}
			<span class="saving-pill" aria-live="polite">Saving...</span>
		{/if}
	</header>
	<dl class="step-body">
		<div class="row">
			<dt>Action</dt>
			<dd>{action}</dd>
		</div>
		<div class="row">
			<dt>Expected</dt>
			<dd>{expected}</dd>
		</div>
	</dl>
	<div class="step-controls">
		<div class="outcomes" role="group" aria-label={`Outcome for step ${stepIndex}`}>
			{#each REVIEW_OUTCOME_VALUES as value (value)}
				<button
					type="button"
					class="outcome"
					class:active={recordedOutcome === value}
					data-outcome={value}
					{disabled}
					aria-pressed={recordedOutcome === value}
					onclick={() => pickOutcome(value)}
				>
					{REVIEW_OUTCOME_LABELS[value]}
				</button>
			{/each}
		</div>
		<label class="note-field">
			<span class="visually-hidden">Note for step {stepIndex}</span>
			<textarea
				bind:this={textareaEl}
				placeholder="Note (optional)"
				rows="2"
				{disabled}
				value={noteDraft}
				oninput={handleInput}
				onblur={commitNote}
			></textarea>
		</label>
	</div>
	{#if errorMessage}
		<p class="row-error" role="alert">Save failed: {errorMessage}</p>
	{/if}
</article>

<style>
	.step {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.step:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.step-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.step-title {
		margin: 0;
		font-size: var(--type-ui-control-size);
		flex: 1;
	}

	.recorded-pill {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.saving-pill {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--signal-info-wash);
		color: var(--signal-info-deep-ink);
	}

	.row-error {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--signal-danger-deep-ink);
	}

	.recorded-pill[data-outcome='pass'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-deep-ink);
	}

	.recorded-pill[data-outcome='fail'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-deep-ink);
	}

	.recorded-pill[data-outcome='blocked'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-deep-ink);
	}

	.step-body {
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-3xs);
		column-gap: var(--space-md);
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.row {
		display: contents;
	}

	.step-body dt {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.step-body dd {
		margin: 0;
		color: var(--ink-body);
	}

	.step-controls {
		display: flex;
		gap: var(--space-md);
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.outcomes {
		display: flex;
		gap: var(--space-2xs);
	}

	.outcome {
		appearance: none;
		font: inherit;
		font-size: var(--type-ui-label-size);
		padding: var(--space-2xs) var(--space-sm);
		min-height: 2rem;
		min-width: 5rem;
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.outcome:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.outcome:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.outcome:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.outcome[data-outcome='pass'].active {
		background: var(--signal-success-wash);
		color: var(--signal-success-deep-ink);
		border-color: var(--signal-success-deep-ink);
	}

	.outcome[data-outcome='fail'].active {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-deep-ink);
		border-color: var(--signal-danger-deep-ink);
	}

	.outcome[data-outcome='blocked'].active {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-deep-ink);
		border-color: var(--signal-warning-deep-ink);
	}

	.note-field {
		flex: 1;
		min-width: 16rem;
	}

	.note-field textarea {
		width: 100%;
		font: inherit;
		font-size: var(--type-ui-label-size);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
		resize: vertical;
	}

	.note-field textarea:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
