<script lang="ts">
import type { AppearanceMode, ThemeId } from '../../contract';
import ThemeProvider from '../../ThemeProvider.svelte';

let {
	theme,
	appearance,
	layout,
	body = 'inner',
}: {
	theme?: ThemeId;
	appearance?: AppearanceMode;
	layout?: string;
	body?: string;
} = $props();
</script>

<ThemeProvider {theme} {appearance} {layout}>
	<span data-testid="harness-themeprovider-body">{body}</span>
</ThemeProvider>
