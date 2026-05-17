<script lang="ts">
/**
 * `/content` -- content census overview (hangar-content-census WP, Phase 1).
 *
 * Renders one row per managed-content corpus: count, derived-state
 * distribution, an explained health signal, planned-work count, and a link
 * into the per-corpus drill-down. Above the rows, intro prose explains what
 * the census is and the three layers (derived state / authored intent /
 * explanation) so a reader with no prior context can read the table.
 *
 * The health signal is never a bare colour: each shows a label and the rule
 * that produced it is exposed via a `title` tooltip on the cell.
 */

import { ROUTES } from '@ab/constants';
import type { CensusOverviewRow } from '@ab/content-census';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const rows: CensusOverviewRow[] = $derived(data.rows);
const fullCount = $derived(rows.filter((row) => row.mode === 'full').length);
const censusCount = $derived(rows.filter((row) => row.mode === 'census').length);
const stubCount = $derived(rows.filter((row) => row.mode === 'stub').length);

/** A stable, capped colour-free distribution bar -- each state is a labelled segment. */
function distributionTitle(row: CensusOverviewRow): string {
	if (row.stateDistribution.length === 0) return 'No derived states (census pending).';
	return row.stateDistribution.map((seg) => `${seg.count} ${seg.state}`).join(', ');
}
</script>

<svelte:head>
	<title>Content census - Hangar</title>
</svelte:head>

<div class="census">
	<header class="page-header">
		<div>
			<h1>Content census</h1>
			<p class="hint">
				Every managed-content corpus on the platform -- what exists, what state it is in, what is missing. The
				sibling
				<a href={ROUTES.HANGAR_ROADMAP}>Roadmap</a>
				dashboard tracks <em>process</em> (where work packages stand); this dashboard tracks
				<em>content</em> (what learning material exists and how complete it is).
			</p>
		</div>
		<div class="counts" aria-label="Counts">
			<span class="count"><strong>{rows.length}</strong> corpora</span>
			<span class="count"><strong>{fullCount}</strong> full</span>
			<span class="count"><strong>{censusCount}</strong> Layer 1</span>
			<span class="count"><strong>{stubCount}</strong> pending</span>
		</div>
	</header>

	<section class="intro" aria-label="How to read this census">
		<h2>How to read it</h2>
		<p>
			Each corpus is described by three layers. The dashboard renders all three as they become available.
		</p>
		<ol class="layers">
			<li>
				<strong>Derived state</strong> -- facts computed by reading the corpus today, no new metadata required.
				The state distribution and item counts below are Layer 1.
			</li>
			<li>
				<strong>Authored intent</strong> -- what a human plans, captured as frontmatter on each content item.
				The planned-work count is Layer 2; it shows <code>--</code> until a corpus has the intent block.
			</li>
			<li>
				<strong>Explanation</strong> -- every metric and gap carries a plain-language definition, the
				consequence, and the action. A bare number is never shown on its own.
			</li>
		</ol>
		<p class="phase-note">
			The <strong>encoded-text catalog</strong> is the full reference drill-down, with a real authored gap
			view. Corpora marked <strong>Layer 1</strong> have a real derived-state census -- inventory, state, and
			explained metrics -- with their gap view and authored intent deferred to Phase 3. Any remaining corpus
			shows an honest "census pending" placeholder -- no fabricated counts -- until its adapter lands.
		</p>
	</section>

	<section class="rows" aria-label="Corpora">
		<table>
			<thead>
				<tr>
					<th scope="col">Corpus</th>
					<th scope="col">Items</th>
					<th scope="col">Derived state</th>
					<th scope="col">Health</th>
					<th scope="col">Planned work</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr>
						<td class="corpus-cell">
							<a class="corpus-link" href={ROUTES.CONTENT_CENSUS_CORPUS(row.id)}>{row.label}</a>
							<span class="what-it-is">{row.whatItIs}</span>
						</td>
						<td class="num">
							{#if row.itemCount === null}
								<span class="pending-dash" title="No real adapter yet -- a count is not fabricated.">--</span>
							{:else}
								{row.itemCount}
							{/if}
						</td>
						<td>
							{#if row.stateDistribution.length === 0}
								<span class="muted">--</span>
							{:else}
								<span class="dist" title={distributionTitle(row)}>
									{#each row.stateDistribution as seg (seg.state)}
										<span class="dist-seg">
											<span class="dist-count">{seg.count}</span>
											<span class="dist-state">{seg.state}</span>
										</span>
									{/each}
								</span>
							{/if}
						</td>
						<td>
							<span class="health" data-level={row.health.level} title={row.health.rule}>
								{row.health.label}
							</span>
						</td>
						<td class="num">
							{#if row.plannedWorkCount === null}
								<span
									class="pending-dash"
									title="Layer 2 (authored intent) not yet captured for this corpus."
								>--</span>
							{:else}
								{row.plannedWorkCount}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

<style>
	.census {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.page-header h1 {
		margin: 0;
	}

	.hint {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		max-width: 64ch;
	}

	.hint a {
		color: var(--link-default);
	}

	.counts {
		display: flex;
		gap: var(--space-md);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}

	.count strong {
		color: var(--ink-body);
		font-family: var(--font-family-mono);
	}

	.intro {
		padding: var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.intro h2 {
		margin: 0;
		font-size: var(--type-ui-section-size, 1.25rem);
	}

	.intro p {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
		max-width: 72ch;
	}

	.layers {
		margin: 0;
		padding-left: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		font-size: var(--type-ui-label-size);
		max-width: 72ch;
	}

	.phase-note {
		color: var(--ink-muted);
	}

	code {
		font-family: var(--font-family-mono);
		font-size: var(--type-code-inline-size);
		background: var(--surface-page);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}

	table {
		border-collapse: collapse;
		width: 100%;
	}

	th,
	td {
		text-align: left;
		padding: var(--space-2xs) var(--space-sm);
		border-bottom: 1px solid var(--edge-default);
		vertical-align: top;
	}

	th {
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.num {
		font-family: var(--font-family-mono);
		text-align: right;
	}

	.corpus-cell {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		min-width: 16rem;
	}

	.corpus-link {
		color: var(--link-default);
		font-weight: var(--type-ui-control-weight);
		text-decoration: none;
	}

	.corpus-link:hover {
		text-decoration: underline;
	}

	.what-it-is {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.muted {
		color: var(--ink-muted);
	}

	.pending-dash {
		color: var(--ink-muted);
		cursor: help;
	}

	.dist {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.dist-seg {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-3xs);
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-size: var(--type-ui-caption-size);
	}

	.dist-count {
		font-family: var(--font-family-mono);
		color: var(--ink-body);
	}

	.dist-state {
		color: var(--ink-muted);
	}

	.health {
		display: inline-block;
		padding: var(--space-3xs) var(--space-2xs);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-caption-size);
		cursor: help;
	}

	.health[data-level='healthy'] {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
	}

	.health[data-level='attention'] {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
	}

	.health[data-level='surveyed'] {
		background: var(--signal-info-wash);
		color: var(--signal-info-ink);
	}

	.health[data-level='pending'] {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	td a:focus-visible,
	.corpus-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
