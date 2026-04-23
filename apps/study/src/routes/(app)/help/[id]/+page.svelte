<script lang="ts">
import HelpLayout from '@ab/help/ui/HelpLayout.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.page.title} -- Help -- airboss</title>
</svelte:head>

<HelpLayout page={data.page} sectionNodes={data.sectionNodes} />
