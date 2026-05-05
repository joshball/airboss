<script lang="ts">
import '@ab/themes/generated/tokens.css';
import { ROUTES } from '@ab/constants';
import NavIndicator from '@ab/ui/components/NavIndicator.svelte';
import type { Snippet } from 'svelte';
import { onMount } from 'svelte';

let { children }: { children: Snippet } = $props();

// Install global error reporters so browser-only failures (hydration
// crashes, async exceptions, unhandled rejections) reach the same server
// log stream as HTTP errors. Without this, a `ReferenceError` like the
// `Buffer is not defined` regression that landed via study-app-ia-cleanup
// Phase 4 produces a 200 in the access log and zero error signal -- the
// user has to notice in the browser devtools and report it by hand.
//
// `keepalive: true` lets the report survive a tab close after `onerror`.
// We swallow fetch failures: a failed report must not itself trigger
// another report, or we recurse on every errored page.
onMount(() => {
	if (typeof window === 'undefined') return;

	let inFlight = false;
	async function report(payload: {
		kind: 'error' | 'unhandledrejection';
		message: string;
		source?: string;
		stack?: string;
	}): Promise<void> {
		if (inFlight) return; // de-dupe bursts; the rate limiter is the second line
		inFlight = true;
		try {
			await fetch(ROUTES.API_CLIENT_ERROR, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					...payload,
					url: window.location.href,
					userAgent: navigator.userAgent,
				}),
				keepalive: true,
			});
		} catch {
			// Reporting must not itself cascade.
		} finally {
			inFlight = false;
		}
	}

	function onError(event: ErrorEvent): void {
		void report({
			kind: 'error',
			message: event.message || 'unknown error',
			source: event.filename || undefined,
			stack: event.error instanceof Error ? event.error.stack : undefined,
		});
	}

	function onRejection(event: PromiseRejectionEvent): void {
		const reason = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason ?? 'unknown rejection');
		const stack = reason instanceof Error ? reason.stack : undefined;
		void report({ kind: 'unhandledrejection', message, stack });
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
