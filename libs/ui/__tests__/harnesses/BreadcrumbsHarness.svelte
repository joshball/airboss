<script lang="ts">
import Breadcrumbs, { type BreadcrumbItem } from '../../src/components/Breadcrumbs.svelte';

let {
	items,
	ariaLabel,
}: {
	items: readonly BreadcrumbItem[];
	ariaLabel?: string;
} = $props();
</script>

<Breadcrumbs {items} {ariaLabel} />
