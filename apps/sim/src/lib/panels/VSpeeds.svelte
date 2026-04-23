<script lang="ts">
/**
 * V-speeds reference panel. Always visible while flying. Pulls values from
 * C172_CONFIG so arcs on the ASI and these numbers stay in sync.
 */

import { C172_CONFIG } from '@ab/bc-sim';
import { SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';

function kt(msv: number): string {
	return (msv * SIM_KNOTS_PER_METER_PER_SECOND).toFixed(0);
}

const rows = [
	{ name: 'Vs0', val: kt(C172_CONFIG.vS0), note: 'stall, landing config', colorClass: 'white' },
	{ name: 'Vs', val: kt(C172_CONFIG.vS1), note: 'stall, clean', colorClass: 'green' },
	{ name: 'Vr', val: kt(C172_CONFIG.vR), note: 'rotation', colorClass: 'plain' },
	{ name: 'Vx', val: kt(C172_CONFIG.vX), note: 'best angle climb', colorClass: 'plain' },
	{ name: 'Vy', val: kt(C172_CONFIG.vY), note: 'best rate climb', colorClass: 'plain' },
	{ name: 'Va', val: kt(C172_CONFIG.vA), note: 'maneuvering', colorClass: 'plain' },
	{ name: 'Vno', val: kt(C172_CONFIG.vNo), note: 'max structural cruise', colorClass: 'green' },
	{ name: 'Vne', val: kt(C172_CONFIG.vNe), note: 'never exceed', colorClass: 'red' },
	{ name: 'Vfe', val: kt(C172_CONFIG.vFe), note: 'max flaps extended', colorClass: 'white' },
];
</script>

<section class="vspeeds" aria-label="V-speed reference table">
	<h3>V-speeds</h3>
	<table>
		<tbody>
			{#each rows as row (row.name)}
				<tr>
					<td class="name"><span class={`swatch ${row.colorClass}`}></span>{row.name}</td>
					<td class="val">{row.val}</td>
					<td class="unit">KIAS</td>
					<td class="note">{row.note}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<style>
	.vspeeds {
		padding: 0.6rem 0.8rem;
		background: var(--ab-sim-panel-bg);
		border: 1px solid var(--ab-sim-panel-bg-elevated);
		border-radius: var(--ab-radius-sm);
		color: var(--ab-sim-panel-fg);
	}

	.vspeeds h3 {
		margin: 0 0 var(--ab-space-sm) 0;
		font-size: 0.85rem;
		color: var(--ab-sim-panel-fg-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--ab-font-mono);
		font-size: 0.8rem;
	}

	td {
		padding: 0.1rem 0.3rem;
		white-space: nowrap;
	}

	td.name {
		width: 4.5rem;
	}

	td.val {
		text-align: right;
		width: 2rem;
	}

	td.unit {
		color: var(--ab-sim-panel-fg-subtle);
		width: 3rem;
	}

	td.note {
		color: var(--ab-sim-panel-fg-note);
		font-size: 0.72rem;
	}

	.swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		margin-right: 0.35rem;
		vertical-align: middle;
		border-radius: var(--ab-radius-xs);
	}

	.swatch.green {
		background: var(--ab-sim-arc-green);
	}

	.swatch.white {
		background: var(--ab-sim-arc-white);
	}

	.swatch.red {
		background: var(--ab-sim-arc-red);
	}

	.swatch.plain {
		background: transparent;
		border: 1px solid var(--ab-sim-instrument-tick-faint);
	}
</style>
