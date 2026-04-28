<script lang="ts">
import Pfd from '$lib/pfd/Pfd.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>airboss avionics -- PFD</title>
</svelte:head>

<main>
	<Pfd selectedAircraftId={data.selectedAircraftId} />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: calc(100vh - 4rem);
	}
</style>
