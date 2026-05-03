<script lang="ts">
import RenderedSection from '@ab/library/RenderedSection.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<RenderedSection title={data.title} id={data.uri} body={data.body} />
