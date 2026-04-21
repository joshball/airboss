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
</script>

<svelte:head>
	<title>Dashboard -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Learning Dashboard</h1>
			<p class="sub">Where you are. What slipped. What's next.</p>
		</div>
	</header>

	<!-- Panel order: act -> orient -> correct -> reflect. Gated panels sit at the
	     bottom as visible placeholders so the roadmap is legible. -->
	<CtaPanel stats={payload.stats} repBacklog={payload.repBacklog} />
	<DueReviewsPanel stats={payload.stats} />
	<ScheduledRepsPanel repBacklog={payload.repBacklog} />
	<CalibrationPanel />
	<WeakAreasPanel weakAreas={payload.weakAreas} />
	<ActivityPanel activity={payload.activity} />
	<CertProgressPanel />
	<MapPanel />
	<StudyPlanPanel />
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.25rem;
	}

	h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #64748b;
		font-size: 0.9375rem;
	}
</style>
