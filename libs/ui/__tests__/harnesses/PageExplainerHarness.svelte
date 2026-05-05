<script lang="ts">
import PageExplainer from '../../src/components/PageExplainer.svelte';

let {
	pageKey,
	title,
	body = 'Default body.',
	dismissed = false,
	globallyHidden = false,
}: {
	pageKey: string;
	title?: string;
	body?: string;
	dismissed?: boolean;
	globallyHidden?: boolean;
} = $props();
</script>

<PageExplainer {pageKey} {title} {dismissed} {globallyHidden}>
	<span data-testid="page-explainer-harness-body">{body}</span>
</PageExplainer>
