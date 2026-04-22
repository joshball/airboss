<script lang="ts">
import PanelShell from '@ab/ui/components/PanelShell.svelte';

/**
 * Cert-progress placeholder. The Knowledge Graph BC does not yet export
 * getCertProgress(userId); once it does, this panel renders one progress
 * bar per cert on the active plan with "N of M nodes mastered" readouts.
 * Tracked as a follow-up BC task in the activation PR.
 */
</script>

<PanelShell
	title="Cert progress"
	subtitle="PPL / IR / CPL / CFI mastery bars"
	variant="gated"
>
	<p class="placeholder">
		Requires <code>getCertProgress(userId)</code> in the knowledge BC (not yet
		implemented). When the function lands, each cert on the active plan gets
		one bar: nodes mastered over nodes tagged for that cert.
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
		background: var(--ab-color-accent-subtle);
		color: var(--ab-color-accent-fg);
		padding: 0.125rem 0.3125rem;
		border-radius: var(--ab-radius-sm);
		font-size: var(--ab-font-size-xs);
	}
</style>
