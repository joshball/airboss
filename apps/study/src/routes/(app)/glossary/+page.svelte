<script lang="ts">
import ReferencePage from '@ab/aviation/ui/ReferencePage.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Glossary -- airboss</title>
</svelte:head>

<ReferencePage
	references={data.references}
	hits={data.hits}
	counts={data.counts}
	initialSearch={data.searchText}
/>
