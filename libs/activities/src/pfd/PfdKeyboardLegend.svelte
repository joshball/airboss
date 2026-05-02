<script lang="ts">
/**
 * Keyboard shortcut legend for the PFD. Toggled with `?`. Renders the
 * binding table directly so the legend never goes stale relative to
 * the bindings the PFD actually honours.
 *
 * Chrome / a11y: built on the shared `Dialog` primitive (canonical close
 * glyph, focus trap, ESC-to-close, scrim-click-to-close, focus return).
 * The "Got it" footer button uses the shared `Button` so the legend looks
 * and behaves like every other dialog action.
 */

import Button from '@ab/ui/components/Button.svelte';
import Dialog from '@ab/ui/components/Dialog.svelte';
import type { PfdInputBindings } from './pfd-types';

let {
	open = $bindable(false),
	bindings,
	onClose,
	resetKeyLabel = '0',
	helpKeyLabel = '?',
}: {
	open?: boolean;
	bindings: PfdInputBindings;
	onClose: () => void;
	resetKeyLabel?: string;
	helpKeyLabel?: string;
} = $props();

function keyChord(binding: PfdInputBindings[number], side: 'dec' | 'inc'): string {
	const keys = side === 'dec' ? binding.decKeys : binding.incKeys;
	const head = keys[0] ?? '';
	const display = head === ' ' ? 'Space' : head;
	return binding.requiresShift ? `Shift+${display}` : display;
}

function close(): void {
	open = false;
	onClose();
}
</script>

<Dialog bind:open ariaLabel="PFD keyboard shortcuts" size="md" onClose={close}>
	{#snippet header()}
		<h2 class="title" data-testid="pfdkeyboardlegend-title">PFD shortcuts</h2>
	{/snippet}

	{#snippet body()}
		<p class="intro">
			Each keypress nudges the matching target. The rAF loop eases the
			rendered value toward the new target, so the instruments lag the
			input the same way they would lag a real ADC.
		</p>
		<dl class="bindings" data-testid="pfdkeyboardlegend-bindings">
			{#each bindings as binding (binding.key)}
				<dt>{binding.label}</dt>
				<dd>
					<kbd>{keyChord(binding, 'dec')}</kbd> /
					<kbd>{keyChord(binding, 'inc')}</kbd>
					<span class="hint">step {binding.keyStep} {binding.unitLabel}</span>
				</dd>
			{/each}
			<dt>Reset</dt>
			<dd>
				<kbd>{resetKeyLabel}</kbd>
				<span class="hint">all values back to defaults</span>
			</dd>
			<dt>This panel</dt>
			<dd>
				<kbd>{helpKeyLabel}</kbd>
				<span class="hint">toggle</span>
			</dd>
		</dl>
	{/snippet}

	{#snippet footer()}
		<Button variant="primary" size="md" onclick={close}>
			<span data-testid="pfdkeyboardlegend-ok">Got it</span>
		</Button>
	{/snippet}
</Dialog>

<style>
	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.intro {
		color: var(--ink-muted);
		font-size: var(--font-size-body);
		margin: 0 0 var(--space-md);
		line-height: var(--line-height-normal);
	}

	.bindings {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2xs) var(--space-md);
		margin: 0;
		font-size: var(--font-size-sm);
	}

	.bindings dt {
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
		white-space: nowrap;
	}

	.bindings dd {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.hint {
		color: var(--ink-muted);
		font-size: var(--font-size-xs);
	}

	kbd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-panel);
		border: 1px solid var(--edge-strong);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: var(--space-2xs) var(--space-xs);
		color: var(--ink-body);
		white-space: nowrap;
	}
</style>
