<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

type GoDecision = 'go' | 'no-go';

/** A recorded decision for one replay step. */
interface StepDecision {
	zulu: string;
	at: string;
	decision: GoDecision;
}

// ---- replay state (only meaningful when data.mode === 'replay') ----
let cursor = $state(0);
const decisions = $state<StepDecision[]>([]);
let finished = $state(false);

const steps = $derived(data.bundle?.steps ?? []);
const currentStep = $derived(steps[cursor] ?? null);
const totalSteps = $derived(steps.length);
const atLastStep = $derived(cursor >= totalSteps - 1);

/** TAFs issued at or before the current step -- forecasting context. */
const visibleTafs = $derived.by(() => {
	const step = currentStep;
	if (step === null || data.bundle === null) return [];
	const stepMs = new Date(step.at).getTime();
	// A TAF is "in force" once its issue hour has been reached.
	return data.bundle.tafs.filter((taf) => zuluToMs(taf.issuedZulu, step.at) <= stepMs);
});

/**
 * Resolve a `DDHHZ` zulu label to a millisecond instant, using the
 * reference step's ISO timestamp to recover the year + month.
 */
function zuluToMs(zulu: string, referenceIso: string): number {
	const ref = new Date(referenceIso);
	const m = /^(\d{2})(\d{2})(\d{2})?Z$/.exec(zulu);
	if (m === null) return 0;
	const day = Number(m[1]);
	const hour = Number(m[2]);
	const minute = m[3] !== undefined ? Number(m[3]) : 0;
	return Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), day, hour, minute, 0);
}

/** Record the decision for the current step and advance. */
function decide(decision: GoDecision) {
	const step = currentStep;
	if (step === null) return;
	decisions[cursor] = { zulu: step.zulu, at: step.at, decision };
	if (atLastStep) {
		finished = true;
	} else {
		cursor += 1;
	}
}

/** Jump the scrubber to a specific step (does not clear later decisions). */
function scrubTo(index: number) {
	if (index < 0 || index >= totalSteps) return;
	cursor = index;
	finished = false;
}

/** Restart the replay from the first step. */
function restart() {
	cursor = 0;
	decisions.length = 0;
	finished = false;
}

const goCount = $derived(decisions.filter((d) => d?.decision === 'go').length);
const noGoCount = $derived(decisions.filter((d) => d?.decision === 'no-go').length);
</script>

<svelte:head>
	<title>Weather replay -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1 data-testid="page-anchor">Weather replay</h1>
		<p class="lead">
			Step a temporal weather scenario hour by hour. Watch the METARs, TAFs, and charts evolve as a front moves
			through, and make a go / no-go decision at each step.
		</p>
	</header>

	{#if data.mode === 'picker'}
		<div class="picker" data-testid="replay-picker">
			<h2>Pick a temporal scenario</h2>
			{#if data.scenarios.length === 0}
				<p class="empty">No temporal scenarios are registered yet.</p>
			{:else}
				<ul class="scenario-list">
					{#each data.scenarios as scenario (scenario.slug)}
						<li>
							{#if scenario.bundleReady}
								<a
									class="scenario-card"
									href={`${ROUTES.PRACTICE_WX_REPLAY}?scenario=${scenario.slug}`}
									data-testid={`replay-scenario-${scenario.slug}`}
								>
									<span class="scenario-name">{scenario.label}</span>
									<span class="scenario-slug">{scenario.slug}</span>
								</a>
							{:else}
								<div class="scenario-card disabled" data-testid={`replay-scenario-${scenario.slug}`}>
									<span class="scenario-name">{scenario.label}</span>
									<span class="scenario-slug">{scenario.slug}</span>
									<span class="not-built">timeline bundle not built</span>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if data.bundle !== null && !finished && currentStep !== null}
		<div class="replay" data-testid="replay-session">
			<div class="replay-head">
				<h2>{data.bundle.label}</h2>
				<a class="text" href={ROUTES.PRACTICE_WX_REPLAY}>Pick another scenario</a>
			</div>

			<!-- Timeline scrubber -->
			<div class="scrubber" data-testid="replay-scrubber">
				{#each steps as step, i (step.at)}
					<button
						type="button"
						class="tick"
						class:current={i === cursor}
						class:decided={decisions[i] !== undefined}
						onclick={() => scrubTo(i)}
						data-testid={`replay-tick-${i}`}
						aria-label={`Jump to ${step.zulu}`}
					>
						{step.zulu}
					</button>
				{/each}
			</div>

			<div class="step-meta">
				<span data-testid="replay-step-label">
					Hour {cursor + 1} of {totalSteps} -- {currentStep.zulu} (+{currentStep.hoursSinceStart}h)
				</span>
			</div>

			<!-- METARs for this hour -->
			<section class="metars">
				<h3>METARs at {currentStep.zulu}</h3>
				<ul class="metar-list">
					{#each currentStep.metars as metar (metar.station)}
						<li>
							<span class="station">{metar.station}</span>
							<code class="raw">{metar.raw}</code>
						</li>
					{/each}
				</ul>
			</section>

			<!-- TAFs in force -->
			{#if visibleTafs.length > 0}
				<section class="tafs">
					<h3>TAFs in force</h3>
					<ul class="taf-list">
						{#each visibleTafs as taf, i (`${taf.station}-${taf.issuedZulu}-${i}`)}
							<li>
								<span class="station">{taf.station}</span>
								<span class="issued">issued {taf.issuedZulu}</span>
								<code class="raw">{taf.raw}</code>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<!-- Charts for this hour -->
			{#if currentStep.charts.length > 0}
				<section class="charts" data-testid="replay-charts">
					<h3>Charts at {currentStep.zulu}</h3>
					<div class="chart-grid">
						{#each currentStep.charts as chart (chart.kind)}
							<figure class="chart">
								<figcaption>{chart.kind}</figcaption>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- the SVG is engine-generated, not user input -->
								<div class="chart-svg">{@html chart.svg}</div>
							</figure>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Go / no-go decision -->
			<section class="decision">
				<h3>Your call at {currentStep.zulu}</h3>
				<p class="decision-prompt">
					Given everything you see at this hour, would you depart now?
				</p>
				<div class="decision-actions">
					<button type="button" class="go" onclick={() => decide('go')} data-testid="replay-go">Go</button>
					<button type="button" class="no-go" onclick={() => decide('no-go')} data-testid="replay-no-go">
						No-go
					</button>
				</div>
				{#if decisions[cursor] !== undefined}
					<p class="prior-decision" data-testid="replay-prior-decision">
						You chose <strong>{decisions[cursor]?.decision}</strong> at this hour.
					</p>
				{/if}
			</section>
		</div>
	{:else if data.bundle !== null && finished}
		<div class="summary" data-testid="replay-summary">
			<h2>Replay summary -- {data.bundle.label}</h2>
			<dl class="totals">
				<dt>Hours stepped</dt>
				<dd>{decisions.filter((d) => d !== undefined).length}</dd>
				<dt>Go decisions</dt>
				<dd>{goCount}</dd>
				<dt>No-go decisions</dt>
				<dd>{noGoCount}</dd>
			</dl>

			<section class="decision-log">
				<h3>Decision log</h3>
				<table>
					<thead>
						<tr>
							<th>Hour</th>
							<th>Decision</th>
						</tr>
					</thead>
					<tbody>
						{#each decisions as decision, i (i)}
							{#if decision !== undefined}
								<tr>
									<td>{decision.zulu}</td>
									<td class:go={decision.decision === 'go'} class:no-go={decision.decision === 'no-go'}>
										{decision.decision}
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</section>

			<div class="summary-actions">
				<button type="button" class="primary" onclick={restart} data-testid="replay-restart">
					Replay again
				</button>
				<a class="text" href={ROUTES.PRACTICE_WX_REPLAY}>Pick another scenario</a>
			</div>
		</div>
	{/if}
</section>

<style>
.page {
	max-width: 72rem;
	margin: 0 auto;
	padding: var(--space-lg);
}
.hd {
	margin-bottom: var(--space-xl);
}
.lead {
	color: var(--ink-muted);
	margin-top: var(--space-xs);
}
h2 {
	margin: 0 0 var(--space-md) 0;
}
h3 {
	margin: var(--space-md) 0 var(--space-xs) 0;
}

/* picker */
.scenario-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-sm);
}
.scenario-card {
	display: flex;
	flex-direction: column;
	gap: var(--space-3xs);
	padding: var(--space-md);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-md);
	background: var(--surface-panel);
	text-decoration: none;
	color: inherit;
}
.scenario-card:hover:not(.disabled) {
	border-color: var(--action-link);
}
.scenario-card.disabled {
	opacity: 0.6;
}
.scenario-name {
	font-weight: 600;
}
.scenario-slug {
	font-family: var(--font-family-mono);
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}
.not-built {
	font-size: var(--font-size-xs);
	color: var(--signal-danger);
}
.empty {
	color: var(--ink-muted);
}

/* replay */
.replay-head {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
}
.scrubber {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-3xs);
	margin: var(--space-md) 0;
}
.tick {
	padding: var(--space-3xs) var(--space-xs);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
	background: var(--surface-panel);
	font-family: var(--font-family-mono);
	font-size: var(--font-size-xs);
	cursor: pointer;
}
.tick.decided {
	border-color: var(--signal-success-edge);
}
.tick.current {
	background: var(--action-link);
	color: var(--ink-inverse);
	border-color: var(--action-link);
}
.step-meta {
	color: var(--ink-muted);
	margin-bottom: var(--space-sm);
}
.metar-list,
.taf-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-xs);
}
.metar-list li,
.taf-list li {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-xs);
	align-items: baseline;
}
.station {
	font-weight: 600;
	min-width: 4rem;
}
.issued {
	font-size: var(--font-size-xs);
	color: var(--ink-muted);
}
.raw {
	font-family: var(--font-family-mono);
	background: var(--surface-sunken);
	padding: var(--space-3xs) var(--space-xs);
	border-radius: var(--radius-sm);
	word-break: break-word;
}
.chart-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
	gap: var(--space-md);
}
.chart {
	margin: 0;
	border: 1px solid var(--edge-subtle);
	border-radius: var(--radius-md);
	padding: var(--space-sm);
	background: var(--surface-panel);
}
.chart figcaption {
	font-weight: 600;
	color: var(--ink-muted);
	margin-bottom: var(--space-xs);
}
.chart-svg :global(svg) {
	width: 100%;
	height: auto;
}
.decision {
	margin-top: var(--space-lg);
	padding: var(--space-md);
	border-radius: var(--radius-md);
	background: var(--surface-sunken);
}
.decision-prompt {
	color: var(--ink-muted);
}
.decision-actions {
	display: flex;
	gap: var(--space-md);
	margin-top: var(--space-sm);
}
button.go,
button.no-go,
button.primary {
	padding: var(--space-sm) var(--space-lg);
	border: none;
	border-radius: var(--radius-sm);
	font-weight: 600;
	cursor: pointer;
}
button.go {
	background: var(--signal-success-edge);
	color: var(--ink-inverse);
}
button.no-go {
	background: var(--signal-danger-edge);
	color: var(--ink-inverse);
}
button.primary {
	background: var(--action-link);
	color: var(--ink-inverse);
}
.prior-decision {
	margin-top: var(--space-sm);
	color: var(--ink-muted);
}
a.text {
	color: var(--action-link);
	text-decoration: underline;
}

/* summary */
.totals {
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: var(--space-xs) var(--space-md);
	margin: var(--space-md) 0;
}
.totals dt {
	color: var(--ink-muted);
}
.totals dd {
	margin: 0;
	font-weight: 600;
}
.decision-log table {
	width: 100%;
	border-collapse: collapse;
	margin-top: var(--space-sm);
}
.decision-log th,
.decision-log td {
	padding: var(--space-xs) var(--space-sm);
	border-bottom: 1px solid var(--edge-subtle);
	text-align: left;
}
.decision-log td.go {
	color: var(--signal-success);
	font-weight: 600;
}
.decision-log td.no-go {
	color: var(--signal-danger);
	font-weight: 600;
}
.summary-actions {
	display: flex;
	gap: var(--space-md);
	align-items: center;
	margin-top: var(--space-lg);
}
</style>
