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
		background: rgba(0, 0, 0, 0.75);
		z-index: 110;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.panel {
		background: #1a1a1a;
		color: #f5f5f5;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 1.25rem 1.5rem;
		text-align: center;
		max-width: 360px;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}

	p {
		margin: 0 0 1rem;
		font-size: 0.9rem;
		color: #ccc;
	}

	kbd {
		display: inline-block;
		padding: 0.05rem 0.4rem;
		margin: 0 0.1rem;
		background: #0a0a0a;
		color: #ffe270;
		border: 1px solid #333;
		border-radius: 3px;
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	button {
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
		border: 1px solid #333;
	}

	.cancel {
		background: transparent;
		color: #ccc;
	}

	.confirm {
		background: #e0443e;
		color: #fff;
		border-color: #e0443e;
	}

	.confirm:hover {
		background: #c23530;
	}
</style>
