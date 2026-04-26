<script lang="ts">
import FormStack from '../../src/components/FormStack.svelte';

let {
	as = 'div',
	gap = 'md',
	method,
	action,
	ariaLabel,
	body = 'children',
}: {
	as?: 'form' | 'div';
	gap?: 'sm' | 'md' | 'lg';
	method?: 'GET' | 'POST';
	action?: string;
	ariaLabel?: string;
	body?: string;
} = $props();
</script>

<FormStack {as} {gap} {method} {action} {ariaLabel}>
	<span data-testid="harness-formstack-body">{body}</span>
</FormStack>
