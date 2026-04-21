<script lang="ts">
import { ROUTES } from '@ab/constants';
import PanelShell from './PanelShell.svelte';

/**
 * Calibration summary placeholder.
 *
 * The Calibration Tracker BC (`libs/bc/study/src/calibration.ts`) is being
 * authored in parallel; this panel ships as a gated placeholder until
 * `getCalibration(userId)` is available. When the BC lands, the panel swaps
 * to a one-line summary (`score + biggest miscalibration gap`) with the
 * spec's default direction (absolute largest gap, labeled overconfident or
 * underconfident).
 *
 * Rendered as a gated panel per the "honest emptiness" design principle --
 * the roadmap is visible, not hidden.
 */
</script>

<PanelShell
	title="Calibration"
	subtitle="Your score + biggest miscalibration gap"
	variant="gated"
>
	{#snippet action()}
		<a class="action-btn" href={ROUTES.CALIBRATION}>View calibration</a>
	{/snippet}

	<p class="placeholder">
		Populated once the Calibration Tracker BC lands. The full calibration page
		at <a href={ROUTES.CALIBRATION}>/calibration</a> already renders per-domain
		gaps.
	</p>
</PanelShell>

<style>
	.placeholder {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.placeholder a {
		color: #1d4ed8;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: white;
		color: #475569;
		text-decoration: none;
	}

	.action-btn:hover {
		background: #f1f5f9;
	}
</style>
