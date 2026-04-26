<script lang="ts">
import Banner, { type BannerTone } from '../../src/components/Banner.svelte';

let {
	tone = 'info',
	title,
	dismissible = false,
	onDismiss,
	body = 'body',
}: {
	tone?: BannerTone;
	title?: string;
	dismissible?: boolean;
	onDismiss?: () => void;
	body?: string;
} = $props();
</script>

<Banner {tone} {title} {dismissible} {onDismiss}>
	<span data-testid="harness-banner-body">{body}</span>
</Banner>
