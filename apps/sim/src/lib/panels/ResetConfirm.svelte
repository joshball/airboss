<script lang="ts">
/**
 * Reset confirmation overlay. Blocks input until the user confirms with Y
 * or cancels with Esc / clicks outside.
 */

let {
	open = false,
	onConfirm,
	onCancel,
}: {
	open?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
} = $props();
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Reset scenario confirmation">
		<div class="panel">
			<h2>Reset scenario?</h2>
			<p>Progress will be lost. Press <kbd>Y</kbd> to confirm, <kbd>Esc</kbd> to cancel.</p>
			<div class="buttons">
				<button type="button" class="cancel" onclick={onCancel}>Cancel (Esc)</button>
				<button type="button" class="confirm" onclick={onConfirm}>Reset (Y)</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-scrim);
		z-index: 110;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		background: var(--sim-panel-bg);
		color: var(--sim-panel-fg);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-md);
		padding: var(--space-xl) var(--space-xl);
		text-align: center;
		max-width: 360px;
	}

	h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-lg);
	}

	p {
		margin: 0 0 var(--space-lg);
		font-size: var(--font-size-body);
		color: var(--sim-panel-fg-lighter);
	}

	kbd {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		margin: 0 var(--space-2xs);
		background: var(--sim-panel-bg-darker);
		color: var(--sim-instrument-pointer);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-xs);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
	}

	.buttons {
		display: flex;
		gap: var(--space-sm);
		justify-content: center;
	}

	button {
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-xs);
		font-size: var(--font-size-body);
		cursor: pointer;
		border: 1px solid var(--sim-panel-border);
	}

	.cancel {
		background: transparent;
		color: var(--sim-panel-fg-lighter);
	}

	.confirm {
		background: var(--sim-status-danger);
		color: var(--action-default-ink);
		border-color: var(--sim-status-danger);
	}

	.confirm:hover {
		background: var(--sim-status-danger-strong);
	}
</style>
