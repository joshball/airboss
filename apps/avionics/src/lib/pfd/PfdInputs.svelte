<script lang="ts">
/**
 * Slider strip below the PFD. Six sliders, one per channel, each
 * writes directly to the matching target in the supplied tick state.
 * Bindings come from `DEFAULT_PFD_BINDINGS` (the spec's Inputs table)
 * so range/step/default never live in component code.
 */

import type { PfdTickState } from './pfd-tick.svelte';
import { PFD_INPUT_KEYS, type PfdInputBindings } from './pfd-types';

let {
	bindings,
	state,
	onReset,
}: {
	bindings: PfdInputBindings;
	state: PfdTickState;
	onReset?: () => void;
} = $props();

function readTarget(key: string): number {
	switch (key) {
		case PFD_INPUT_KEYS.PITCH:
			return state.target.pitchDeg;
		case PFD_INPUT_KEYS.BANK:
			return state.target.bankDeg;
		case PFD_INPUT_KEYS.AIRSPEED:
			return state.target.airspeedKnots;
		case PFD_INPUT_KEYS.ALTITUDE:
			return state.target.altitudeFeet;
		case PFD_INPUT_KEYS.HEADING:
			return state.target.headingDeg;
		case PFD_INPUT_KEYS.VERTICAL_SPEED:
			return state.target.verticalSpeedFpm;
		default:
			return 0;
	}
}

function setValue(key: string, value: number): void {
	const next = { ...state.target };
	switch (key) {
		case PFD_INPUT_KEYS.PITCH:
			next.pitchDeg = value;
			break;
		case PFD_INPUT_KEYS.BANK:
			next.bankDeg = value;
			break;
		case PFD_INPUT_KEYS.AIRSPEED:
			next.airspeedKnots = value;
			break;
		case PFD_INPUT_KEYS.ALTITUDE:
			next.altitudeFeet = value;
			break;
		case PFD_INPUT_KEYS.HEADING:
			next.headingDeg = value;
			break;
		case PFD_INPUT_KEYS.VERTICAL_SPEED:
			next.verticalSpeedFpm = value;
			break;
	}
	state.target = next;
}
</script>

<section class="strip" aria-label="PFD inputs">
	<ul>
		{#each bindings as binding (binding.key)}
			{@const value = readTarget(binding.key)}
			<li>
				<label>
					<span class="label">{binding.label}</span>
					<span class="value">{value.toFixed(binding.step < 1 ? 1 : 0)} {binding.unitLabel}</span>
					<input
						type="range"
						min={binding.min}
						max={binding.max}
						step={binding.step}
						{value}
						oninput={(e) => setValue(binding.key, Number((e.target as HTMLInputElement).value))}
					/>
				</label>
			</li>
		{/each}
	</ul>
	{#if onReset}
		<div class="actions">
			<button type="button" class="reset" onclick={() => onReset?.()}>Reset</button>
		</div>
	{/if}
</section>

<style>
	.strip {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border-top: 1px solid var(--edge-default);
		background: var(--surface-panel);
	}

	.strip ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-md);
	}

	.strip label {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'label value'
			'slider slider';
		gap: var(--space-2xs);
		align-items: baseline;
	}

	.label {
		grid-area: label;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.value {
		grid-area: value;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	input[type='range'] {
		grid-area: slider;
		width: 100%;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.reset {
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-body);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.reset:hover,
	.reset:focus-visible {
		border-color: var(--action-default);
	}
</style>
