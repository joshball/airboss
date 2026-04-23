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
		background: var(--ab-overlay-scrim-heavy);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--ab-space-xl);
	}

	.panel {
		background: var(--ab-sim-panel-bg);
		color: var(--ab-sim-panel-fg);
		border: 1px solid var(--ab-sim-panel-border);
		border-radius: var(--ab-radius-md);
		max-width: 720px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
		padding: var(--ab-space-lg) 1.25rem 1.25rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--ab-sim-panel-bg-elevated);
		padding-bottom: var(--ab-space-sm);
		margin-bottom: var(--ab-space-md);
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.close {
		background: transparent;
		border: none;
		color: var(--ab-sim-panel-fg-light);
		font-family: var(--ab-font-mono);
		font-size: 1rem;
		cursor: pointer;
		padding: 0.2rem var(--ab-space-sm);
	}

	.close:hover {
		color: var(--ab-sim-panel-fg);
	}

	.intro {
		color: var(--ab-sim-panel-fg-lighter);
		font-size: 0.9rem;
		margin: 0 0 var(--ab-space-md);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--ab-space-lg);
	}

	section h3 {
		margin: 0 0 var(--ab-space-2xs) 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ab-sim-panel-fg-light);
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.6rem;
		font-size: 0.82rem;
		margin: 0;
	}

	dt {
		font-family: var(--ab-font-mono);
		color: var(--ab-sim-instrument-pointer);
		white-space: nowrap;
	}

	dd {
		margin: 0;
		color: var(--ab-sim-panel-fg-lightest);
	}

	.note {
		margin-top: var(--ab-space-lg);
		font-size: 0.85rem;
		color: var(--ab-sim-status-primary-fg);
		border-top: 1px solid var(--ab-sim-panel-bg-elevated);
		padding-top: var(--ab-space-sm);
	}

	footer {
		margin-top: var(--ab-space-md);
		display: flex;
		justify-content: flex-end;
	}

	.ok {
		background: var(--ab-sim-status-primary);
		color: var(--ab-color-primary-fg);
		border: none;
		padding: var(--ab-space-sm) var(--ab-space-lg);
		border-radius: var(--ab-radius-xs);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.ok:hover {
		background: var(--ab-sim-status-primary-hover);
	}
</style>
