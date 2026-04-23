<script lang="ts">
import { ROUTES } from '@ab/constants';
import Button from '@ab/ui/components/Button.svelte';
import { page } from '$app/state';

/**
 * Error boundary for the authenticated shell (`(app)/**` routes). Renders
 * inside the app layout so the top nav stays visible and the learner can
 * recover without a full reload. For anonymous / auth-adjacent errors the
 * root `+error.svelte` takes over.
 */

const STATUS_TITLES: Record<number, string> = {
	400: 'Bad request',
	401: 'Sign in required',
	403: 'Not allowed',
	404: 'Not found',
	500: 'Something went wrong',
	503: 'Service unavailable',
};

const status = $derived(page.status);
const rawMessage = $derived(page.error?.message ?? '');
const safeMessage = $derived(isUserSafeMessage(rawMessage) ? rawMessage : 'An unexpected error occurred.');
const title = $derived(STATUS_TITLES[status] ?? 'Something went wrong');

function isUserSafeMessage(msg: string): boolean {
	if (!msg || msg.trim().length === 0) return false;
	if (msg.length > 200) return false;
	if (msg.startsWith('Error:')) return false;
	if (msg.includes('\n')) return false;
	if (/\bat\s+\w+\s*\(/.test(msg)) return false;
	return true;
}
</script>

<svelte:head>
	<title>{status} -- {title} -- airboss</title>
</svelte:head>

<section class="wrap">
	<div class="card">
		<p class="status">{status}</p>
		<h1>{title}</h1>
		<p class="message">{safeMessage}</p>
		<div class="actions">
			<Button href={ROUTES.DASHBOARD} variant="primary">Back to dashboard</Button>
		</div>
	</div>
</section>

<style>
	.wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--ab-space-lg);
		min-height: 60vh;
	}

	.card {
		max-width: 32rem;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-sm);
		text-align: center;
	}

	.status {
		margin: 0;
		font-family: var(--ab-font-family-mono);
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-faint);
		letter-spacing: var(--ab-letter-spacing-caps);
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		color: var(--ab-color-fg);
	}

	.message {
		margin: 0;
		color: var(--ab-color-fg-muted);
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: var(--ab-space-sm);
		margin-top: var(--ab-space-sm);
	}
</style>
