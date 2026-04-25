<script lang="ts">
/**
 * Instrument storybook gallery (dev-only).
 *
 * Renders every shipped instrument across a matrix of (truth-state preset) x
 * (active fault). Phase 3 ships the gallery rig; the per-instrument fault
 * cells use the identity transform until the B5.* fan-out PRs flip each
 * fault branch to the real rendering.
 *
 * Use cases:
 *   - Eyeball every gauge in every fault state without booting a scenario.
 *   - Visual regression baselines: Playwright screenshots this page per PR
 *     and diffs the cells; B5.* PRs accept new baselines as faults light up.
 *   - Manual a11y scan: tab through the page, every cell has aria-label.
 *
 * Not exposed in production navigation. Reachable via the cockpit dev URL
 * `sim.airboss.test/_dev/instruments` only.
 */

import { applyFaults, type DisplayState, type FaultActivation } from '@ab/bc-sim';
import { SIM_FAULT_KINDS, SIM_FAULT_LABELS, SIM_FLAP_NOTCHES, type SimFaultKind } from '@ab/constants';
import Altimeter from '$lib/instruments/Altimeter.svelte';
import Asi from '$lib/instruments/Asi.svelte';
import AttitudeIndicator from '$lib/instruments/AttitudeIndicator.svelte';
import HeadingIndicator from '$lib/instruments/HeadingIndicator.svelte';
import Tachometer from '$lib/instruments/Tachometer.svelte';
import TurnCoordinator from '$lib/instruments/TurnCoordinator.svelte';
import Vsi from '$lib/instruments/Vsi.svelte';

interface Preset {
	id: string;
	label: string;
	description: string;
	truth: Parameters<typeof applyFaults>[0]['truth'];
}

const NOMINAL_VOLTS = 28;

function makeTruth(overrides: Partial<Preset['truth']> = {}): Preset['truth'] {
	return {
		t: 0,
		x: 0,
		altitude: 305,
		groundElevation: 305,
		u: 0,
		w: 0,
		pitch: 0,
		pitchRate: 0,
		roll: 0,
		rollRate: 0,
		yawRate: 0,
		heading: 0,
		alpha: 0,
		trueAirspeed: 0,
		indicatedAirspeed: 0,
		groundSpeed: 0,
		verticalSpeed: 0,
		liftCoefficient: 0,
		dragCoefficient: 0,
		loadFactor: 1,
		slipBall: 0,
		onGround: true,
		brakeOn: true,
		stallWarning: false,
		stalled: false,
		flapsDegrees: SIM_FLAP_NOTCHES[0],
		elevatorEffective: 0,
		engineRpm: 800,
		...overrides,
	};
}

const PRESETS: readonly Preset[] = [
	{
		id: 'parked',
		label: 'Parked',
		description: 'Brake on, idle, on the runway.',
		truth: makeTruth(),
	},
	{
		id: 'cruise',
		label: 'Level cruise',
		description: '95 KIAS, 3000 ft, S&L, 2200 RPM.',
		truth: makeTruth({
			altitude: 914,
			groundElevation: 305,
			indicatedAirspeed: 49,
			trueAirspeed: 49,
			groundSpeed: 49,
			pitch: 0.04,
			engineRpm: 2200,
			onGround: false,
		}),
	},
	{
		id: 'climb',
		label: 'Vy climb',
		description: '74 KIAS, climbing 700 fpm at 10 deg pitch.',
		truth: makeTruth({
			altitude: 610,
			groundElevation: 305,
			indicatedAirspeed: 38,
			trueAirspeed: 38,
			groundSpeed: 37,
			verticalSpeed: 3.6,
			pitch: 0.17,
			alpha: 0.12,
			engineRpm: 2500,
			onGround: false,
		}),
	},
	{
		id: 'turn',
		label: '30 deg right turn',
		description: 'Coordinated, 90 KIAS, slip ball centered.',
		truth: makeTruth({
			altitude: 914,
			groundElevation: 305,
			indicatedAirspeed: 46,
			trueAirspeed: 46,
			groundSpeed: 46,
			roll: 0.52,
			yawRate: 0.05,
			heading: 1.57,
			engineRpm: 2200,
			onGround: false,
		}),
	},
	{
		id: 'stall',
		label: 'Stall warning',
		description: '45 KIAS, alpha at warning threshold.',
		truth: makeTruth({
			altitude: 914,
			groundElevation: 305,
			indicatedAirspeed: 23,
			trueAirspeed: 23,
			groundSpeed: 22,
			pitch: 0.21,
			alpha: 0.21,
			engineRpm: 1800,
			stallWarning: true,
			onGround: false,
		}),
	},
] as const;

const FAULT_OPTIONS: readonly { id: 'none' | SimFaultKind; label: string }[] = [
	{ id: 'none', label: 'No fault' },
	...Object.values(SIM_FAULT_KINDS).map((kind) => ({ id: kind, label: SIM_FAULT_LABELS[kind] })),
];

let currentFault = $state<'none' | SimFaultKind>('none');

const activations = $derived<readonly FaultActivation[]>(
	currentFault === 'none'
		? []
		: [
				{
					kind: currentFault,
					firedAtT: 0,
					params: {
						vacuumDriftDegPerSec: 1.0,
						alternatorDecaySeconds: 60,
						gyroTumbleContinues: true,
						staticBlockFreezeAltFt: 1000,
						pitotBlockFreezeKias: 80,
					},
				},
			],
);

function display(preset: Preset): DisplayState {
	return applyFaults({
		truth: preset.truth,
		activations,
		nominalBusVolts: NOMINAL_VOLTS,
	});
}

function kias(d: DisplayState): number {
	// Match the cockpit's airspeed conversion (m/s -> KIAS).
	return d.indicatedAirspeed * 1.943844492440605;
}
function altitudeFt(d: DisplayState): number {
	return d.altitudeMsl * 3.28084;
}
function vsiFpm(d: DisplayState): number {
	return d.verticalSpeed * 3.28084 * 60;
}
function pitchRad(d: DisplayState): number {
	return d.pitchIndicated;
}
function rollRad(d: DisplayState): number {
	return d.rollIndicated;
}
function headingDeg(d: DisplayState): number {
	return (d.headingIndicated * 180) / Math.PI;
}
function yawRateDegPerSec(d: DisplayState): number {
	return (d.yawRateIndicated * 180) / Math.PI;
}
</script>

<svelte:head>
	<title>Instrument gallery -- airboss sim (dev)</title>
</svelte:head>

<main>
	<header>
		<h1>Instrument gallery</h1>
		<p class="lede">
			Every instrument across every truth-state preset, optionally faulted. Phase 3 ships the rig;
			per-instrument fault rendering lights up across the B5.* fan-out PRs.
		</p>
		<label class="fault-picker">
			Fault:
			<select bind:value={currentFault}>
				{#each FAULT_OPTIONS as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
		</label>
	</header>

	{#each PRESETS as preset (preset.id)}
		{@const d = display(preset)}
		<section class="preset" aria-labelledby={`preset-${preset.id}-title`}>
			<header class="preset-head">
				<h2 id={`preset-${preset.id}-title`}>{preset.label}</h2>
				<p>{preset.description}</p>
			</header>
			<div class="row">
				<figure aria-label={`Airspeed indicator -- ${preset.label}`}>
					<Asi kias={kias(d)} />
					<figcaption>ASI</figcaption>
				</figure>
				<figure aria-label={`Attitude indicator -- ${preset.label}`}>
					<AttitudeIndicator pitchRadians={pitchRad(d)} rollRadians={rollRad(d)} />
					<figcaption>AI</figcaption>
				</figure>
				<figure aria-label={`Altimeter -- ${preset.label}`}>
					<Altimeter altitudeFeet={altitudeFt(d)} />
					<figcaption>ALT</figcaption>
				</figure>
			</div>
			<div class="row">
				<figure aria-label={`Turn coordinator -- ${preset.label}`}>
					<TurnCoordinator yawRateDegPerSec={yawRateDegPerSec(d)} slipBall={d.slipBall} />
					<figcaption>TC</figcaption>
				</figure>
				<figure aria-label={`Heading indicator -- ${preset.label}`}>
					<HeadingIndicator headingDeg={headingDeg(d)} />
					<figcaption>HI</figcaption>
				</figure>
				<figure aria-label={`Vertical speed indicator -- ${preset.label}`}>
					<Vsi fpm={vsiFpm(d)} />
					<figcaption>VSI</figcaption>
				</figure>
			</div>
			<div class="row">
				<figure aria-label={`Tachometer -- ${preset.label}`}>
					<Tachometer rpm={d.engineRpm} />
					<figcaption>TACH</figcaption>
				</figure>
				<dl class="meta" aria-label="Display state numeric values">
					<dt>Bus volts</dt>
					<dd>{d.electricBusVolts.toFixed(1)} V</dd>
					<dt>Alpha</dt>
					<dd>{((d.alpha * 180) / Math.PI).toFixed(1)} deg</dd>
					<dt>Stall warning</dt>
					<dd>{d.stallWarning ? 'on' : 'off'}</dd>
					<dt>Stalled</dt>
					<dd>{d.stalled ? 'yes' : 'no'}</dd>
					<dt>On ground</dt>
					<dd>{d.onGround ? 'yes' : 'no'}</dd>
				</dl>
			</div>
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: var(--space-lg);
		color: var(--ink-body);
	}
	header {
		margin-bottom: var(--space-xl);
	}
	h1 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-2xl);
	}
	.lede {
		margin: 0 0 var(--space-md);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
		max-width: 60ch;
	}
	.fault-picker {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}
	.preset {
		margin-bottom: var(--space-2xl);
		padding: var(--space-lg);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}
	.preset-head h2 {
		margin: 0 0 var(--space-2xs);
		font-size: var(--font-size-lg);
	}
	.preset-head p {
		margin: 0 0 var(--space-md);
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
	.row {
		display: grid;
		grid-template-columns: repeat(3, 200px);
		gap: var(--space-lg);
		justify-content: start;
		margin-bottom: var(--space-md);
	}
	figure {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0;
	}
	figcaption {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		margin-top: var(--space-2xs);
	}
	.meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2xs) var(--space-md);
		align-items: center;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		margin: 0;
		padding: var(--space-sm);
		background: var(--sim-panel-bg-darker);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-sm);
		color: var(--sim-panel-fg);
	}
	.meta dt {
		color: var(--sim-panel-fg-muted);
	}
	.meta dd {
		margin: 0;
	}
</style>
