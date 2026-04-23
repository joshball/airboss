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
		background: var(--ab-overlay-scrim-heavy);
		z-index: 110;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		background: var(--ab-sim-panel-bg);
		color: var(--ab-sim-panel-fg);
		border: 1px solid var(--ab-sim-panel-border);
		border-radius: var(--ab-radius-md);
		padding: 1.25rem var(--ab-space-xl);
		text-align: center;
		max-width: 360px;
	}

	h2 {
		margin: 0 0 var(--ab-space-sm);
		font-size: 1.1rem;
	}

	p {
		margin: 0 0 var(--ab-space-lg);
		font-size: 0.9rem;
		color: var(--ab-sim-panel-fg-lighter);
	}

	kbd {
		display: inline-block;
		padding: 0.05rem 0.4rem;
		margin: 0 0.1rem;
		background: var(--ab-sim-panel-bg-darker);
		color: var(--ab-sim-instrument-pointer);
		border: 1px solid var(--ab-sim-panel-border);
		border-radius: var(--ab-radius-xs);
		font-family: var(--ab-font-mono);
		font-size: 0.85rem;
	}

	.buttons {
		display: flex;
		gap: var(--ab-space-sm);
		justify-content: center;
	}

	button {
		padding: 0.4rem 0.9rem;
		border-radius: var(--ab-radius-xs);
		font-size: 0.9rem;
		cursor: pointer;
		border: 1px solid var(--ab-sim-panel-border);
	}

	.cancel {
		background: transparent;
		color: var(--ab-sim-panel-fg-lighter);
	}

	.confirm {
		background: var(--ab-sim-status-danger);
		color: var(--ab-color-primary-fg);
		border-color: var(--ab-sim-status-danger);
	}

	.confirm:hover {
		background: var(--ab-sim-status-danger-strong);
	}
</style>
