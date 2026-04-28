<script lang="ts">
/**
 * Keyboard shortcut legend for the PFD. Toggled with `?`. Renders the
 * binding table directly so the legend never goes stale relative to
 * the bindings the PFD actually honours.
 *
 * Structure mirrors `apps/sim/src/lib/panels/KeybindingsHelp.svelte`;
 * the legend is intentionally local (no shared `libs/ui` primitive
 * yet) until a second consumer needs the same shape.
 */

import type { PfdInputBindings } from './pfd-types';

let {
	open = false,
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
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="PFD keyboard shortcuts">
		<div class="panel">
			<header>
				<h2>PFD shortcuts</h2>
				<button type="button" class="close" onclick={onClose} aria-label="Close shortcuts">x</button>
			</header>
			<p class="intro">
				Each keypress nudges the matching target. The rAF loop eases the
				rendered value toward the new target, so the instruments lag the
				input the same way they would lag a real ADC.
			</p>
			<dl class="bindings">
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
			<footer>
				<button type="button" class="ok" onclick={onClose}>Got it</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay-scrim);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl);
	}

	.panel {
		background: var(--surface-raised);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		max-width: 560px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
		padding: var(--space-lg) var(--space-xl) var(--space-xl);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--edge-default);
		padding-bottom: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.close {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-base);
		cursor: pointer;
		padding: var(--space-2xs) var(--space-sm);
	}

	.close:hover {
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

	footer {
		margin-top: var(--space-md);
		display: flex;
		justify-content: flex-end;
	}

	.ok {
		background: var(--action-default);
		color: var(--action-default-ink);
		border: none;
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-body);
		cursor: pointer;
	}

	.ok:hover,
	.ok:focus-visible {
		filter: brightness(1.05);
	}
</style>
