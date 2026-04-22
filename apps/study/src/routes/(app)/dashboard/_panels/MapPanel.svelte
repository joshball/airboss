<script lang="ts">
import PanelShell from './PanelShell.svelte';

/**
 * Domain x Cert map placeholder. Requires getDomainCertMatrix(userId) on
 * the knowledge BC, which is not yet implemented. Once it lands, the panel
 * renders a 14 x 4 grid (14 domains, 4 certs) with per-cell mastery
 * percentages. Tracked as a follow-up BC task in the activation PR.
 */
</script>

<PanelShell
	title="The map"
	subtitle="Domain x cert mastery grid"
	variant="gated"
>
	<p class="placeholder">
		Requires <code>getDomainCertMatrix(userId)</code> in the knowledge BC (not
		yet implemented). Each cell will show percent mastery for that (domain,
		cert) pair or <code>-</code> when no nodes apply.
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
