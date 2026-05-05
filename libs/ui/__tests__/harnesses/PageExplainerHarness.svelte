<script lang="ts">
import PageExplainer from '../../src/components/PageExplainer.svelte';

let {
	pageKey,
	title,
	body = 'Default body.',
	globallyHidden = false,
}: {
	pageKey: string;
	title?: string;
	body?: string;
	globallyHidden?: boolean;
} = $props();
</script>

<PageExplainer {pageKey} {title} {globallyHidden}>
	<span data-testid="page-explainer-harness-body">{body}</span>
</PageExplainer>
