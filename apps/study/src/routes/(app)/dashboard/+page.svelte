<script lang="ts">
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
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

// Decorative timestamp in the page footer. Tick once per minute on the
// client so a long-lived tab doesn't keep showing yesterday's stamp; the
// footer is `aria-hidden="true"` so SR users aren't affected either way.
let now = $state(new Date());
$effect(() => {
	if (typeof window === 'undefined') return;
	const interval = window.setInterval(() => {
		now = new Date();
	}, 60_000);
	return () => window.clearInterval(interval);
});
const stamp = $derived(
	`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
);
</script>

<svelte:head>
	<title>Dashboard -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		eyebrow="Study // dashboard"
		title="Dashboard"
		subtitle="Where you are. What slipped. What&apos;s next."
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="dashboard" />
		{/snippet}
	</PageHeader>

	<div class="grid">
		<div class="col left">
			<div class="slot hero"><CtaPanel stats={payload.stats} repBacklog={payload.repBacklog} activePlan={payload.activePlan} /></div>
			<div class="slot activity"><ActivityPanel activity={payload.activity} /></div>
			<div class="slot reviews"><DueReviewsPanel stats={payload.stats} /></div>
		</div>

		<div class="col center">
			<div class="slot weak"><WeakAreasPanel weakAreas={payload.weakAreas} /></div>
			<div class="slot plan"><StudyPlanPanel activePlan={payload.activePlan} /></div>
			<div class="pair">
				<div class="slot reps"><ScheduledRepsPanel repBacklog={payload.repBacklog} /></div>
				<div class="slot calibration"><CalibrationPanel calibration={payload.calibration} /></div>
			</div>
		</div>

		<div class="col rail">
			<div class="slot cert"><CertProgressPanel certProgress={payload.certProgress} /></div>
			<div class="slot map"><MapPanel domainCertMatrix={payload.domainCertMatrix} /></div>
		</div>
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
		flex: 1 1 auto;
		gap: var(--space-md);
		min-height: 0;
		overflow: hidden;
	}

	.grid {
		display: grid;
		flex: 1 1 auto;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		grid-template-rows: 12rem 10rem 11rem;
		gap: calc(var(--space-xl) + var(--space-2xs));
		align-content: start;
		min-height: 0;
	}

	.slot {
		display: flex;
		box-sizing: border-box;
		min-width: 0;
		min-height: 0;
	}

	.left,
	.center,
	.rail,
	.pair {
		display: contents;
	}

	.hero {
		grid-column: 1 / span 5;
		grid-row: 1;
	}

	.weak {
		grid-column: 6 / span 4;
		grid-row: 1;
	}

	.cert {
		grid-column: 10 / span 3;
		grid-row: 1;
	}

	.activity {
		grid-column: 1 / span 5;
		grid-row: 2;
	}

	.plan {
		grid-column: 6 / span 4;
		grid-row: 2;
	}

	.map {
		grid-column: 10 / span 3;
		grid-row: 2 / span 2;
	}

	.reviews {
		grid-column: 1 / span 5;
		grid-row: 3;
	}

	.reps {
		grid-column: 6 / span 2;
		grid-row: 3;
	}

	.calibration {
		grid-column: 8 / span 2;
		grid-row: 3;
	}

	.slot :global(.panel) {
		flex: 1 1 auto;
		min-height: 0;
	}

	.status {
		display: flex;
		flex: 0 0 auto;
		align-items: center;
		gap: var(--space-xs);
		padding: 0 var(--space-2xs);
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-wide);
	}

	.status .sep {
		color: var(--edge-strong);
	}

	@media (max-width: 1200px) {
		.page {
			overflow: auto;
		}

		.grid {
			grid-template-columns: repeat(6, minmax(0, 1fr));
			grid-template-rows: auto;
		}

		.hero {
			grid-column: 1 / span 4;
			grid-row: 1;
		}

		.reviews {
			grid-column: 5 / span 2;
			grid-row: 1;
		}

		.weak {
			grid-column: 1 / span 4;
			grid-row: 2;
		}

		.cert {
			grid-column: 5 / span 2;
			grid-row: 2;
		}

		.activity {
			grid-column: 1 / span 4;
			grid-row: 3;
		}

		.plan {
			grid-column: 5 / span 2;
			grid-row: 3;
		}

		.reps {
			grid-column: 1 / span 3;
			grid-row: 4;
		}

		.calibration {
			grid-column: 4 / span 3;
			grid-row: 4;
		}

		.map {
			grid-column: 1 / -1;
			grid-row: 5;
		}
	}

	@media (max-width: 900px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto;
			gap: var(--space-lg);
		}

		.hero,
		.weak,
		.cert,
		.activity,
		.plan,
		.map,
		.reviews,
		.reps,
		.calibration {
			grid-column: 1;
			grid-row: auto;
		}
	}
</style>
