<script lang="ts">
import PanelShell from './PanelShell.svelte';

/**
 * Cert-progress placeholder. Swaps to real cert bars once the Knowledge
 * Graph work package's `getCertProgress(userId)` is available and the Study
 * Plan work package supplies the cert filter.
 */
</script>

<PanelShell
	title="Cert progress"
	subtitle="PPL / IR / CPL / CFI mastery bars"
	variant="gated"
>
	<p class="placeholder">
		Unlocks when the <strong>knowledge graph</strong> lands. The dashboard will
		then render one progress bar per cert on your study plan, sourced from
		<code>getCertProgress(userId)</code>.
	</p>
</PanelShell>

<style>
	.placeholder {
		margin: 0;
		color: #64748b;
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.placeholder code {
		background: #eef2ff;
		color: #3730a3;
		padding: 0.125rem 0.3125rem;
		border-radius: 2px;
		font-size: 0.6875rem;
	}
</style>
