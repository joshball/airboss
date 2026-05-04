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
	/** Notify when the user picks an outcome. The container submits a form
	 * action with the outcome + current note in the same round-trip. */
	readonly onPick: (outcome: ReviewOutcome) => void;
	/** Notify when the user blurs out of the note textarea so the container
	 * can persist the note via the `?/recordStep` action. */
	readonly onNoteCommit: (note: string) => void;
}
</script>

<script lang="ts">
import { REVIEW_OUTCOME_LABELS, REVIEW_OUTCOME_VALUES } from '@ab/constants';

/**
 * One row inside the test-plan walker. Renders the step's Title / Action /
 * Expected from the parsed test-plan plus three outcome buttons + a note
 * textarea. Notes save on blur (debounced upstream by the form action),
 * outcomes save on click.
 *
 * The component is purely presentational: it raises `onPick(outcome)` and
 * `onNoteCommit(note)` and lets the page own the form submission, which
 * keeps this component reusable on top of any session-step backend (the
 * walker wires it to the SvelteKit `?/recordStep` action).
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
	onPick,
	onNoteCommit,
}: WalkerStepRowProps = $props();

// Mirror upstream `recordedNote` into a local editable copy. Initialised to
// an empty string and synced via `$effect` so Svelte 5 doesn't warn about
// reading reactive props in a `$state()` initializer. A `$derived` would
// clobber the user's in-flight typing every time the server load returns
// fresh state, which is why we mirror with `$effect` instead.
let noteDraft = $state('');
$effect(() => {
	noteDraft = recordedNote;
});

function commitNote(): void {
	if (noteDraft === recordedNote) return;
	onNoteCommit(noteDraft);
}

function pickOutcome(outcome: (typeof REVIEW_OUTCOME_VALUES)[number]): void {
	onPick(outcome);
}
</script>

<article class="step" data-step-ref={stepRef} aria-labelledby={`step-${stepRef}-title`}>
	<header class="step-head">
		<span class="step-number">{stepIndex}</span>
		<h3 class="step-title" id={`step-${stepRef}-title`}>{title}</h3>
		{#if recordedOutcome !== null}
			<span class="recorded-pill" data-outcome={recordedOutcome}>{REVIEW_OUTCOME_LABELS[recordedOutcome]}</span>
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
				placeholder="Note (optional)"
				rows="2"
				{disabled}
				bind:value={noteDraft}
				onblur={commitNote}
			></textarea>
		</label>
	</div>
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

	.step-head {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.step-number {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		min-width: 2rem;
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

	.recorded-pill[data-outcome='pass'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.recorded-pill[data-outcome='fail'] {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
	}

	.recorded-pill[data-outcome='blocked'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
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
		min-width: 4rem;
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
		color: var(--signal-success-ink);
		border-color: var(--signal-success-ink);
	}

	.outcome[data-outcome='fail'].active {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.outcome[data-outcome='blocked'].active {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border-color: var(--signal-warning-ink);
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
