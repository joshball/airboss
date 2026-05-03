<script lang="ts">
/**
 * Cockpit annunciator strip. Five lamps that light when their
 * predicate fires on the current display state. Pure renderer --
 * predicates live in libs/bc/sim/src/annunciators.ts so the cockpit
 * and the dev gallery cannot disagree about which lamp should be lit.
 *
 * Lamps stay simple flat squares with on/off styling. They flash via
 * the same CSS animation pattern as the existing STALL annunciator.
 */

import { annunciatorState, C172_CONFIG, type DisplayState } from '@ab/bc-sim';

interface Props {
	display: DisplayState | null;
}

let { display }: Props = $props();

const state = $derived(display === null ? null : annunciatorState(display, C172_CONFIG));
</script>

<!--
	Lamps are status indicators, not buttons. Drop `aria-pressed` (which is
	only valid on role=button) and rely on the wrapping role="status"
	(which is a polite live region) plus the on/off class swap to convey
	state changes to AT.
-->
<div class="strip" role="status" aria-label="System annunciators">
	<span class={state?.lowVoltage ? 'lamp on' : 'lamp'}>LOW VOLTS</span>
	<span class={state?.lowFuel ? 'lamp on' : 'lamp'}>LOW FUEL</span>
	<span class={state?.oilPress ? 'lamp on flash' : 'lamp'}>OIL PRESS</span>
	<span class={state?.oilTemp ? 'lamp on flash' : 'lamp'}>OIL TEMP</span>
	<span class={state?.vacuumLow ? 'lamp on' : 'lamp'}>VAC LOW</span>
</div>

<style>
	.strip {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		padding: var(--space-xs) var(--space-sm);
		background: var(--sim-instrument-face);
		border: 1px solid var(--sim-instrument-bezel);
		border-radius: var(--radius-sm);
	}
	.lamp {
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-xs, 11px);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--sim-instrument-bezel);
		border-radius: var(--radius-xs);
		color: var(--sim-instrument-tick-faint);
		background: var(--sim-instrument-face-inner);
		letter-spacing: var(--letter-spacing-caps);
	}
	.lamp.on {
		background: var(--sim-arc-yellow);
		color: var(--sim-instrument-face);
		border-color: var(--sim-arc-yellow);
	}
	/*
	 * The 0.8s/2-step flash is a learned cockpit visual convention. Honor
	 * `prefers-reduced-motion` by suppressing the animation while keeping
	 * the lit colour; the warning is still conveyed by colour + label.
	 */
	@media (prefers-reduced-motion: no-preference) {
		.lamp.flash {
			/* lint-disable-token-enforcement: cockpit annunciator cadence -- 800ms/2-step flash is a learned visual convention; deterministic regardless of motion tokens */
			animation: lamp-flash 0.8s steps(2, end) infinite;
		}
	}

	@keyframes lamp-flash {
		0% {
			background: var(--sim-arc-yellow);
			color: var(--sim-instrument-face);
		}
		50% {
			background: var(--sim-arc-red);
			color: var(--sim-instrument-tick);
		}
		100% {
			background: var(--sim-arc-yellow);
			color: var(--sim-instrument-face);
		}
	}
</style>
