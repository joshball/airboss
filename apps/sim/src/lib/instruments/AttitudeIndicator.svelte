<script lang="ts">
/**
 * Attitude Indicator -- horizon line that tilts (roll) and translates
 * vertically (pitch). Phase 0 has zero roll, so the visible behavior is
 * pitch up/down. Pitch ladder at 10-deg marks.
 *
 * Pitch display convention: nose-up shows more blue (sky) below the
 * horizon line from the pilot's perspective -- i.e., the horizon scrolls
 * down on the gauge.
 */

let { pitchRadians = 0, rollRadians = 0 }: { pitchRadians?: number; rollRadians?: number } = $props();

const pitch = $derived(Number.isFinite(pitchRadians) ? pitchRadians : 0);
const roll = $derived(Number.isFinite(rollRadians) ? rollRadians : 0);

const PIXELS_PER_DEG = 2.4;
const pitchDeg = $derived((pitch * 180) / Math.PI);
const rollDeg = $derived((roll * 180) / Math.PI);
const offsetY = $derived(pitchDeg * PIXELS_PER_DEG);

const ladderLines = [-30, -20, -10, 10, 20, 30];
</script>

<div class="instrument" aria-label={`Attitude indicator pitch ${pitchDeg.toFixed(1)} degrees`}>
	<svg viewBox="0 0 200 200" role="img">
		<defs>
			<clipPath id="ai-clip">
				<circle cx="100" cy="100" r="90" />
			</clipPath>
		</defs>

		<circle cx="100" cy="100" r="96" fill="#111" stroke="#333" stroke-width="2" />

		<g clip-path="url(#ai-clip)">
			<!-- Rolled + pitched horizon world -->
			<g transform={`rotate(${-rollDeg} 100 100) translate(0 ${offsetY})`}>
				<!-- Sky -->
				<rect x="-200" y="-400" width="800" height="500" fill="#3b7bb5" />
				<!-- Ground -->
				<rect x="-200" y="100" width="800" height="500" fill="#7a4e25" />
				<!-- Horizon line -->
				<line x1="-200" y1="100" x2="400" y2="100" stroke="#f5f5f5" stroke-width="2" />

				<!-- Pitch ladder -->
				{#each ladderLines as deg (deg)}
					{@const y = 100 - deg * PIXELS_PER_DEG}
					{@const width = Math.abs(deg) % 20 === 0 ? 36 : 20}
					<line x1={100 - width} y1={y} x2={100 + width} y2={y} stroke="#f5f5f5" stroke-width="1.5" />
					<text
						x={100 - width - 6}
						y={y + 3}
						text-anchor="end"
						font-size="10"
						fill="#f5f5f5"
						font-family="ui-monospace, monospace">{Math.abs(deg)}</text
					>
					<text
						x={100 + width + 6}
						y={y + 3}
						text-anchor="start"
						font-size="10"
						fill="#f5f5f5"
						font-family="ui-monospace, monospace">{Math.abs(deg)}</text
					>
				{/each}
			</g>

			<!-- Fixed aircraft reference (miniature plane) -->
			<g>
				<line x1="70" y1="100" x2="88" y2="100" stroke="#ffe270" stroke-width="3" />
				<line x1="112" y1="100" x2="130" y2="100" stroke="#ffe270" stroke-width="3" />
				<circle cx="100" cy="100" r="3" fill="#ffe270" />
				<line x1="88" y1="100" x2="100" y2="108" stroke="#ffe270" stroke-width="3" />
				<line x1="112" y1="100" x2="100" y2="108" stroke="#ffe270" stroke-width="3" />
			</g>
		</g>

		<!-- Bezel overlay -->
		<circle cx="100" cy="100" r="90" fill="none" stroke="#222" stroke-width="4" />

		<text x="100" y="172" text-anchor="middle" font-size="10" fill="#bbb" font-family="ui-monospace, monospace">
			PITCH {pitchDeg.toFixed(1)}°
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
</style>
