<script lang="ts">
/**
 * Control input panel -- shows every control surface position at snapshot
 * rate. Elevator has a trim ghost mark; STALL annunciator flashes when
 * alpha exceeds the stall-warning threshold.
 */

import type { FdmInputs } from '@ab/bc-sim';
import { SIM_FLAP_NOTCHES } from '@ab/constants';

const FLAP_MAX = SIM_FLAP_NOTCHES[SIM_FLAP_NOTCHES.length - 1];

let {
	inputs,
	trimBias = 0,
	brakeOn = false,
	stallWarning = false,
	stalled = false,
}: {
	inputs: FdmInputs;
	trimBias?: number;
	brakeOn?: boolean;
	stallWarning?: boolean;
	stalled?: boolean;
} = $props();

function pct(v: number): number {
	return Math.round(v * 100);
}
</script>

<section class="controls" aria-label="Control input panel">
	<h3>Controls</h3>

	<div class="grid">
		<div class="control vert elev">
			<span class="label">Elev</span>
			<div class="bar vert">
				<div class="center"></div>
				<div class="fill" style:height={`${Math.abs(inputs.elevator) * 50}%`} style:bottom={inputs.elevator >= 0 ? '50%' : `${50 - Math.abs(inputs.elevator) * 50}%`}></div>
				<!-- trim ghost -->
				<div class="trim-mark" style:bottom={`${50 + trimBias * 50}%`}></div>
			</div>
			<span class="value">{pct(inputs.elevator)}</span>
			<span class="sub">trim {pct(inputs.trim)}</span>
		</div>

		<div class="control horiz">
			<span class="label">Ail</span>
			<div class="bar horiz">
				<div class="center"></div>
				<div class="fill" style:width={`${Math.abs(inputs.aileron) * 50}%`} style:left={inputs.aileron >= 0 ? '50%' : `${50 - Math.abs(inputs.aileron) * 50}%`}></div>
			</div>
			<span class="value">{pct(inputs.aileron)}</span>
		</div>

		<div class="control horiz">
			<span class="label">Rud</span>
			<div class="bar horiz">
				<div class="center"></div>
				<div class="fill" style:width={`${Math.abs(inputs.rudder) * 50}%`} style:left={inputs.rudder >= 0 ? '50%' : `${50 - Math.abs(inputs.rudder) * 50}%`}></div>
			</div>
			<span class="value">{pct(inputs.rudder)}</span>
		</div>

		<div class="control vert thr">
			<span class="label">Thr</span>
			<div class="bar vert throttle">
				<div class="fill" style:height={`${inputs.throttle * 100}%`} style:bottom="0"></div>
			</div>
			<span class="value">{pct(inputs.throttle)}%</span>
		</div>

		<div class="control vert flaps">
			<span class="label">Flaps</span>
			<div class="bar vert flap-bar">
				{#each SIM_FLAP_NOTCHES as notch (notch)}
					<div class="notch" style:bottom={`${(notch / FLAP_MAX) * 100}%`}></div>
				{/each}
				<div class="fill" style:height={`${(inputs.flaps / FLAP_MAX) * 100}%`} style:bottom="0"></div>
			</div>
			<span class="value">{inputs.flaps}°</span>
		</div>
	</div>

	<div class="annunciators">
		<span class={brakeOn ? 'lamp on' : 'lamp'}>BRAKE</span>
		<span class={stalled ? 'lamp stall on flash' : stallWarning ? 'lamp stall on flash' : 'lamp stall'}>STALL</span>
		<span class={inputs.autoCoordinate ? 'lamp coord on' : 'lamp coord'}>AUTO-COORD</span>
	</div>
</section>

<style>
	.controls {
		padding: var(--space-md) var(--space-lg);
		background: var(--sim-panel-bg);
		border: 1px solid var(--sim-panel-bg-elevated);
		border-radius: var(--radius-sm);
		color: var(--sim-panel-fg);
	}

	h3 {
		margin: 0 0 var(--space-sm) 0;
		font-size: var(--font-size-sm);
		color: var(--sim-panel-fg-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.control {
		display: grid;
		grid-template-columns: 2.5rem 1fr 3rem 4.5rem;
		gap: var(--space-sm);
		align-items: center;
	}

	.control .label {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		color: var(--sim-panel-fg-light);
	}

	.control .value {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		text-align: right;
	}

	.control .sub {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		color: var(--sim-panel-fg-dim);
	}

	/* .sub appears only on Elev; other controls collapse the trailing cell. */
	.control.horiz .value,
	.control.vert.thr .value,
	.control.vert.flaps .value {
		grid-column: 3 / span 2;
	}

	.control.vert .bar.vert {
		position: relative;
		height: 70px;
		width: 20px;
		justify-self: start;
		background: var(--sim-panel-bg-darker);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-xs);
	}

	.control.horiz .bar.horiz {
		position: relative;
		height: 14px;
		background: var(--sim-panel-bg-darker);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-xs);
	}

	.bar.vert .center {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: var(--sim-panel-border);
	}

	.bar.horiz .center {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background: var(--sim-panel-border);
	}

	.bar .fill {
		position: absolute;
		background: var(--sim-status-warning);
	}

	.bar.vert .fill {
		left: 2px;
		right: 2px;
	}

	.bar.horiz .fill {
		top: 2px;
		bottom: 2px;
	}

	.bar.vert.throttle .fill {
		background: var(--sim-status-primary);
	}

	.bar.vert.flap-bar .fill {
		background: var(--sim-arc-white);
		opacity: 0.9;
	}

	/* Notches stick out on both sides of the bar so the detent positions
	   (0 / 10 / 20 / 30) are visible as indents in the flap gauge. */
	.bar.vert .notch {
		position: absolute;
		left: -4px;
		right: -4px;
		height: 2px;
		background: var(--sim-panel-fg-light);
		pointer-events: none;
	}

	.trim-mark {
		position: absolute;
		left: -3px;
		right: -3px;
		height: 2px;
		background: var(--sim-status-primary-fg);
		opacity: 0.8;
		transform: translateY(1px);
	}

	.annunciators {
		margin-top: var(--space-sm);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.lamp {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--sim-panel-border);
		border-radius: var(--radius-xs);
		color: var(--sim-panel-fg-faint);
		background: var(--sim-panel-bg-darker);
		letter-spacing: var(--letter-spacing-caps);
	}

	.lamp.on {
		background: var(--sim-status-warning-bg);
		color: var(--sim-instrument-pointer);
		border-color: var(--sim-status-warning-border);
	}

	.lamp.coord.on {
		background: var(--sim-status-success-bg);
		color: var(--sim-status-success);
		border-color: var(--sim-status-success-border);
	}

	.lamp.stall.on {
		background: var(--sim-status-danger-bg);
		color: var(--sim-status-danger-fg);
		border-color: var(--sim-status-danger-border);
	}

	.lamp.flash {
		/* lint-disable-token-enforcement: cockpit STALL annunciator cadence -- 600ms/2-step flash is a learned visual convention in training aids and must stay deterministic regardless of app motion tokens */
		animation: flash 0.6s steps(2, end) infinite;
	}

	@keyframes flash {
		0% {
			background: var(--sim-status-danger-bg);
			color: var(--sim-status-danger-fg);
		}
		50% {
			background: var(--sim-status-danger);
			color: var(--action-default-ink);
		}
		100% {
			background: var(--sim-status-danger-bg);
			color: var(--sim-status-danger-fg);
		}
	}
</style>
