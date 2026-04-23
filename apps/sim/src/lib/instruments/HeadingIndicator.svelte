<script lang="ts">
/**
 * Heading Indicator -- compass rose that rotates under a fixed reference
 * mark at the 12 o'clock position. Card rotates opposite to heading so the
 * current heading sits under the lubber line.
 */

let { headingDeg = 0 }: { headingDeg?: number } = $props();

const headingSafe = $derived(Number.isFinite(headingDeg) ? ((headingDeg % 360) + 360) % 360 : 0);
const cardAngle = $derived(-headingSafe);

// Card labels every 30 deg; major ticks every 10 deg; minor every 5.
const LABELS = [
	{ deg: 0, text: 'N' },
	{ deg: 30, text: '3' },
	{ deg: 60, text: '6' },
	{ deg: 90, text: 'E' },
	{ deg: 120, text: '12' },
	{ deg: 150, text: '15' },
	{ deg: 180, text: 'S' },
	{ deg: 210, text: '21' },
	{ deg: 240, text: '24' },
	{ deg: 270, text: 'W' },
	{ deg: 300, text: '30' },
	{ deg: 330, text: '33' },
];

const majorTicks = Array.from({ length: 36 }, (_, i) => i * 10);
</script>

<div class="instrument" aria-label={`Heading indicator reading ${headingSafe.toFixed(0)} degrees`}>
	<svg viewBox="0 0 200 200" role="img">
		<circle cx="100" cy="100" r="96" class="instrument-face" stroke-width="2" />

		<!-- Rotating compass card -->
		<g transform={`rotate(${cardAngle} 100 100)`}>
			{#each majorTicks as deg (deg)}
				{@const angle = deg - 90}
				{@const rad = (angle * Math.PI) / 180}
				{@const isMajor = deg % 30 === 0}
				<line
					x1={100 + 72 * Math.cos(rad)}
					y1={100 + 72 * Math.sin(rad)}
					x2={100 + (isMajor ? 82 : 78) * Math.cos(rad)}
					y2={100 + (isMajor ? 82 : 78) * Math.sin(rad)}
					class="tick-major"
					stroke-width={isMajor ? 2 : 1}
				/>
			{/each}
			{#each LABELS as label (label.deg)}
				{@const angle = label.deg - 90}
				{@const rad = (angle * Math.PI) / 180}
				{@const x = 100 + 60 * Math.cos(rad)}
				{@const y = 100 + 60 * Math.sin(rad)}
				<g transform={`rotate(${label.deg} ${x} ${y})`}>
					<text
						{x}
						{y}
						text-anchor="middle"
						dominant-baseline="central"
						font-size={label.text.length === 1 ? 16 : 12}
						class:label-north={label.text === 'N'}
						class:label-std={label.text !== 'N'}>{label.text}</text
					>
				</g>
			{/each}

			<!-- Aircraft silhouette at center (stays fixed as card rotates under it) -->
		</g>

		<!-- Fixed lubber line (12 o'clock reference) -->
		<polygon points="100,10 94,22 106,22" class="lubber-pointer" />
		<polygon points="100,190 94,178 106,178" class="lubber-aux" />
		<polygon points="10,100 22,94 22,106" class="lubber-aux" />
		<polygon points="190,100 178,94 178,106" class="lubber-aux" />

		<!-- Fixed aircraft symbol (always pointing up) -->
		<g>
			<line x1="82" y1="100" x2="118" y2="100" class="aircraft-ref" stroke-width="3" />
			<line x1="100" y1="86" x2="100" y2="114" class="aircraft-ref" stroke-width="3" />
			<line x1="92" y1="90" x2="108" y2="90" class="aircraft-ref" stroke-width="2" />
			<circle cx="100" cy="100" r="3" class="aircraft-ref-fill" />
		</g>

		<!-- Label + digital readout -->
		<text x="100" y="148" text-anchor="middle" font-size="10" class="unit-label">
			HDG
		</text>
		<rect x="78" y="154" width="44" height="18" rx="2" class="readout-box" stroke-width="1" />
		<text
			x="100"
			y="167"
			text-anchor="middle"
			font-size="14"
			class="digital-readout"
			font-weight="bold"
		>
			{headingSafe.toFixed(0).padStart(3, '0')}
		</text>
	</svg>
</div>

<style>
	.instrument {
		width: 200px;
		height: 200px;
	}

	svg {
		width: 100%;
		height: 100%;
		display: block;
	}

	.instrument-face {
		fill: var(--ab-sim-instrument-face);
		stroke: var(--ab-sim-instrument-bezel);
	}

	.tick-major {
		stroke: var(--ab-sim-instrument-tick);
	}

	.label-north {
		fill: var(--ab-sim-arc-red);
		font-family: var(--ab-font-mono);
	}

	.label-std {
		fill: var(--ab-sim-instrument-tick);
		font-family: var(--ab-font-mono);
	}

	.lubber-pointer {
		fill: var(--ab-sim-instrument-pointer);
	}

	.lubber-aux {
		fill: var(--ab-sim-instrument-tick-subtle);
	}

	.aircraft-ref {
		stroke: var(--ab-sim-instrument-pointer);
	}

	.aircraft-ref-fill {
		fill: var(--ab-sim-instrument-pointer);
	}

	.unit-label {
		fill: var(--ab-sim-instrument-tick-minor);
		font-family: var(--ab-font-mono);
	}

	.readout-box {
		fill: var(--ab-sim-instrument-pointer-pivot);
		stroke: var(--ab-sim-instrument-tick-faint);
	}

	.digital-readout {
		fill: var(--ab-sim-instrument-tick);
		font-family: var(--ab-font-mono);
	}
</style>
