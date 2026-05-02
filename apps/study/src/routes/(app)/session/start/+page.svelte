<script lang="ts">
import { type Preset, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import PresetGalleryPanel from './_panels/PresetGalleryPanel.svelte';
import PreviewControlsPanel from './_panels/PreviewControlsPanel.svelte';
import PreviewItemsPanel from './_panels/PreviewItemsPanel.svelte';
import StartFormPanel from './_panels/StartFormPanel.svelte';
import type { ActionData, PageData } from './$types';
import SessionLegend from './SessionLegend.svelte';

let { data, form }: { data: PageData; form: ActionData } = $props();

const preview = $derived(data.needsPlan ? null : data.preview);
const presets: readonly Preset[] = $derived(data.needsPlan ? data.presets : []);
const presetError = $derived(typeof form?.error === 'string' ? form.error : null);
</script>

<svelte:head>
	<title>Start session -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Start a session"
		subtitle={preview
			? `${preview.items.length} items queued. Review the plan, then start.`
			: data.needsPlan
				? "Pick a plan to get started -- you'll be in a scenario in one click."
				: undefined}
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="session-start" />
		{/snippet}
		{#snippet actions()}
			<Button variant="ghost" href={ROUTES.DASHBOARD}>Cancel</Button>
		{/snippet}
	</PageHeader>

	{#if data.needsPlan}
		{#if presetError}
			<Banner tone="danger" title="Couldn't start the session">{presetError}</Banner>
		{/if}

		<PresetGalleryPanel {presets} />
	{:else if preview}
		<PreviewControlsPanel
			mode={preview.mode}
			sessionLength={preview.sessionLength}
			planId={preview.plan.id}
			planTitle={preview.plan.title}
			focus={preview.focus ?? undefined}
			cert={preview.cert ?? undefined}
			short={preview.short}
			itemCount={preview.items.length}
		/>

		{#if preview.items.length === 0}
			<EmptyState
				title="Nothing to study yet"
				body="Add cards or scenarios first, or wait for the knowledge graph to populate."
			>
				{#snippet actions()}
					<Button variant="secondary" href={ROUTES.MEMORY_NEW}>New card</Button>
					<Button variant="secondary" href={ROUTES.REPS_NEW}>New scenario</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<SessionLegend />

			<PreviewItemsPanel items={preview.items} />

			<StartFormPanel mode={preview.mode} focus={preview.focus} cert={preview.cert} seed={preview.seed} />
		{/if}
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}
</style>
