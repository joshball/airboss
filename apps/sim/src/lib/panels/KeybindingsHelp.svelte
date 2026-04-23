<script lang="ts">
/**
 * Keybindings help overlay. Rendered from `SIM_KEYBINDINGS` -- the single
 * source of truth. Toggle with `?`, first visit shows automatically,
 * dismissal persisted to localStorage.
 */

import { SIM_KEYBINDINGS, type SimKeybinding } from '@ab/constants';

let {
	open = false,
	onClose,
}: {
	open?: boolean;
	onClose: () => void;
} = $props();

const groups: ReadonlyArray<{ key: SimKeybinding['group']; label: string }> = [
	{ key: 'elevator', label: 'Elevator' },
	{ key: 'aileron', label: 'Aileron' },
	{ key: 'rudder', label: 'Rudder' },
	{ key: 'throttle', label: 'Throttle' },
	{ key: 'trim', label: 'Trim' },
	{ key: 'configuration', label: 'Configuration' },
	{ key: 'system', label: 'System' },
];

function byGroup(group: SimKeybinding['group']): readonly SimKeybinding[] {
	return SIM_KEYBINDINGS.filter((b) => b.group === group);
}
</script>

{#if open}
	<div class="overlay" role="dialog" aria-modal="true" aria-label="Keybindings help">
		<div class="panel">
			<header>
				<h2>Cockpit controls</h2>
				<button type="button" class="close" onclick={onClose} aria-label="Close help">x</button>
			</header>
			<p class="intro">
				Controls are tap-based: each keypress nudges a surface by a fixed amount. Hold a key and the OS key
				repeat nudges it again. Use X / C / Z to recenter. Trim with [ and ].
			</p>
			<div class="grid">
				{#each groups as group (group.key)}
					<section>
						<h3>{group.label}</h3>
						<dl>
							{#each byGroup(group.key) as binding (binding.action)}
								<dt>{binding.label}</dt>
								<dd>{binding.description}</dd>
							{/each}
						</dl>
					</section>
				{/each}
			</div>
			<p class="note">
				Auto-coordinate: rudder follows aileron to zero the ball. Turn OFF to practice coordination yourself.
			</p>
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
		background: var(--sim-panel-bg);
		color: var(--sim-panel-fg);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-md);
		max-width: 720px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
		padding: var(--space-lg) var(--space-xl) var(--space-xl);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--sim-panel-bg-elevated);
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
		color: var(--sim-panel-fg-light);
		font-family: var(--font-family-mono);
		font-size: var(--font-size-base);
		cursor: pointer;
		padding: var(--space-2xs) var(--space-sm);
	}

	.close:hover {
		color: var(--sim-panel-fg);
	}

	.intro {
		color: var(--sim-panel-fg-lighter);
		font-size: var(--font-size-body);
		margin: 0 0 var(--space-md);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-lg);
	}

	section h3 {
		margin: 0 0 var(--space-2xs) 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--sim-panel-fg-light);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2xs) var(--space-md);
		font-size: var(--font-size-sm);
		margin: 0;
	}

	dt {
		font-family: var(--font-family-mono);
		color: var(--sim-instrument-pointer);
		white-space: nowrap;
	}

	dd {
		margin: 0;
		color: var(--sim-panel-fg-lightest);
	}

	.note {
		margin-top: var(--space-lg);
		font-size: var(--font-size-sm);
		color: var(--sim-status-primary-fg);
		border-top: 1px solid var(--sim-panel-bg-elevated);
		padding-top: var(--space-sm);
	}

	footer {
		margin-top: var(--space-md);
		display: flex;
		justify-content: flex-end;
	}

	.ok {
		background: var(--sim-status-primary);
		color: var(--action-default-ink);
		border: none;
		padding: var(--space-sm) var(--space-lg);
		border-radius: var(--radius-xs);
		font-size: var(--font-size-body);
		cursor: pointer;
	}

	.ok:hover {
		background: var(--sim-status-primary-hover);
	}
</style>
