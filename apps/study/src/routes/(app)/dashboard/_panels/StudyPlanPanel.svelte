<script lang="ts">
import PanelShell from './PanelShell.svelte';

/**
 * Active-study-plan placeholder. When the Study Plan + Session Engine work
 * package lands, this renders a one-line summary of the active plan (cert
 * goals, focus domains, session length) with an edit link. The CTA at the
 * top of the dashboard also routes through the session engine once a plan
 * exists.
 */
</script>

<PanelShell
	title="Active study plan"
	subtitle="Cert goals + focus domains"
	variant="gated"
>
	<p class="placeholder">
		Unlocks when the <strong>study plan + session engine</strong> work package
		lands. Dashboard will read the active plan via <code>getActivePlan(userId)</code>
		and the "Start my session" CTA will route through the session engine.
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
