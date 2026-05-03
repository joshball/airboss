<script lang="ts">
import { HANDBOOK_NOTES_MAX_LENGTH } from '@ab/constants';

let {
	notesMd = '',
	formAction,
}: {
	notesMd?: string;
	formAction: string;
} = $props();

// Seed once from the server-rendered prop. The previous `$effect` re-sync
// clobbered in-flight typing whenever the parent revalidated (any
// re-render where `notesMd` re-read the same string would reset the
// textarea, dropping unsaved keystrokes). The effect is only useful after a
// real save -- prefer remounting via `{#key notesMd}` at the parent if a
// hard reset is ever needed.
// svelte-ignore state_referenced_locally -- initial-value only
let value = $state(notesMd);
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
		maxlength={HANDBOOK_NOTES_MAX_LENGTH}
		aria-invalid={overflowing}
		aria-describedby="handbook-notes-counter"
		placeholder="Anything you want to remember about this section."
	></textarea>
	<div class="footer">
		<!--
			The counter doubles as the aria-describedby target so SR users hear
			"N characters remaining" alongside the textarea name. `aria-live`
			announces overflow without re-announcing every keystroke. `maxlength`
			gives us a hard browser-level guard so the user can't physically
			exceed the limit.
		-->
		<span
			id="handbook-notes-counter"
			class="counter"
			class:overflow={overflowing}
			aria-live="polite"
			aria-atomic="true"
		>
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
