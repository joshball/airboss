<script lang="ts">
/**
 * Always-visible keyboard cheatsheet. Renders a compact single-row summary
 * of `SIM_KEYBINDINGS` grouped by function. The full categorized help is
 * still available via the `?` overlay -- this bar is a glance-reference
 * for the in-flight pilot.
 *
 * Entries are derived from the constants, not hardcoded, so rebinding a
 * key in `libs/constants/src/sim.ts` automatically updates the cheatsheet.
 * Collapse state persists in localStorage under
 * `SIM_STORAGE_KEYS.CHEATSHEET_COLLAPSED`.
 */

import { SIM_KEYBINDING_ACTIONS, SIM_KEYBINDINGS, SIM_STORAGE_KEYS, type SimKeybindingAction } from '@ab/constants';
import { onMount } from 'svelte';
import { browser } from '$app/environment';

interface Cluster {
	id: string;
	keys: string;
	hint: string;
}

function labelFor(action: SimKeybindingAction): string {
	return SIM_KEYBINDINGS.find((b) => b.action === action)?.label ?? '';
}

// Clusters mirror the help overlay groupings but collapsed onto a single
// horizontal line. Each cluster shows the representative keys and a short
// function label so a new pilot can skim for the control they want.
const clusters: readonly Cluster[] = [
	{
		id: 'pitch',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN)} / ${labelFor(SIM_KEYBINDING_ACTIONS.ELEVATOR_UP)}`,
		hint: 'pitch',
	},
	{
		id: 'roll',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.AILERON_LEFT)} / ${labelFor(SIM_KEYBINDING_ACTIONS.AILERON_RIGHT)}`,
		hint: 'roll',
	},
	{
		id: 'rudder',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.RUDDER_LEFT)} / ${labelFor(SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT)}`,
		hint: 'rudder',
	},
	{
		id: 'throttle',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.THROTTLE_UP)} / ${labelFor(SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN)}`,
		hint: 'throttle',
	},
	{
		id: 'center',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.ELEVATOR_CENTER)} ${labelFor(SIM_KEYBINDING_ACTIONS.AILERON_CENTER)} ${labelFor(SIM_KEYBINDING_ACTIONS.RUDDER_CENTER)}`,
		hint: 'center',
	},
	{
		id: 'trim',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.TRIM_DOWN)} ${labelFor(SIM_KEYBINDING_ACTIONS.TRIM_UP)}`,
		hint: 'trim',
	},
	{
		id: 'flaps',
		keys: `${labelFor(SIM_KEYBINDING_ACTIONS.FLAPS_DOWN)} / ${labelFor(SIM_KEYBINDING_ACTIONS.FLAPS_UP)}`,
		hint: 'flaps',
	},
	{ id: 'brake', keys: labelFor(SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE), hint: 'brake' },
	{ id: 'pause', keys: labelFor(SIM_KEYBINDING_ACTIONS.PAUSE), hint: 'pause' },
	{ id: 'reset', keys: labelFor(SIM_KEYBINDING_ACTIONS.RESET), hint: 'reset' },
	{ id: 'help', keys: labelFor(SIM_KEYBINDING_ACTIONS.HELP_TOGGLE), hint: 'help' },
	{ id: 'mute', keys: labelFor(SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE), hint: 'mute' },
];

let collapsed = $state(false);

onMount(() => {
	if (!browser) return;
	collapsed = localStorage.getItem(SIM_STORAGE_KEYS.CHEATSHEET_COLLAPSED) === 'true';
});

function toggleCollapse(): void {
	collapsed = !collapsed;
	if (browser) {
		localStorage.setItem(SIM_STORAGE_KEYS.CHEATSHEET_COLLAPSED, collapsed ? 'true' : 'false');
	}
}
</script>

<section class="cheatsheet" class:collapsed aria-label="Keyboard cheatsheet">
	<button
		type="button"
		class="toggle"
		onclick={toggleCollapse}
		aria-expanded={!collapsed}
		aria-label={collapsed ? 'Expand keyboard cheatsheet' : 'Collapse keyboard cheatsheet'}
	>
		<span class="chevron" aria-hidden="true">{collapsed ? '>' : 'v'}</span>
		<span class="toggle-label">Keys</span>
	</button>
	{#if !collapsed}
		<ul class="clusters">
			{#each clusters as cluster, i (cluster.id)}
				<li class="cluster">
					<kbd>{cluster.keys}</kbd>
					<span class="hint">{cluster.hint}</span>
				</li>
				{#if i < clusters.length - 1}
					<li class="sep" aria-hidden="true">|</li>
				{/if}
			{/each}
		</ul>
	{/if}
</section>

<style>
	.cheatsheet {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		overflow: hidden;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		background: transparent;
		border: none;
		cursor: pointer;
		color: inherit;
		font-size: inherit;
		padding: var(--space-2xs) var(--space-2xs);
		border-radius: var(--radius-xs);
	}

	.toggle:hover {
		background: var(--edge-default);
	}

	.chevron {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		width: 0.7rem;
		display: inline-block;
		text-align: center;
	}

	.toggle-label {
		font-weight: 600;
		letter-spacing: var(--letter-spacing-wide);
	}

	.clusters {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm) var(--space-sm);
		margin: 0;
		padding: 0;
	}

	.cluster {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.sep {
		color: var(--edge-strong);
		user-select: none;
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

	.hint {
		color: var(--ink-muted);
	}
</style>
