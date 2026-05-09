<script lang="ts">
import type { LensLeaf } from '@ab/bc-study';

interface Props {
	/** The step's lens leaf (or null when overlay disabled / step not in lens output). */
	leaf: LensLeaf | null;
}

let { leaf }: Props = $props();

const certCode = $derived(leaf?.sources?.inCert ? leaf.sources.certCode : undefined);
</script>

{#if certCode}
	<aside class="chip-strip" aria-label="Cert leaves satisfied by this step">
		<span class="chip-label">Cert overlay</span>
		<span class="cert-chip">{certCode}</span>
	</aside>
{/if}

<style>
	.chip-strip {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
	}

	.chip-label {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.cert-chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		background: var(--surface-raised);
		color: var(--action-default-hover);
		border: 1px solid var(--action-default-edge);
		font-family: var(--font-family-mono);
	}
</style>
