<script lang="ts">
import PanelShell from './PanelShell.svelte';

/**
 * Domain x Cert map placeholder. Shows the 14 domains (rows) by 4 certs
 * (columns) with mastery percentages once the graph BC's
 * `getDomainCertMatrix(userId)` is available.
 */
</script>

<PanelShell
	title="The map"
	subtitle="Domain x cert mastery grid"
	variant="gated"
>
	<p class="placeholder">
		Populated when the <strong>knowledge graph</strong> BC exposes
		<code>getDomainCertMatrix(userId)</code>. Each cell will show percent
		mastery for that (domain, cert) pair or <code>-</code> when no graph nodes
		apply.
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
