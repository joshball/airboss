<script lang="ts">
import HelpCard from '../../src/ui/HelpCard.svelte';

let {
	title,
	variant = 'tip',
	body = 'card body',
}: { title?: string; variant?: 'tip' | 'warn' | 'danger' | 'howto' | 'note' | 'example'; body?: string } = $props();
</script>

<HelpCard {title} {variant}>
	<span data-testid="harness-helpcard-body">{body}</span>
</HelpCard>
