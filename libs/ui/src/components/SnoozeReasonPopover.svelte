<script lang="ts">
/**
 * Snooze reason popover. Presents the four reason codes from
 * `SNOOZE_REASONS` with per-reason behaviour: mandatory comment for
 * `bad-question` / `wrong-domain` / `remove`, duration picker for
 * `know-it-bored`.
 *
 * Controlled: parent passes `open={true}` and an `onSubmit` handler that
 * receives the shaped payload. Component does not talk to the server; the
 * review page's form action does that so the "did we actually snooze?"
 * side-effect is visible in the network tab.
 *
 * A11y / chrome: built on the shared `Dialog` primitive -- canonical
 * close glyph, focus trap, ESC-to-close, scrim-click-to-close, focus
 * return all live there. Local state covers reason selection and the
 * report-flow `focusComment` open behaviour.
 */

import {
	SNOOZE_DEFAULT_DURATION,
	SNOOZE_DURATION_LEVEL_LABELS,
	SNOOZE_DURATION_LEVEL_VALUES,
	SNOOZE_REASON_DESCRIPTIONS,
	SNOOZE_REASON_LABELS,
	SNOOZE_REASON_VALUES,
	SNOOZE_REASONS,
	SNOOZE_REASONS_REQUIRING_COMMENT,
	type SnoozeDurationLevel,
	type SnoozeReason,
} from '@ab/constants';
import Button from './Button.svelte';
import Dialog from './Dialog.svelte';

interface SnoozeSubmission {
	reason: SnoozeReason;
	comment: string;
	durationLevel: SnoozeDurationLevel | null;
	/** Only meaningful for `bad-question`: caller wants "wait for author edit." */
	waitForEdit: boolean;
}

let {
	open = $bindable(false),
	initialReason,
	focusComment = false,
	onSubmit,
	onClose,
}: {
	open?: boolean;
	/**
	 * Reason to pre-select when the popover opens. Defaults to
	 * `KNOW_IT_BORED`. Used by the Share -> Report handoff to land
	 * directly on `bad-question` with the comment field focused.
	 */
	initialReason?: SnoozeReason;
	/**
	 * When true, focus the comment textarea on open instead of the first
	 * focusable element. Pairs with `initialReason` for the Report flow,
	 * where the user has already chosen the reason and just needs to type.
	 */
	focusComment?: boolean;
	onSubmit: (payload: SnoozeSubmission) => void;
	onClose?: () => void;
} = $props();

function resolveDefaultReason(reason: SnoozeReason | undefined): SnoozeReason {
	return reason ?? SNOOZE_REASONS.KNOW_IT_BORED;
}
// svelte-ignore state_referenced_locally
let selectedReason = $state<SnoozeReason>(resolveDefaultReason(initialReason));
let comment = $state('');
// svelte-ignore state_referenced_locally
let durationLevel = $state<SnoozeDurationLevel>(
	SNOOZE_DEFAULT_DURATION[resolveDefaultReason(initialReason)] ?? 'medium',
);
let waitForEdit = $state(true);
let submitError = $state<string | null>(null);
let formEl = $state<HTMLFormElement | null>(null);

const requiresComment = $derived(
	(SNOOZE_REASONS_REQUIRING_COMMENT as readonly SnoozeReason[]).includes(selectedReason),
);
const allowsDurationPick = $derived(
	selectedReason === SNOOZE_REASONS.KNOW_IT_BORED || selectedReason === SNOOZE_REASONS.WRONG_DOMAIN,
);
const allowsWaitForEdit = $derived(selectedReason === SNOOZE_REASONS.BAD_QUESTION);

function pickReason(reason: SnoozeReason): void {
	selectedReason = reason;
	submitError = null;
	const next = SNOOZE_DEFAULT_DURATION[reason];
	if (next) durationLevel = next;
}

function close(): void {
	open = false;
	onClose?.();
}

function submit(event: SubmitEvent): void {
	event.preventDefault();
	const trimmed = comment.trim();
	if (requiresComment && !trimmed) {
		submitError = 'A comment is required for this reason.';
		return;
	}
	const nextDuration: SnoozeDurationLevel | null =
		selectedReason === SNOOZE_REASONS.REMOVE ? null : allowsWaitForEdit && waitForEdit ? null : durationLevel;
	onSubmit({
		reason: selectedReason,
		comment: trimmed,
		durationLevel: nextDuration,
		waitForEdit: allowsWaitForEdit ? waitForEdit : false,
	});
	// Reset local state so a second open starts clean.
	comment = '';
	submitError = null;
	open = false;
}

// Track the previous `open` value so the seed effect only fires on a
// false -> true transition. Reading `initialReason` / `focusComment`
// inside the effect would also subscribe to those, which would clobber
// a user's manual reason change if the parent re-passed the same
// `initialReason` mid-flight.
let wasOpen = false;
$effect(() => {
	const isOpen = open;
	if (!isOpen) {
		wasOpen = false;
		return;
	}
	if (wasOpen) return;
	wasOpen = true;
	// Re-seed the local state every time the popover opens so callers can
	// re-open with a different `initialReason` (e.g., the Share -> Report
	// hand-off lands on `bad-question` even after a prior Snooze open
	// landed on `know-it-bored`).
	const seeded = resolveDefaultReason(initialReason);
	selectedReason = seeded;
	const seedDuration = SNOOZE_DEFAULT_DURATION[seeded];
	if (seedDuration) durationLevel = seedDuration;
	comment = '';
	submitError = null;
	// When the parent opened us via the Report flow, jump to the comment
	// textarea after Dialog has run its own initial-focus pass.
	if (focusComment) {
		queueMicrotask(() => {
			formEl?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
		});
	}
});
</script>

<Dialog
	bind:open
	ariaLabel="Snooze this card"
	size="md"
	onClose={close}
>
	{#snippet header()}
		<h2 id="snooze-title" data-testid="snoozereasonpopover-title">Snooze this card</h2>
	{/snippet}

	{#snippet body()}
		<span
			class="visually-hidden"
			data-testid="snoozereasonpopover-root"
			data-selected-reason={selectedReason}
		></span>
		<form bind:this={formEl} onsubmit={submit} data-testid="snoozereasonpopover-form" id="snooze-form">
			<fieldset class="reasons" data-testid="snoozereasonpopover-reasons">
				<legend class="visually-hidden">Reason</legend>
				{#each SNOOZE_REASON_VALUES as reason (reason)}
					<label
						class="reason-row"
						class:is-selected={selectedReason === reason}
						data-testid={`snoozereasonpopover-reason-${reason}`}
						data-state={selectedReason === reason ? 'selected' : 'idle'}
					>
						<input
							type="radio"
							name="reason"
							value={reason}
							checked={selectedReason === reason}
							data-testid={`snoozereasonpopover-reason-input-${reason}`}
							onchange={() => pickReason(reason)}
						/>
						<span class="reason-body">
							<span class="reason-label">{SNOOZE_REASON_LABELS[reason]}</span>
							<span class="reason-desc">{SNOOZE_REASON_DESCRIPTIONS[reason]}</span>
						</span>
					</label>
				{/each}
			</fieldset>

			{#if allowsWaitForEdit}
				<label class="toggle">
					<input type="checkbox" bind:checked={waitForEdit} />
					<span>Wait for the author to edit (no fixed duration)</span>
				</label>
			{/if}

			{#if allowsDurationPick && !(allowsWaitForEdit && waitForEdit)}
				<fieldset class="durations">
					<legend>Duration</legend>
					<div class="duration-row">
						{#each SNOOZE_DURATION_LEVEL_VALUES as level (level)}
							<label class="duration-chip" class:is-selected={durationLevel === level}>
								<input
									type="radio"
									name="durationLevel"
									value={level}
									checked={durationLevel === level}
									onchange={() => (durationLevel = level)}
								/>
								<span>{SNOOZE_DURATION_LEVEL_LABELS[level]}</span>
							</label>
						{/each}
					</div>
				</fieldset>
			{/if}

			<label class="comment" data-testid="snoozereasonpopover-comment">
				<span class="comment-label">
					Comment{requiresComment ? ' (required)' : ' (optional)'}
				</span>
				<textarea
					bind:value={comment}
					rows="3"
					placeholder={requiresComment ? 'Why are you snoozing this card?' : 'Optional note'}
					data-testid="snoozereasonpopover-comment-input"
				></textarea>
			</label>

			{#if submitError}
				<p class="error" role="alert" data-testid="snoozereasonpopover-error">{submitError}</p>
			{/if}
		</form>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" size="md" onclick={close}>
			<span data-testid="snoozereasonpopover-cancel">Cancel</span>
		</Button>
		<Button
			variant="primary"
			size="md"
			onclick={() => formEl?.requestSubmit()}
		>
			<span data-testid="snoozereasonpopover-submit">Snooze</span>
		</Button>
	{/snippet}
</Dialog>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.reasons {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.reason-row {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		cursor: pointer;
		align-items: flex-start;
	}

	.reason-row:hover {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.reason-row.is-selected {
		border-color: var(--action-default);
		background: var(--action-default-wash);
	}

	.reason-row input[type='radio'] {
		margin-top: var(--space-2xs);
	}

	.reason-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.reason-label {
		font-weight: 600;
		color: var(--ink-body);
	}

	.reason-desc {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		color: var(--ink-body);
		font-size: var(--font-size-sm);
	}

	.durations {
		border: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.durations legend {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.duration-row {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.duration-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		cursor: pointer;
		font-size: var(--font-size-sm);
	}

	.duration-chip.is-selected {
		border-color: var(--action-default);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.duration-chip input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.comment {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.comment-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.comment textarea {
		font: inherit;
		resize: vertical;
		padding: var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg, var(--surface-panel));
		color: var(--ink-body);
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.error {
		color: var(--signal-danger, var(--action-hazard-hover));
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
