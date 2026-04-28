<script lang="ts">
import { CREDENTIAL_KIND_LABELS, type CredentialKind, NAV_LABELS, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const credential = $derived(data.credential);
const primarySyllabus = $derived(data.primarySyllabus);
const pinnedSyllabus = $derived(data.pinnedSyllabus);
const effectiveSyllabus = $derived(pinnedSyllabus ?? primarySyllabus);
const mastery = $derived(data.mastery);
const areas = $derived(data.areas);
const prereqs = $derived(data.prereqs);
const supplemental = $derived(data.supplemental);

const requiredPrereqs = $derived(prereqs.filter((p) => p.kind === 'required'));
const recommendedPrereqs = $derived(prereqs.filter((p) => p.kind === 'recommended'));

let supplementalOpen = $state(false);

function kindLabel(slug: string): string {
	return CREDENTIAL_KIND_LABELS[slug as CredentialKind] ?? slug;
}

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	return Math.round((num / den) * 100);
}
</script>

<svelte:head>
	<title>{credential.title} -- airboss</title>
</svelte:head>

<section class="page">
	<nav class="crumb" aria-label="Breadcrumb">
		<a href={ROUTES.CREDENTIALS}>{NAV_LABELS.CREDENTIALS}</a>
		<span aria-hidden="true">/</span>
		<span>{credential.title}</span>
	</nav>

	<PageHeader
		eyebrow={kindLabel(credential.kind)}
		title={credential.title}
		subtitle={[credential.category, credential.class].filter(Boolean).join(' / ')}
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="credentials" />
		{/snippet}
	</PageHeader>

	{#if pinnedSyllabus !== null}
		<aside class="banner pinned" role="status">
			<p>
				<strong>Pinned to edition:</strong>
				{pinnedSyllabus.title} <span class="muted">({pinnedSyllabus.slug})</span>
			</p>
			<a class="banner-cta" href={ROUTES.CREDENTIAL(credential.slug)}>Switch to current</a>
		</aside>
	{/if}

	{#if primarySyllabus === null && pinnedSyllabus === null}
		<EmptyState
			title="Syllabus not yet authored"
			body="A primary syllabus has not been transcribed for this credential yet. ACS / PTS / endorsement transcription is iterative human content work per ADR 016 phase 10. Mastery rollups will populate once at least one leaf is linked."
		/>
	{:else}
		<section class="rollup" aria-labelledby="rollup-heading">
			<h2 id="rollup-heading" class="sr-only">Mastery rollup</h2>
			<dl class="stat-grid">
				<div class="stat">
					<dt>Mastery</dt>
					<dd data-testid="detail-mastery">
						{pct(mastery.masteredLeaves, mastery.totalLeaves)}%
						<span class="frac">{mastery.masteredLeaves} / {mastery.totalLeaves}</span>
					</dd>
				</div>
				<div class="stat">
					<dt>Coverage</dt>
					<dd data-testid="detail-coverage">
						{pct(mastery.coveredLeaves, mastery.totalLeaves)}%
						<span class="frac">{mastery.coveredLeaves} / {mastery.totalLeaves}</span>
					</dd>
				</div>
				<div class="stat">
					<dt>Total leaves</dt>
					<dd>{mastery.totalLeaves}</dd>
				</div>
			</dl>
		</section>

		{#if areas.length > 0}
			<section class="areas" aria-labelledby="areas-heading">
				<h2 id="areas-heading">Areas of operation</h2>
				<ul class="area-list">
					{#each areas as area (area.areaCode)}
						<li class="area">
							<a class="area-link" href={ROUTES.CREDENTIAL_AREA(credential.slug, area.areaCode)}>
								<header class="area-header">
									<span class="area-code">{area.areaCode}</span>
									<h3 class="area-title">{area.areaTitle}</h3>
								</header>
								<dl class="area-stats">
									<div>
										<dt>Mastery</dt>
										<dd>{pct(area.masteredLeaves, area.totalLeaves)}%</dd>
									</div>
									<div>
										<dt>Coverage</dt>
										<dd>{pct(area.coveredLeaves, area.totalLeaves)}%</dd>
									</div>
									<div>
										<dt>Leaves</dt>
										<dd>{area.totalLeaves}</dd>
									</div>
								</dl>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<EmptyState
				title="No areas yet"
				body="The primary syllabus exists but has no Areas of Operation transcribed. Authoring is iterative."
			/>
		{/if}
	{/if}

	{#if requiredPrereqs.length > 0 || recommendedPrereqs.length > 0}
		<section class="prereqs" aria-labelledby="prereqs-heading">
			<h2 id="prereqs-heading">Prerequisites</h2>
			{#if requiredPrereqs.length > 0}
				<div class="prereq-group">
					<h3>Required</h3>
					<ul>
						{#each requiredPrereqs as p (p.credential.id)}
							<li><a href={ROUTES.CREDENTIAL(p.credential.slug)}>{p.credential.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
			{#if recommendedPrereqs.length > 0}
				<div class="prereq-group">
					<h3>Recommended</h3>
					<ul>
						{#each recommendedPrereqs as p (p.credential.id)}
							<li><a href={ROUTES.CREDENTIAL(p.credential.slug)}>{p.credential.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	{/if}

	{#if supplemental.length > 0}
		<details class="supp" bind:open={supplementalOpen}>
			<summary>Supplemental syllabi ({supplemental.length})</summary>
			<ul class="supp-list">
				{#each supplemental as s (s.syllabus.id)}
					<li>
						<strong>{s.syllabus.title}</strong>
						<span class="muted">({s.syllabus.kind} / {s.syllabus.status})</span>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.crumb {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.crumb a {
		color: var(--ink-subtle);
	}

	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-left: 4px solid var(--edge-strong);
		border-radius: var(--radius-md);
		flex-wrap: wrap;
	}

	.banner.pinned {
		border-left-color: var(--signal-warning-edge, var(--edge-strong));
	}

	.banner p {
		margin: 0;
	}

	.banner-cta {
		font-weight: var(--font-weight-semibold);
		color: var(--action-link);
		text-decoration: underline;
	}

	.muted {
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.rollup {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
	}

	.stat-grid {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: var(--space-lg);
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.stat dt {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.stat dd {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		color: var(--ink-body);
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.frac {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-regular);
		color: var(--ink-faint);
	}

	.areas h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.area-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.area {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.area:hover {
		border-color: var(--edge-strong);
	}

	.area-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		color: inherit;
		text-decoration: none;
	}

	.area-header {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.area-code {
		color: var(--ink-faint);
		font-family: var(--font-family-mono, monospace);
		font-size: var(--font-size-sm);
	}

	.area-title {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.area-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
		margin: 0;
	}

	.area-stats dt {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.area-stats dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}

	.prereqs {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.prereqs h2,
	.prereq-group h3 {
		margin: 0;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}

	.prereq-group h3 {
		font-size: var(--font-size-sm);
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.prereq-group ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.prereq-group li {
		padding: var(--space-2xs) var(--space-sm);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
	}

	.prereq-group a {
		color: var(--action-link);
		text-decoration: none;
	}

	.supp {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.supp summary {
		cursor: pointer;
		color: var(--action-link);
		font-weight: var(--font-weight-semibold);
	}

	.supp-list {
		list-style: none;
		margin: var(--space-md) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
</style>
