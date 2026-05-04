<script lang="ts">
/**
 * The three-pill progress strip at the top of `/study`.
 *
 * Each pill is a `<progress>` element (semantically a progress bar) with
 * an explicit `aria-label` covering both the percentage and the absolute
 * count, so a screen reader reads "37 percent understood, 154 of 412
 * leaves." A separate visible label + count line keeps the design in
 * sync with the ASCII layout in `design.md`.
 */

import type { CredentialMasteryRollup } from '@ab/bc-study';

let { mastery }: { mastery: CredentialMasteryRollup } = $props();

const recall = $derived(mastery.byEvidenceKind.recall ?? { required: 0, passing: 0 });
const calculation = $derived(mastery.byEvidenceKind.calculation ?? { required: 0, passing: 0 });
const scenario = $derived(mastery.byEvidenceKind.scenario ?? { required: 0, passing: 0 });

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	return Math.round((num / den) * 100);
}
</script>

<section class="progress" aria-labelledby="progress-h">
	<h2 id="progress-h" class="hd">Where you are</h2>

	<div class="pills">
		<div class="pill">
			<progress
				class="bar"
				value={recall.passing}
				max={Math.max(1, recall.required)}
				aria-label="{pct(recall.passing, recall.required)} percent understood, {recall.passing} of {recall.required} leaves"
			>
				{pct(recall.passing, recall.required)}%
			</progress>
			<div class="row">
				<span class="num">{pct(recall.passing, recall.required)}%</span>
				<span class="lab">Understood</span>
			</div>
			<div class="cnt">{recall.passing} / {recall.required}</div>
		</div>

		<div class="pill">
			<progress
				class="bar"
				value={calculation.passing}
				max={Math.max(1, calculation.required)}
				aria-label="{pct(calculation.passing, calculation.required)} percent memorized, {calculation.passing} of {calculation.required} leaves"
			>
				{pct(calculation.passing, calculation.required)}%
			</progress>
			<div class="row">
				<span class="num">{pct(calculation.passing, calculation.required)}%</span>
				<span class="lab">Memorized</span>
			</div>
			<div class="cnt">{calculation.passing} / {calculation.required}</div>
		</div>

		<div class="pill">
			<progress
				class="bar"
				value={scenario.passing}
				max={Math.max(1, scenario.required)}
				aria-label="{pct(scenario.passing, scenario.required)} percent practiced, {scenario.passing} of {scenario.required} leaves"
			>
				{pct(scenario.passing, scenario.required)}%
			</progress>
			<div class="row">
				<span class="num">{pct(scenario.passing, scenario.required)}%</span>
				<span class="lab">Practiced</span>
			</div>
			<div class="cnt">{scenario.passing} / {scenario.required}</div>
		</div>
	</div>
</section>

<style>
.progress {
	display: flex;
	flex-direction: column;
	gap: var(--space-md);
}

.hd {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--ink-muted);
	font-weight: var(--font-weight-regular);
	text-transform: uppercase;
	letter-spacing: var(--letter-spacing-wide);
}

.pills {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: var(--space-lg);
}

.pill {
	display: flex;
	flex-direction: column;
	gap: var(--space-2xs);
}

.bar {
	width: 100%;
	height: 0.5rem;
	appearance: none;
	border: none;
	border-radius: var(--radius-sm);
	overflow: hidden;
	background: var(--surface-sunken);
}

.bar::-webkit-progress-bar {
	background: var(--surface-sunken);
}
.bar::-webkit-progress-value {
	background: var(--link-default);
}
.bar::-moz-progress-bar {
	background: var(--link-default);
}

.row {
	display: flex;
	gap: var(--space-sm);
	align-items: baseline;
}

.num {
	font-size: var(--font-size-xl);
	font-weight: var(--font-weight-medium);
	color: var(--ink-body);
}

.lab {
	font-size: var(--font-size-base);
	color: var(--ink-body);
}

.cnt {
	font-size: var(--font-size-sm);
	color: var(--ink-muted);
}

@media (max-width: 700px) {
	.pills {
		grid-template-columns: 1fr;
	}
}
</style>
