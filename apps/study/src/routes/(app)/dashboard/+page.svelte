<script lang="ts">
import ActivityPanel from './_panels/ActivityPanel.svelte';
import CalibrationPanel from './_panels/CalibrationPanel.svelte';
import CertProgressPanel from './_panels/CertProgressPanel.svelte';
import CtaPanel from './_panels/CtaPanel.svelte';
import DueReviewsPanel from './_panels/DueReviewsPanel.svelte';
import MapPanel from './_panels/MapPanel.svelte';
import ScheduledRepsPanel from './_panels/ScheduledRepsPanel.svelte';
import StudyPlanPanel from './_panels/StudyPlanPanel.svelte';
import WeakAreasPanel from './_panels/WeakAreasPanel.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const payload = $derived(data.payload);

// Updated once per page load. The status line is read-only ornament; not a
// real-time clock.
const loadedAt = new Date();
const stamp = `${loadedAt.getFullYear()}-${String(loadedAt.getMonth() + 1).padStart(2, '0')}-${String(loadedAt.getDate()).padStart(2, '0')} ${String(loadedAt.getHours()).padStart(2, '0')}:${String(loadedAt.getMinutes()).padStart(2, '0')}`;
</script>

<svelte:head>
	<title>Dashboard -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1>Learning Dashboard</h1>
		<p class="sub">Where you are. What slipped. What's next.</p>
	</header>

	<!--
		TUI-style grid: 12 cols desktop, 6 cols tablet, 1 col mobile.
		Panel order still encodes act -> orient -> correct -> reflect:
		  row 1: TODAY (act) | Reviews (act) | Reps (act)
		  row 2: Calibration (orient) | Weak areas (correct)
		  row 3: Recent activity (reflect) | Active plan (orient)
		  row 4: Cert progress (reflect) | The map (orient)
	-->
	<div class="grid">
		<div class="cell c6"><CtaPanel stats={payload.stats} repBacklog={payload.repBacklog} activePlan={payload.activePlan} /></div>
		<div class="cell c3"><DueReviewsPanel stats={payload.stats} /></div>
		<div class="cell c3"><ScheduledRepsPanel repBacklog={payload.repBacklog} /></div>

		<div class="cell c4"><CalibrationPanel calibration={payload.calibration} /></div>
		<div class="cell c8"><WeakAreasPanel weakAreas={payload.weakAreas} /></div>

		<div class="cell c7"><ActivityPanel activity={payload.activity} /></div>
		<div class="cell c5"><StudyPlanPanel activePlan={payload.activePlan} /></div>

		<div class="cell c5"><CertProgressPanel /></div>
		<div class="cell c7"><MapPanel /></div>
	</div>

	<footer class="status" aria-hidden="true">
		<span>airboss</span>
		<span class="sep">//</span>
		<span>dashboard</span>
		<span class="sep">//</span>
		<span>{stamp}</span>
	</footer>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: calc(100vh - 4rem);
	}

	.hd {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0 0.125rem;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-sm);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ab-color-fg);
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
	}

	.sub {
		margin: 0;
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 0.5rem;
		flex: 1;
	}

	.cell {
		display: flex;
		min-width: 0;
	}

	.cell :global(.panel) {
		flex: 1;
	}

	/* Desktop spans (>= 1024px default). */
	.c3 { grid-column: span 3; }
	.c4 { grid-column: span 4; }
	.c5 { grid-column: span 5; }
	.c6 { grid-column: span 6; }
	.c7 { grid-column: span 7; }
	.c8 { grid-column: span 8; }

	/* Tablet: collapse to 6 tracks, rebalance. */
	@media (max-width: 1023px) {
		.grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.c3 { grid-column: span 3; }
		.c4 { grid-column: span 3; }
		.c5 { grid-column: span 3; }
		.c6 { grid-column: span 6; }
		.c7 { grid-column: span 6; }
		.c8 { grid-column: span 6; }
	}

	/* Mobile: single-column stack. */
	@media (max-width: 639px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.c3, .c4, .c5, .c6, .c7, .c8 {
			grid-column: span 1;
		}
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.125rem 0;
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
		letter-spacing: 0.04em;
	}

	.status .sep {
		color: var(--ab-color-border-strong);
	}
</style>
