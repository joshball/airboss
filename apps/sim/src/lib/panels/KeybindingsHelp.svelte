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
		background: rgba(0, 0, 0, 0.75);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.panel {
		background: #1a1a1a;
		color: #f5f5f5;
		border: 1px solid #333;
		border-radius: 8px;
		max-width: 720px;
		width: 100%;
		max-height: 90vh;
		overflow: auto;
		padding: 1rem 1.25rem 1.25rem;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #2a2a2a;
		padding-bottom: 0.5rem;
		margin-bottom: 0.75rem;
	}

	h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.close {
		background: transparent;
		border: none;
		color: #aaa;
		font-family: ui-monospace, monospace;
		font-size: 1rem;
		cursor: pointer;
		padding: 0.2rem 0.5rem;
	}

	.close:hover {
		color: #f5f5f5;
	}

	.intro {
		color: #ccc;
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	section h3 {
		margin: 0 0 0.25rem 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #aaa;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.2rem 0.6rem;
		font-size: 0.82rem;
		margin: 0;
	}

	dt {
		font-family: ui-monospace, monospace;
		color: #ffe270;
		white-space: nowrap;
	}

	dd {
		margin: 0;
		color: #ddd;
	}

	.note {
		margin-top: 1rem;
		font-size: 0.85rem;
		color: #9bbfff;
		border-top: 1px solid #2a2a2a;
		padding-top: 0.5rem;
	}

	footer {
		margin-top: 0.75rem;
		display: flex;
		justify-content: flex-end;
	}

	.ok {
		background: #2563eb;
		color: #fff;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.ok:hover {
		background: #1d4ed8;
	}
</style>
