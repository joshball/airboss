<script lang="ts">
import PanelShell from '@ab/ui/components/PanelShell.svelte';

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
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-xs);
		line-height: var(--ab-line-height-normal);
	}

	.placeholder code {
		/* indigo accent: no token match. Follow-up: add --ab-color-accent-* */
		background: #eef2ff;
		color: #3730a3;
		padding: 0.125rem 0.3125rem;
		border-radius: var(--ab-radius-sm);
		font-size: 0.6875rem;
	}
</style>
