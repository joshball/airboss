<script lang="ts">
import { HANDBOOK_NOTES_MAX_LENGTH } from '@ab/constants';

let {
	notesMd = '',
	formAction,
}: {
	notesMd?: string;
	formAction: string;
} = $props();

let value = $state('');
$effect(() => {
	// Re-sync the textarea state whenever the server-side notes prop changes
	// (after a successful POST and an action invalidation, for example). The
	// initial-value capture warning fires without this; the effect closes over
	// the live `notesMd` prop instead of capturing the initial string once.
	value = notesMd;
});
const remaining = $derived(HANDBOOK_NOTES_MAX_LENGTH - value.length);
const overflowing = $derived(remaining < 0);
</script>

<form method="POST" action={formAction} class="notes-form">
	<label for="handbook-notes-md">Notes (private to you)</label>
	<textarea
		id="handbook-notes-md"
		name="notesMd"
		rows="5"
		bind:value
		placeholder="Anything you want to remember about this section."
	></textarea>
	<div class="footer">
		<span class="counter" class:overflow={overflowing}>
			{remaining} characters remaining
		</span>
		<button type="submit" disabled={overflowing}>Save notes</button>
	</div>
</form>

<style>
	.notes-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-top: var(--space-md);
	}
	label {
		font-weight: 500;
	}
	textarea {
		width: 100%;
		padding: var(--space-xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: inherit;
		font-family: inherit;
		resize: vertical;
	}
	textarea:focus-visible {
		outline: 2px solid var(--edge-focus);
		outline-offset: -2px;
	}
	.footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.counter {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
	}
	.counter.overflow {
		color: var(--signal-danger);
	}
	button {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: none;
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
