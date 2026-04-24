<script lang="ts">
import '@ab/themes/generated/tokens.css';
import {
	type AppearanceMode,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_APPEARANCE_PREFERENCE,
} from '@ab/themes';
import type { Snippet } from 'svelte';
import type { LayoutData } from './$types';

let { data, children }: { data: LayoutData; children: Snippet } = $props();

// Reflect the effective appearance on <html> so the pre-hydration script's
// choice survives SvelteKit re-rendering. Child routes (including login)
// inherit the token palette from this attribute.
let appearancePref = $state<AppearancePreference>(DEFAULT_APPEARANCE_PREFERENCE);
let systemAppearance = $state<AppearanceMode>(DEFAULT_APPEARANCE);

$effect(() => {
	appearancePref = data.appearance;
});

$effect(() => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
	const mq = window.matchMedia('(prefers-color-scheme: dark)');
	systemAppearance = mq.matches ? 'dark' : 'light';
	const handler = (e: MediaQueryListEvent) => {
		systemAppearance = e.matches ? 'dark' : 'light';
	};
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
});

$effect(() => {
	if (typeof document === 'undefined') return;
	const effective: AppearanceMode = appearancePref === 'system' ? systemAppearance : appearancePref;
	document.documentElement.setAttribute('data-appearance', effective);
});
</script>

{@render children()}
