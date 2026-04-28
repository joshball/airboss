<script lang="ts">
/**
 * PFD shell. Owns the rAF loop, the keyboard handlers, and the
 * placeholder grid that the real instruments fill in a later wave.
 *
 * Layout follows the conventional G1000-style PFD: airspeed tape on
 * the left, attitude indicator filling the middle, altitude tape and
 * VSI on the right, heading strip across the bottom. Each cell is a
 * `<div class="pfd-slot">` with a label naming the instrument that
 * lands there; the slot sizes match the eventual SVG viewports.
 *
 * `selectedAircraftId` is propagated as a prop today and consumed by
 * later instrument waves for V-speed sourcing -- threading it through
 * now keeps the contract stable.
 */

import type { SimAircraftId } from '@ab/constants';
import PfdInputs from './PfdInputs.svelte';
import PfdKeyboardLegend from './PfdKeyboardLegend.svelte';
import { applyPfdKeyboardEvent, attachPfdTickLoop, DEFAULT_PFD_BINDINGS, PfdTickState } from './pfd-tick.svelte';

let {
	selectedAircraftId,
}: {
	selectedAircraftId: SimAircraftId;
} = $props();

// `selectedAircraftId` is read here so the prop is consumed -- Wave 4
// uses it for V-speed sourcing on the airspeed tape. Surfacing it on
// the shell today keeps the contract stable across waves.
const _aircraftId = $derived(selectedAircraftId);

const tick = new PfdTickState();
const bindings = DEFAULT_PFD_BINDINGS;
let legendOpen = $state(false);

const HELP_KEY = '?';
const RESET_KEY = '0';

$effect(() => attachPfdTickLoop(tick));

$effect(() => {
	if (typeof window === 'undefined') return;
	const onKeyDown = (event: KeyboardEvent): void => {
		// Avoid hijacking text input in form fields.
		const target = event.target as HTMLElement | null;
		if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

		if (event.key === HELP_KEY) {
			legendOpen = !legendOpen;
			event.preventDefault();
			return;
		}
		if (event.key === RESET_KEY) {
			tick.resetAll();
			event.preventDefault();
			return;
		}
		if (applyPfdKeyboardEvent(event, bindings, tick)) {
			event.preventDefault();
		}
	};
	window.addEventListener('keydown', onKeyDown);
	return () => window.removeEventListener('keydown', onKeyDown);
});

function closeLegend(): void {
	legendOpen = false;
}
</script>

<div class="pfd-frame" data-aircraft={_aircraftId}>
	<div class="pfd-grid" aria-label="Primary Flight Display">
		<div class="pfd-slot slot-asi">
			<span class="slot-label">Airspeed</span>
		</div>
		<div class="pfd-slot slot-attitude">
			<span class="slot-label">Attitude</span>
		</div>
		<div class="pfd-slot slot-alt">
			<span class="slot-label">Altitude</span>
		</div>
		<div class="pfd-slot slot-vsi">
			<span class="slot-label">VSI</span>
		</div>
		<div class="pfd-slot slot-heading">
			<span class="slot-label">Heading</span>
		</div>
	</div>

	<PfdInputs {bindings} state={tick} onReset={() => tick.resetAll()} />
</div>

<PfdKeyboardLegend
	open={legendOpen}
	{bindings}
	onClose={closeLegend}
	helpKeyLabel={HELP_KEY}
	resetKeyLabel={RESET_KEY}
/>

<style>
	.pfd-frame {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--surface-page, var(--surface-panel));
	}

	.pfd-grid {
		display: grid;
		flex: 1;
		min-height: 0;
		grid-template-columns: minmax(120px, 0.18fr) minmax(0, 1fr) minmax(120px, 0.18fr) minmax(80px, 0.1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		grid-template-areas:
			'asi attitude alt vsi'
			'heading heading heading heading';
		gap: var(--space-2xs);
		padding: var(--space-sm);
		background: var(--surface-sunken);
	}

	.pfd-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		min-height: 80px;
	}

	.slot-asi {
		grid-area: asi;
	}

	.slot-attitude {
		grid-area: attitude;
		min-height: 320px;
		background: var(--surface-panel);
	}

	.slot-alt {
		grid-area: alt;
	}

	.slot-vsi {
		grid-area: vsi;
	}

	.slot-heading {
		grid-area: heading;
		min-height: 64px;
	}

	.slot-label {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}
</style>
