<script lang="ts">
import '@ab/themes/generated/tokens.css';
import NavIndicator from '@ab/ui/components/NavIndicator.svelte';
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';
import { postClientErrorReport, shouldSkipDuplicate } from '$lib/client-error-reporter';

let { children }: { children: Snippet } = $props();

// Install global error reporters so browser-only failures (hydration
// crashes, async exceptions, unhandled rejections) reach the same server
// log stream as HTTP errors. Without this, a `ReferenceError` like the
// `Buffer is not defined` regression that landed via study-app-ia-cleanup
// Phase 4 produces a 200 in the access log and zero error signal -- the
// user has to notice in the browser devtools and report it by hand.
//
// SvelteKit's `handleError` hook (`hooks.client.ts`) catches errors thrown
// inside the load lifecycle (load functions, hydration, action returns).
// `window.onerror` / `unhandledrejection` catch everything outside that
// lifecycle (stray `setTimeout` callbacks, promise rejections without
// `await`, third-party widgets). Both pipelines POST to the same endpoint
// and share `shouldSkipDuplicate` so a hydration crash that fires in both
// paths produces a single server-side report.
onMount(() => {
	if (typeof window === 'undefined') return;

	function onError(event: ErrorEvent): void {
		const message = event.message || 'unknown error';
		const stack = event.error instanceof Error ? event.error.stack : undefined;
		if (shouldSkipDuplicate(message, stack)) return;
		void postClientErrorReport({
			kind: 'error',
			message,
			source: event.filename || undefined,
			stack,
			url: window.location.href,
			userAgent: navigator.userAgent,
		});
	}

	function onRejection(event: PromiseRejectionEvent): void {
		const reason = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason ?? 'unknown rejection');
		const stack = reason instanceof Error ? reason.stack : undefined;
		if (shouldSkipDuplicate(message, stack)) return;
		void postClientErrorReport({
			kind: 'unhandledrejection',
			message,
			stack,
			url: window.location.href,
			userAgent: navigator.userAgent,
		});
	}

	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onRejection);
	return () => {
		window.removeEventListener('error', onError);
		window.removeEventListener('unhandledrejection', onRejection);
	};
});
</script>

<NavIndicator />
{@render children()}
