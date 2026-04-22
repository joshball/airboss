<script lang="ts">
/**
 * Control input panel -- shows every control surface position at snapshot
 * rate. Elevator has a trim ghost mark; STALL annunciator flashes when
 * alpha exceeds the stall-warning threshold.
 */

import type { FdmInputs } from '@ab/bc-sim';

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
		<div class="control vert">
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

		<div class="control vert">
			<span class="label">Thr</span>
			<div class="bar vert throttle">
				<div class="fill" style:height={`${inputs.throttle * 100}%`} style:bottom="0"></div>
			</div>
			<span class="value">{pct(inputs.throttle)}%</span>
		</div>
	</div>

	<div class="annunciators">
		<span class={brakeOn ? 'lamp on' : 'lamp'}>BRAKE</span>
		<span class="lamp flaps">FLAPS {inputs.flaps}</span>
		<span class={stalled ? 'lamp stall on flash' : stallWarning ? 'lamp stall on flash' : 'lamp stall'}>STALL</span>
		<span class={inputs.autoCoordinate ? 'lamp coord on' : 'lamp coord'}>AUTO-COORD</span>
	</div>
</section>

<style>
	.controls {
		padding: 0.6rem 0.8rem;
		background: #1a1a1a;
		border: 1px solid #2a2a2a;
		border-radius: 6px;
		color: #f5f5f5;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.85rem;
		color: #bbb;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.grid {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.3rem 0.5rem;
		align-items: center;
	}

	.control {
		display: contents;
	}

	.control .label {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		color: #aaa;
	}

	.control .value {
		font-family: ui-monospace, monospace;
		font-size: 0.8rem;
		text-align: right;
		width: 3rem;
	}

	.control .sub {
		font-family: ui-monospace, monospace;
		font-size: 0.7rem;
		color: #777;
	}

	.control.vert .bar.vert {
		grid-column: 2;
		position: relative;
		height: 70px;
		width: 20px;
		justify-self: start;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 3px;
	}

	.control.horiz .bar.horiz {
		grid-column: 2;
		position: relative;
		height: 14px;
		background: #0a0a0a;
		border: 1px solid #333;
		border-radius: 3px;
	}

	.bar.vert .center {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: rgba(255, 255, 255, 0.2);
	}

	.bar.horiz .center {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background: rgba(255, 255, 255, 0.2);
	}

	.bar .fill {
		position: absolute;
		background: #ffa62b;
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
		background: #2563eb;
	}

	.trim-mark {
		position: absolute;
		left: -3px;
		right: -3px;
		height: 2px;
		background: #9bbfff;
		opacity: 0.8;
		transform: translateY(1px);
	}

	.annunciators {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.lamp {
		font-family: ui-monospace, monospace;
		font-size: 0.72rem;
		padding: 0.15rem 0.4rem;
		border: 1px solid #333;
		border-radius: 3px;
		color: #555;
		background: #0a0a0a;
		letter-spacing: 0.05em;
	}

	.lamp.on {
		background: #5a4000;
		color: #ffe270;
		border-color: #8b6a00;
	}

	.lamp.coord.on {
		background: #063b1c;
		color: #2fb856;
		border-color: #0c5a2c;
	}

	.lamp.stall.on {
		background: #4a1210;
		color: #ffd1cf;
		border-color: #852524;
	}

	.lamp.flash {
		animation: flash 0.6s steps(2, end) infinite;
	}

	@keyframes flash {
		0% {
			background: #4a1210;
			color: #ffd1cf;
		}
		50% {
			background: #e0443e;
			color: #fff;
		}
		100% {
			background: #4a1210;
			color: #ffd1cf;
		}
	}
</style>
