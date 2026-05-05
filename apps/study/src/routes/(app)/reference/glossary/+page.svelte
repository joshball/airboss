<script lang="ts">
import ReferencePage from '@ab/aviation/ui/ReferencePage.svelte';
import { PAGE_EXPLAINER_KEYS } from '@ab/constants';
import PageExplainer from '@ab/ui/components/PageExplainer.svelte';
import Tooltip from '@ab/ui/components/Tooltip.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Glossary -- airboss</title>
</svelte:head>

<div class="glossary-shell">
	<PageExplainer pageKey={PAGE_EXPLAINER_KEYS.REFERENCE_GLOSSARY}>
		Every term used across the platform, defined in one place. The right-cluster
		<Tooltip for="glossary-drawer">glossary drawer</Tooltip>
		opens this same content as an overlay on any page; this canonical home is searchable end-to-end.
	</PageExplainer>

	<ReferencePage
		references={data.references}
		hits={data.hits}
		counts={data.counts}
		initialSearch={data.searchText}
	/>
</div>

<style>
	.glossary-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
</style>
