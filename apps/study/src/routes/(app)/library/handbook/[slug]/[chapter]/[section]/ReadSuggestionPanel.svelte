<script lang="ts">
/**
 * Read-suggestion banner: appears once the heartbeat has accumulated
 * enough reading time + scroll depth on a section the learner hasn't
 * marked read yet. Pre-2026-05-04 the banner used `role="status"
 * aria-live="polite"` with no explanatory preamble: SR users heard
 * "Mark this section as read?" with no context for the question.
 *
 * Post-fix the banner is a labelled `role="group"` whose
 * `aria-labelledby` points at a visible preamble so AT users hear:
 * "Based on your reading time: Mark this section as read?" before the
 * action buttons.
 *
 * No transitions or auto-revealing animations -- safe under
 * `prefers-reduced-motion: reduce` without any extra wiring.
 */

import { HANDBOOK_READ_STATUSES } from '@ab/constants';

let { onDismiss }: { onDismiss: () => void } = $props();
</script>

<aside
	class="read-suggestion"
	role="group"
	aria-labelledby="read-suggestion-preamble"
	data-testid="read-suggestion"
>
	<p id="read-suggestion-preamble" class="read-suggestion-preamble">
		<span class="read-suggestion-context">Based on your reading time:</span>
		<span class="read-suggestion-prompt">Mark this section as read?</span>
	</p>
	<div class="read-suggestion-actions">
		<form method="POST" action="?/set-status">
			<input type="hidden" name="status" value={HANDBOOK_READ_STATUSES.READ} />
			<button type="submit" class="read-suggestion-primary">Mark as read</button>
		</form>
		<button type="button" class="read-suggestion-secondary" onclick={onDismiss}>
			Not yet
		</button>
	</div>
</aside>

<style>
	.read-suggestion {
		margin-top: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}
	.read-suggestion-preamble {
		margin: 0;
		color: var(--ink-body);
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}
	.read-suggestion-context {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}
	.read-suggestion-prompt {
		font-weight: var(--font-weight-medium);
	}
	.read-suggestion-actions {
		display: flex;
		gap: var(--space-xs);
	}
	.read-suggestion-actions form {
		margin: 0;
	}
	.read-suggestion-primary {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: 1px solid var(--action-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		font-weight: var(--font-weight-medium);
	}
	.read-suggestion-primary:hover,
	.read-suggestion-primary:focus-visible {
		background: var(--action-default-hover, var(--action-default));
	}
	.read-suggestion-secondary {
		background: none;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		color: var(--ink-muted);
		cursor: pointer;
	}
	.read-suggestion-secondary:hover,
	.read-suggestion-secondary:focus-visible {
		border-color: var(--action-default-edge);
		color: var(--ink-body);
	}
</style>
