<script lang="ts">
import { MIN_PASSWORD_LENGTH, ROLE_LABELS, type Role } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import Button from '@ab/ui/components/Button.svelte';
import type { PageData } from './$types';

type AcceptActionResult = { error: string } | null | undefined;

let { data, form }: { data: PageData; form: AcceptActionResult } = $props();

let password = $state('');
let confirmPassword = $state('');

const passwordsMatch = $derived(password === confirmPassword);
const passwordLongEnough = $derived(password.length >= MIN_PASSWORD_LENGTH);
const submitDisabled = $derived(!passwordsMatch || !passwordLongEnough);

function expiryRelative(iso: string): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return 'expires soon';
	const days = Math.round(ms / (24 * 60 * 60 * 1000));
	if (days <= 1) return 'expires in less than a day';
	return `expires in ${days} days`;
}
</script>

<svelte:head>
	<title>Accept invite -- airboss</title>
</svelte:head>

<ThemeProvider theme="study/sectional">
<main class="page">
	<div class="card">
		<header class="hd">
			<p class="brand">airboss</p>
			<div class="title-row">
				<h1>You've been invited.</h1>
				<PageHelp pageId="invite-accept" />
			</div>
		</header>

		{#if data.signedInAs && data.signedInAs.email !== data.invitation.email}
			<div class="alert warn" role="alert">
				You are signed in as <strong>{data.signedInAs.email}</strong>. Accepting this invite will sign you out and create a new account for <strong>{data.invitation.email}</strong>.
			</div>
		{/if}

		<dl class="meta">
			<div>
				<dt>Email</dt>
				<dd class="mono">{data.invitation.email}</dd>
			</div>
			<div>
				<dt>Role</dt>
				<dd>{ROLE_LABELS[data.invitation.proposedRole as Role]}</dd>
			</div>
			{#if data.inviterName}
				<div>
					<dt>Invited by</dt>
					<dd>{data.inviterName}</dd>
				</div>
			{/if}
		</dl>

		{#if form && 'error' in form}
			<div class="alert error" role="alert">{form.error}</div>
		{/if}

		<form method="post" action="?/accept" class="accept-form">
			<label class="field">
				<span>Choose a password</span>
				<input
					type="password"
					name="password"
					bind:value={password}
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
				<small class:hint-error={!passwordLongEnough && password.length > 0}>
					At least {MIN_PASSWORD_LENGTH} characters.
				</small>
			</label>

			<label class="field">
				<span>Confirm password</span>
				<input
					type="password"
					bind:value={confirmPassword}
					autocomplete="new-password"
					minlength={MIN_PASSWORD_LENGTH}
					required
				/>
				<small class:hint-error={!passwordsMatch && confirmPassword.length > 0}>
					{passwordsMatch || confirmPassword.length === 0 ? 'Re-type to confirm.' : 'Passwords do not match.'}
				</small>
			</label>

			<div class="actions">
				<Button type="submit" variant="primary" disabled={submitDisabled}>Accept invite</Button>
			</div>
		</form>

		<p class="footer-note">This invitation {expiryRelative(data.invitation.expiresAt)}.</p>
	</div>
</main>
</ThemeProvider>

<style>
	.page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: var(--space-xl);
		background: var(--surface-muted);
	}

	.card {
		width: 100%;
		max-width: 28rem;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-2xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		box-shadow: var(--shadow-sm, none);
	}

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.brand {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		color: var(--ink-body);
	}

	.alert {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
	}

	.alert.error {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
		border: 1px solid var(--signal-warning);
	}

	.alert.warn {
		background: var(--signal-warning-wash);
		color: var(--signal-warning);
		border: 1px solid var(--signal-warning);
	}

	.meta {
		margin: 0;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-muted);
		border-radius: var(--radius-sm);
	}

	.meta div {
		display: grid;
		grid-template-columns: 6rem 1fr;
		gap: var(--space-md);
		align-items: baseline;
	}

	.meta dt {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.meta dd {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.mono {
		font-family: var(--font-family-mono);
	}

	.accept-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.field span {
		font-size: var(--type-ui-label-size);
		font-weight: var(--font-weight-medium);
		color: var(--ink-body);
	}

	.field input {
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--input-default-border);
		border-radius: var(--radius-sm);
		background: var(--input-default-bg);
		color: var(--ink-body);
		font: inherit;
	}

	.field input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--input-default-hover-border);
	}

	.field small {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.field small.hint-error {
		color: var(--signal-warning);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}

	.footer-note {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		text-align: center;
	}
</style>
