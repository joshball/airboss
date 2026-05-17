<script lang="ts">
/**
 * `/practice/wx/test-page` -- truth-model authoring sandbox (Drill Phase 4).
 *
 * Admin-only power-user surface. Three panels:
 *
 *   1. Truth-model slider panel -- one control per truth-model lever.
 *      Moving any slider re-derives a METAR + TAF + METAR-plot chart via
 *      the `derive` POST endpoint (debounced).
 *   2. Compare-against-expected -- paste an expected METAR; the page shows
 *      a positional token diff against the engine output.
 *   3. Save-as-catalog-example -- writes a `CatalogExampleCandidate`
 *      sidecar to `examples-pending/` for review.
 *
 * Every derivation runs server-side: `deriveMetar`/`deriveTaf` and the
 * chart renderer are server-only, so this component only POSTs slider
 * state and renders the returned strings + SVG.
 */

import { ROUTES } from '@ab/constants';
import { untrack } from 'svelte';
import { diffIsClean, diffMetarTokens } from './_lib/diff';
import type {
	SandboxDeriveResult,
	SandboxFrontIntensity,
	SandboxHazardSeverity,
	SandboxSliderState,
} from './_lib/types';
import { SANDBOX_FRONT_INTENSITIES, SANDBOX_HAZARD_SEVERITIES } from './_lib/types';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const bounds = $derived(data.sliderBounds);

// ---- slider state ----
// Seeded once from the server default. `untrack` makes the one-time read
// explicit -- the slider state is owned by the component after mount, not
// driven by `data`.
let slider = $state<SandboxSliderState>(untrack(() => ({ ...data.defaultState })));

// ---- derive result ----
let result = $state<SandboxDeriveResult | null>(null);
let deriving = $state(false);
let deriveError = $state<string | null>(null);

// ---- compare-against-expected ----
let expectedMetar = $state('');

// ---- save-as-candidate form ----
let candidateSlug = $state('');
let candidateProduct = $state<'metar' | 'taf'>('metar');
let candidateSynoptic = $state('');
let candidateFamilies = $state('');
let candidateRefs = $state('');
let saving = $state(false);
let saveMessage = $state<string | null>(null);
let saveError = $state<string | null>(null);

/**
 * Positional token diff between the engine METAR and the pasted expected
 * string. Empty when either side is missing.
 */
const diffRows = $derived(
	result?.metarRaw && expectedMetar.trim().length > 0 ? diffMetarTokens(result.metarRaw, expectedMetar) : [],
);
const diffClean = $derived(diffRows.length > 0 && diffIsClean(diffRows));

let deriveTimer: ReturnType<typeof setTimeout> | null = null;

/** POST the current slider state to the derive endpoint. */
async function runDerive() {
	deriving = true;
	deriveError = null;
	try {
		const resp = await fetch(ROUTES.PRACTICE_WX_TEST_PAGE_DERIVE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(slider),
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(text || `Derive failed: ${resp.status}`);
		}
		result = (await resp.json()) as SandboxDeriveResult;
	} catch (err) {
		deriveError = err instanceof Error ? err.message : String(err);
		result = null;
	} finally {
		deriving = false;
	}
}

/**
 * Debounced re-derive: every slider change schedules a derive 250 ms out,
 * so dragging a slider doesn't fire one request per pixel.
 */
$effect(() => {
	// Touch every lever so the effect re-runs on any change.
	void slider.windDirDeg;
	void slider.windKt;
	void slider.tempC;
	void slider.dewpointSpreadC;
	void slider.seaLevelPressureMb;
	void slider.frontDistanceKm;
	void slider.frontIntensity;
	void slider.cellDistanceNm;
	void slider.hazardSeverity;
	if (deriveTimer !== null) clearTimeout(deriveTimer);
	deriveTimer = setTimeout(() => {
		void runDerive();
	}, 250);
	return () => {
		if (deriveTimer !== null) clearTimeout(deriveTimer);
	};
});

function resetSliders() {
	slider = { ...data.defaultState };
}

/** Parse a newline-separated `source | detail` list into reference objects. */
function parseReferences(text: string): Array<{ source: string; detail: string }> {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const [source, ...rest] = line.split('|');
			return { source: (source ?? '').trim(), detail: rest.join('|').trim() };
		})
		.filter((r) => r.source.length > 0 && r.detail.length > 0);
}

/** POST the save-as-catalog-example candidate. */
async function saveCandidate() {
	saveMessage = null;
	saveError = null;
	if (result === null) {
		saveError = 'Derive a product first.';
		return;
	}
	const raw = candidateProduct === 'metar' ? result.metarRaw : result.tafRaw;
	if (raw === null || raw.length === 0) {
		saveError = `No ${candidateProduct.toUpperCase()} was derived for the current sliders.`;
		return;
	}
	const families = candidateFamilies
		.split(',')
		.map((f) => f.trim())
		.filter((f) => f.length > 0);
	saving = true;
	try {
		const resp = await fetch(ROUTES.PRACTICE_WX_TEST_PAGE_SAVE_CANDIDATE, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				slug: candidateSlug.trim(),
				product: candidateProduct,
				raw,
				synoptic: candidateSynoptic.trim(),
				tokenFamilies: families,
				references: parseReferences(candidateRefs),
				sliderState: slider,
			}),
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(text || `Save failed: ${resp.status}`);
		}
		const json = (await resp.json()) as { slug: string };
		saveMessage = `Saved candidate "${json.slug}.json" to examples-pending/ for review.`;
	} catch (err) {
		saveError = err instanceof Error ? err.message : String(err);
	} finally {
		saving = false;
	}
}
</script>

<svelte:head><title>Wx truth-model sandbox</title></svelte:head>

<div class="page">
	<header class="hd">
		<h1 data-testid="page-anchor">Weather truth-model sandbox</h1>
		<p class="lead">
			Admin authoring surface. Drag a lever to re-derive a METAR + TAF and re-render the
			METAR-plot chart for {data.station.name} ({data.station.icao}). Save a result as a
			catalog-example candidate, or compare it against a hand-authored expected string.
		</p>
	</header>

	<div class="layout">
		<!-- ---- slider panel ---- -->
		<section class="panel" aria-label="Truth-model levers">
			<div class="panel-hd">
				<h2>Truth-model levers</h2>
				<button type="button" class="btn-ghost" onclick={resetSliders}>Reset</button>
			</div>

			<label class="lever">
				<span class="lever-label">Wind direction <em>{slider.windDirDeg}&deg;</em></span>
				<input
					type="range"
					min={bounds.windDirDeg.min}
					max={bounds.windDirDeg.max}
					step={bounds.windDirDeg.step}
					bind:value={slider.windDirDeg}
				/>
			</label>

			<label class="lever">
				<span class="lever-label">Wind speed <em>{slider.windKt} kt</em></span>
				<input
					type="range"
					min={bounds.windKt.min}
					max={bounds.windKt.max}
					step={bounds.windKt.step}
					bind:value={slider.windKt}
				/>
			</label>

			<label class="lever">
				<span class="lever-label">Temperature <em>{slider.tempC}&deg;C</em></span>
				<input
					type="range"
					min={bounds.tempC.min}
					max={bounds.tempC.max}
					step={bounds.tempC.step}
					bind:value={slider.tempC}
				/>
			</label>

			<label class="lever">
				<span class="lever-label">Temp/dewpoint spread <em>{slider.dewpointSpreadC}&deg;C</em></span>
				<input
					type="range"
					min={bounds.dewpointSpreadC.min}
					max={bounds.dewpointSpreadC.max}
					step={bounds.dewpointSpreadC.step}
					bind:value={slider.dewpointSpreadC}
				/>
			</label>

			<label class="lever">
				<span class="lever-label">Sea-level pressure <em>{slider.seaLevelPressureMb} mb</em></span>
				<input
					type="range"
					min={bounds.seaLevelPressureMb.min}
					max={bounds.seaLevelPressureMb.max}
					step={bounds.seaLevelPressureMb.step}
					bind:value={slider.seaLevelPressureMb}
				/>
			</label>

			<fieldset class="lever-group">
				<legend>Cold front (drives post-frontal gusts)</legend>
				<label class="lever">
					<span class="lever-label">
						Front proximity
						<em>{slider.frontDistanceKm >= bounds.frontDistanceKm.max ? 'no front' : `${slider.frontDistanceKm} km`}</em>
					</span>
					<input
						type="range"
						min={bounds.frontDistanceKm.min}
						max={bounds.frontDistanceKm.max}
						step={bounds.frontDistanceKm.step}
						bind:value={slider.frontDistanceKm}
					/>
				</label>
				<div class="seg" role="radiogroup" aria-label="Front intensity">
					{#each SANDBOX_FRONT_INTENSITIES as intensity (intensity)}
						<button
							type="button"
							class="seg-btn"
							class:on={slider.frontIntensity === intensity}
							aria-pressed={slider.frontIntensity === intensity}
							onclick={() => {
								slider.frontIntensity = intensity as SandboxFrontIntensity;
							}}
						>
							{intensity}
						</button>
					{/each}
				</div>
			</fieldset>

			<label class="lever">
				<span class="lever-label">
					Convective cell distance
					<em>{slider.cellDistanceNm >= bounds.cellDistanceNm.max ? 'no cell' : `${slider.cellDistanceNm} NM`}</em>
				</span>
				<input
					type="range"
					min={bounds.cellDistanceNm.min}
					max={bounds.cellDistanceNm.max}
					step={bounds.cellDistanceNm.step}
					bind:value={slider.cellDistanceNm}
				/>
			</label>

			<fieldset class="lever-group">
				<legend>IFR / fog hazard severity</legend>
				<div class="seg" role="radiogroup" aria-label="Hazard severity">
					{#each SANDBOX_HAZARD_SEVERITIES as severity (severity)}
						<button
							type="button"
							class="seg-btn"
							class:on={slider.hazardSeverity === severity}
							aria-pressed={slider.hazardSeverity === severity}
							onclick={() => {
								slider.hazardSeverity = severity as SandboxHazardSeverity;
							}}
						>
							{severity}
						</button>
					{/each}
				</div>
			</fieldset>
		</section>

		<!-- ---- live preview ---- -->
		<section class="panel" aria-label="Derived products">
			<div class="panel-hd">
				<h2>Derived products</h2>
				{#if deriving}<span class="status">deriving&hellip;</span>{/if}
			</div>

			{#if deriveError}
				<p class="error" role="alert">{deriveError}</p>
			{/if}

			{#if result}
				<h3>METAR</h3>
				<pre class="encoded">{result.metarRaw}</pre>

				<h3>TAF</h3>
				{#if result.tafRaw}
					<pre class="encoded">{result.tafRaw}</pre>
				{:else}
					<p class="warn" role="status">
						TAF not derivable for these levers{result.tafError ? `: ${result.tafError}` : ''}.
					</p>
				{/if}

				<h3>METAR plot</h3>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- chart SVG is engine-rendered, not user input -->
				<div class="chart">{@html result.chartSvg}</div>
			{:else if !deriveError}
				<p class="lead">Move a lever to derive.</p>
			{/if}
		</section>
	</div>

	<!-- ---- compare-against-expected ---- -->
	<section class="panel wide" aria-label="Compare against expected">
		<div class="panel-hd"><h2>Compare against expected</h2></div>
		<label class="field">
			<span>Expected METAR string</span>
			<input
				type="text"
				class="text-input mono"
				placeholder="KTST 191953Z 20012KT 10SM FEW055 17/13 A2992"
				bind:value={expectedMetar}
			/>
		</label>
		{#if diffRows.length > 0}
			<p class="diff-status" class:clean={diffClean}>
				{diffClean ? 'Engine output matches the expected string.' : 'Engine output differs from the expected string.'}
			</p>
			<table class="diff">
				<thead>
					<tr><th>#</th><th>Engine</th><th>Expected</th></tr>
				</thead>
				<tbody>
					{#each diffRows as row, i (i)}
						<tr class:mismatch={!row.match}>
							<td class="diff-idx">{i + 1}</td>
							<td class="mono">{row.actual ?? '—'}</td>
							<td class="mono">{row.expected ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<!-- ---- save as catalog example ---- -->
	<section class="panel wide" aria-label="Save as catalog example">
		<div class="panel-hd"><h2>Save as catalog example</h2></div>
		<p class="lead">
			Writes a candidate sidecar to <code>encoded-text-catalog/examples-pending/</code> for
			review. A human promotes it into the catalog markdown.
		</p>

		<div class="form-grid">
			<label class="field">
				<span>Slug (kebab-case)</span>
				<input type="text" class="text-input mono" placeholder="metar-postfrontal-gust-tst" bind:value={candidateSlug} />
			</label>

			<label class="field">
				<span>Product</span>
				<select class="text-input" bind:value={candidateProduct}>
					<option value="metar">METAR</option>
					<option value="taf">TAF</option>
				</select>
			</label>

			<label class="field span-2">
				<span>Synoptic story (1-2 sentences)</span>
				<textarea
					class="text-input"
					rows="2"
					placeholder="Post-frontal cold sector behind a strong cold front; tightening gradient drives gusty NW winds."
					bind:value={candidateSynoptic}
				></textarea>
			</label>

			<label class="field span-2">
				<span>Token families (comma-separated slugs)</span>
				<input type="text" class="text-input" placeholder="wind-gust, sky-overcast, altimeter" bind:value={candidateFamilies} />
			</label>

			<label class="field span-2">
				<span>References (one per line, <code>source | detail</code>)</span>
				<textarea
					class="text-input"
					rows="3"
					placeholder={'AC 00-45H | Chapter 3 - METAR wind group\nAIM | 7-1-29 - METAR key'}
					bind:value={candidateRefs}
				></textarea>
			</label>
		</div>

		<button type="button" class="btn" disabled={saving || result === null} onclick={saveCandidate}>
			{saving ? 'Saving…' : 'Save candidate'}
		</button>
		{#if saveMessage}<p class="ok" role="status">{saveMessage}</p>{/if}
		{#if saveError}<p class="error" role="alert">{saveError}</p>{/if}
	</section>
</div>

<style>
.page {
	max-width: 72rem;
	margin: 0 auto;
	padding: var(--space-lg);
}
.hd {
	margin-bottom: var(--space-lg);
}
.lead {
	color: var(--ink-muted);
	margin-top: var(--space-xs);
}
.layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
	gap: var(--space-lg);
}
@media (max-width: 56rem) {
	.layout {
		grid-template-columns: minmax(0, 1fr);
	}
}
.panel {
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	background: var(--surface-panel);
	padding: var(--space-md);
	margin-bottom: var(--space-lg);
}
.panel.wide {
	grid-column: 1 / -1;
}
.panel-hd {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	margin-bottom: var(--space-sm);
}
.panel-hd h2 {
	margin: 0;
}
.status {
	color: var(--ink-muted);
	font-size: var(--font-size-sm);
}
.lever {
	display: block;
	margin-bottom: var(--space-sm);
}
.lever-label {
	display: flex;
	justify-content: space-between;
	font-size: var(--font-size-body);
	margin-bottom: var(--space-3xs);
}
.lever-label em {
	font-style: normal;
	font-weight: 600;
	color: var(--action-link);
}
.lever input[type='range'] {
	width: 100%;
}
.lever-group {
	border: 1px solid var(--edge-subtle, var(--edge-default));
	border-radius: var(--radius-sm);
	padding: var(--space-sm);
	margin-bottom: var(--space-sm);
}
.lever-group legend {
	font-size: var(--font-size-sm);
	font-weight: 600;
	padding: 0 var(--space-2xs);
}
.seg {
	display: flex;
	gap: var(--space-3xs);
	flex-wrap: wrap;
}
.seg-btn {
	flex: 1;
	padding: var(--space-2xs) var(--space-xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	background: var(--surface-page);
	cursor: pointer;
	font-size: var(--font-size-sm);
	text-transform: capitalize;
}
.seg-btn.on {
	background: var(--action-link);
	color: var(--ink-inverse);
	border-color: var(--action-link);
}
.encoded {
	font-family: var(--font-family-mono);
	background: var(--surface-page);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	padding: var(--space-sm);
	overflow-x: auto;
	white-space: pre-wrap;
	word-break: break-word;
}
.chart {
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	overflow: hidden;
}
.chart :global(svg) {
	display: block;
	width: 100%;
	height: auto;
}
.error {
	color: var(--signal-danger);
}
.warn {
	color: var(--signal-warning);
}
.ok {
	color: var(--signal-success);
}
.field {
	display: flex;
	flex-direction: column;
	gap: var(--space-3xs);
	font-size: var(--font-size-body);
	margin-bottom: var(--space-sm);
}
.text-input {
	padding: var(--space-2xs) var(--space-xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	background: var(--surface-page);
	color: inherit;
	font: inherit;
	width: 100%;
}
.mono {
	font-family: var(--font-family-mono);
}
.form-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: var(--space-sm);
}
@media (max-width: 40rem) {
	.form-grid {
		grid-template-columns: 1fr;
	}
}
.span-2 {
	grid-column: 1 / -1;
}
.btn {
	padding: var(--space-xs) var(--space-md);
	border: 1px solid var(--action-link);
	border-radius: var(--radius-sm);
	background: var(--action-link);
	color: var(--ink-inverse);
	cursor: pointer;
	font: inherit;
}
.btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.btn-ghost {
	padding: var(--space-3xs) var(--space-xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	background: transparent;
	color: inherit;
	cursor: pointer;
	font-size: var(--font-size-sm);
}
.diff {
	width: 100%;
	border-collapse: collapse;
	margin-top: var(--space-sm);
}
.diff th,
.diff td {
	text-align: left;
	padding: var(--space-3xs) var(--space-xs);
	border-bottom: 1px solid var(--edge-default);
	font-size: var(--font-size-sm);
}
.diff .diff-idx {
	color: var(--ink-muted);
	width: 2rem;
}
.diff tr.mismatch {
	background: var(--signal-danger-wash);
}
.diff-status {
	font-weight: 600;
	color: var(--signal-danger);
}
.diff-status.clean {
	color: var(--signal-success);
}
</style>
