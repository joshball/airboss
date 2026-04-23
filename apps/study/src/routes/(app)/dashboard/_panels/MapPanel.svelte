<script lang="ts">
import type { DomainCertCell, DomainCertRow, PanelResult } from '@ab/bc-study';
import {
	CERT_LABELS,
	CERT_VALUES,
	type Cert,
	DOMAIN_LABELS,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
	ROUTES,
} from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Domain x Cert mastery map. 14 rows x 4 cols of cells, coloured by percent
 * mastered. Null-percent cells (no nodes in that pair) render outlined with a
 * dash. Filled cells link into the knowledge browse pre-filtered by domain +
 * cert. Empty payload renders the full grid as null cells so the shape is
 * visible before any authoring has happened.
 */

let {
	domainCertMatrix,
}: {
	domainCertMatrix: PanelResult<DomainCertRow[]>;
} = $props();

const value = $derived('value' in domainCertMatrix ? domainCertMatrix.value : []);
const errorMessage = $derived('error' in domainCertMatrix ? domainCertMatrix.error : undefined);

/** Keyed lookup so the render can iterate DOMAIN_VALUES x CERT_VALUES order. */
const byDomain = $derived(
	new Map<Domain, Map<Cert, DomainCertCell>>(
		value.map((row) => [row.domain, new Map(row.cells.map((c) => [c.cert, c]))]),
	),
);

function cellFor(domain: Domain, cert: Cert): DomainCertCell {
	const certMap = byDomain.get(domain);
	if (!certMap) return { cert, total: 0, mastered: 0, percent: null };
	return certMap.get(cert) ?? { cert, total: 0, mastered: 0, percent: null };
}

/**
 * Bucket 0..1 percent into one of five fill intensities so the ramp is visible
 * in a compact grid without relying on alpha interpolation at render time.
 */
function intensityClass(percent: number | null): string {
	if (percent === null) return 'null';
	if (percent <= 0) return 'p0';
	if (percent < 0.25) return 'p1';
	if (percent < 0.5) return 'p2';
	if (percent < 0.75) return 'p3';
	if (percent < 1) return 'p4';
	return 'p5';
}

function cellHref(domain: Domain, cert: Cert): string {
	const params = `${QUERY_PARAMS.DOMAIN}=${encodeURIComponent(domain)}&${QUERY_PARAMS.CERT}=${encodeURIComponent(cert)}`;
	return `${ROUTES.KNOWLEDGE}?${params}`;
}

function cellTitle(domain: Domain, cell: DomainCertCell): string {
	const label = `${DOMAIN_LABELS[domain]} / ${CERT_LABELS[cell.cert]}`;
	if (cell.percent === null) return `${label} -- no nodes`;
	return `${label} -- ${cell.mastered} / ${cell.total} (${Math.round(cell.percent * 100)}%)`;
}
</script>

<PanelShell
	title="The map"
	subtitle="Domain x cert mastery"
	error={errorMessage}
>
	<div class="map" role="table" aria-label="Domain by cert mastery grid">
		<div class="head" role="row">
			<span class="corner" role="columnheader" aria-label="Domain"></span>
			{#each CERT_VALUES as cert (cert)}
				<span class="col-head" role="columnheader">{CERT_LABELS[cert]}</span>
			{/each}
		</div>

		{#each DOMAIN_VALUES as domain (domain)}
			<div class="row" role="row">
				<span class="row-head" role="rowheader">{DOMAIN_LABELS[domain]}</span>
				{#each CERT_VALUES as cert (cert)}
					{@const cell = cellFor(domain, cert)}
					{@const cls = intensityClass(cell.percent)}
					{#if cell.total > 0}
						<a
							class="cell filled {cls}"
							href={cellHref(domain, cert)}
							title={cellTitle(domain, cell)}
							role="cell"
						></a>
					{:else}
						<span class="cell empty" title={cellTitle(domain, cell)} role="cell">-</span>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</PanelShell>

<style>
	.map {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-3xs);
		min-width: 0;
	}

	.head,
	.row {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) repeat(4, minmax(1.25rem, 2rem));
		align-items: center;
		gap: var(--ab-space-2xs);
	}

	.col-head {
		font-family: var(--ab-font-family-mono);
		font-variant-numeric: tabular-nums;
		font-size: 0.6875rem;
		letter-spacing: 0.04em;
		color: var(--ab-color-fg-faint);
		text-align: center;
		padding-bottom: var(--ab-space-3xs);
	}

	.row-head {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.cell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 0.9375rem;
		border-radius: var(--ab-radius-hair);
		border: 1px solid var(--ab-color-border);
		font-size: 0.625rem;
		font-family: var(--ab-font-family-mono);
		color: var(--ab-color-fg-faint);
		text-decoration: none;
	}

	.cell.filled {
		border-color: transparent;
	}

	.cell.filled:hover {
		outline: 1px solid var(--ab-color-border-strong);
		outline-offset: 1px;
	}

	.cell.empty {
		background: transparent;
	}

	/* Five-step intensity ramp. Uses the success colour family so the map reads
	   as "progress" consistent with the cert-progress bars. p0 keeps a subtle
	   fill so "touched but 0% mastered" is still distinguishable from "no
	   nodes". */
	.cell.p0 {
		background: var(--ab-color-surface-sunken);
		border-color: var(--ab-color-border);
	}
	.cell.p1 {
		background: var(--ab-color-success-subtle);
		border-color: var(--ab-color-success-subtle-border);
	}
	.cell.p2 {
		background: var(--ab-color-success-subtle-border);
	}
	.cell.p3 {
		background: color-mix(in srgb, var(--ab-color-success) 45%, var(--ab-color-success-subtle-border));
	}
	.cell.p4 {
		background: color-mix(in srgb, var(--ab-color-success) 75%, var(--ab-color-success-subtle-border));
	}
	.cell.p5 {
		background: var(--ab-color-success);
	}

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.head,
		.row {
			grid-template-columns: minmax(6rem, 1fr) repeat(4, minmax(1rem, 1.5rem));
		}
	}
</style>
