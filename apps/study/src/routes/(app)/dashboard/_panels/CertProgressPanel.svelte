<script lang="ts">
import type { CertProgress, PanelResult } from '@ab/bc-study';
import { CERT_LABELS, CERT_VALUES, type Cert } from '@ab/constants';
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Cert-progress panel. One row per cert (PPL/IR/CPL/CFI) with a compact bar
 * showing mastered / in-progress / remaining and tabular-numeric counts.
 *
 * Rows iterate over CERT_VALUES (not the payload's order) so an empty payload
 * still renders four muted rows with a "no nodes at this cert level yet"
 * hint. Bar segments use CSS flex so mastered and in-progress stack without
 * overlapping.
 */

let {
	certProgress,
}: {
	certProgress: PanelResult<CertProgress[]>;
} = $props();

const value = $derived('value' in certProgress ? certProgress.value : []);
const errorMessage = $derived('error' in certProgress ? certProgress.error : undefined);

/** Map cert -> row so the render loop can pull by CERT_VALUES order. */
const byCert = $derived(new Map<Cert, CertProgress>(value.map((row) => [row.cert, row])));

function rowFor(cert: Cert): CertProgress {
	return byCert.get(cert) ?? { cert, total: 0, mastered: 0, inProgress: 0, percent: 0 };
}

function pctOf(n: number, total: number): string {
	if (total === 0) return '0%';
	return `${(n / total) * 100}%`;
}
</script>

<PanelShell
	title="Cert progress"
	subtitle="Mastered nodes per cert (core + supporting)"
	error={errorMessage}
>
	<ul class="rows">
		{#each CERT_VALUES as cert (cert)}
			{@const row = rowFor(cert)}
			{@const empty = row.total === 0}
			<li class="row" class:empty>
				<span class="chip">{CERT_LABELS[cert]}</span>
				{#if empty}
					<span class="hint">no nodes at this cert level yet</span>
				{:else}
					<span class="bar" aria-hidden="true">
						<span class="bar-mastered" style:width={pctOf(row.mastered, row.total)}></span>
						<span class="bar-in-progress" style:width={pctOf(row.inProgress, row.total)}></span>
					</span>
					<span class="counts">
						<span class="count-mastered">{row.mastered}</span>
						<span class="count-sep">/</span>
						<span class="count-total">{row.total}</span>
					</span>
					<span class="pct">{Math.round(row.percent * 100)}%</span>
				{/if}
			</li>
		{/each}
	</ul>
</PanelShell>

<style>
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}

	.row {
		display: grid;
		grid-template-columns: 2.25rem 1fr auto auto;
		align-items: center;
		gap: var(--ab-space-sm);
		padding: 0.1875rem var(--ab-space-xs);
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-sm);
	}

	.row.empty {
		grid-template-columns: 2.25rem 1fr;
		color: var(--ab-color-fg-faint);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family: var(--ab-font-family-mono);
		font-size: 0.6875rem;
		font-weight: var(--ab-font-weight-semibold);
		letter-spacing: 0.04em;
		padding: 0.0625rem 0.3125rem;
		border-radius: var(--ab-radius-sm);
		border: 1px solid var(--ab-color-border-strong);
		color: var(--ab-color-fg-muted);
		background: var(--ab-color-surface);
	}

	.row.empty .chip {
		color: var(--ab-color-fg-faint);
		border-color: var(--ab-color-border);
	}

	.bar {
		display: flex;
		height: 0.4375rem;
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		overflow: hidden;
		min-width: 0;
	}

	.bar-mastered {
		background: var(--ab-color-success);
	}

	.bar-in-progress {
		background: var(--ab-color-primary-subtle-border);
	}

	.counts {
		font-family: var(--ab-font-family-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-muted);
		display: inline-flex;
		gap: 0.125rem;
	}

	.count-mastered {
		color: var(--ab-color-fg);
		font-weight: var(--ab-font-weight-semibold);
	}

	.count-sep {
		color: var(--ab-color-fg-faint);
	}

	.count-total {
		color: var(--ab-color-fg-muted);
	}

	.pct {
		font-family: var(--ab-font-family-mono);
		font-variant-numeric: tabular-nums;
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-muted);
		min-width: 2.75rem;
		text-align: right;
	}

	.hint {
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		font-style: italic;
	}
</style>
