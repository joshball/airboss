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
 * A11y: dialog role + aria-label, ESC closes, focus-trap keeps Tab inside.
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
import { createFocusTrap } from '../lib/focus-trap';

interface SnoozeSubmission {
	reason: SnoozeReason;
	comment: string;
	durationLevel: SnoozeDurationLevel | null;
	/** Only meaningful for `bad-question`: caller wants "wait for author edit." */
	waitForEdit: boolean;
}

let {
	open = $bindable(false),
	onSubmit,
	onClose,
}: {
	open?: boolean;
	onSubmit: (payload: SnoozeSubmission) => void;
	onClose?: () => void;
} = $props();

let selectedReason = $state<SnoozeReason>(SNOOZE_REASONS.KNOW_IT_BORED);
let comment = $state('');
let durationLevel = $state<SnoozeDurationLevel>(SNOOZE_DEFAULT_DURATION[SNOOZE_REASONS.KNOW_IT_BORED] ?? 'medium');
let waitForEdit = $state(true);
let panelEl = $state<HTMLDivElement | null>(null);
let submitError = $state<string | null>(null);

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

function handleKeyDown(event: KeyboardEvent): void {
	if (!panelEl) return;
	const trap = createFocusTrap(panelEl, { onEscape: close });
	trap.handleKeyDown(event);
}

function handleScrim(event: PointerEvent): void {
	if (event.target === event.currentTarget) close();
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

$effect(() => {
	if (!open) return;
	// Move focus into the panel on open.
	queueMicrotask(() => {
		panelEl?.querySelector<HTMLElement>('input, textarea, button')?.focus();
	});
});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="scrim" onpointerdown={handleScrim} onkeydown={handleKeyDown}>
		<div
			bind:this={panelEl}
			class="panel"
			role="dialog"
			aria-modal="true"
			aria-label="Snooze this card"
		>
			<header class="hd">
				<h2 id="snooze-title">Snooze this card</h2>
				<button type="button" class="close" aria-label="Close" onclick={close}>&times;</button>
			</header>
			<form onsubmit={submit}>
				<fieldset class="reasons">
					<legend class="visually-hidden">Reason</legend>
					{#each SNOOZE_REASON_VALUES as reason (reason)}
						<label class="reason-row" class:is-selected={selectedReason === reason}>
							<input
								type="radio"
								name="reason"
								value={reason}
								checked={selectedReason === reason}
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

				<label class="comment">
					<span class="comment-label">
						Comment{requiresComment ? ' (required)' : ' (optional)'}
					</span>
					<textarea
						bind:value={comment}
						rows="3"
						placeholder={requiresComment ? 'Why are you snoozing this card?' : 'Optional note'}
					></textarea>
				</label>

				{#if submitError}
					<p class="error" role="alert">{submitError}</p>
				{/if}

				<footer class="ft">
					<button type="button" class="btn ghost" onclick={close}>Cancel</button>
					<button type="submit" class="btn primary">Snooze</button>
				</footer>
			</form>
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: var(--dialog-scrim);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal);
	}

	.panel {
		background: var(--surface-panel, var(--ink-inverse));
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-xl);
		min-width: min(32rem, 92vw);
		max-width: 36rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.2));
	}

	.hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hd h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.close {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-size: var(--font-size-xl);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-2xs) var(--space-sm);
	}

	.close:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

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
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.error {
		color: var(--signal-danger, var(--action-hazard-hover));
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.ft {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}

	.btn {
		padding: var(--space-sm) var(--space-xl);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}

	.btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
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
