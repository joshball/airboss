<script lang="ts">
import { DEV_ACCOUNTS, DEV_PASSWORD } from '@ab/constants';
import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
import Banner from '@ab/ui/components/Banner.svelte';
import Button from '@ab/ui/components/Button.svelte';
import TextField from '@ab/ui/components/TextField.svelte';
import { dev } from '$app/environment';
import { enhance } from '$app/forms';
import type { ActionData } from './$types';

let { form }: { form: ActionData } = $props();
let loading = $state(false);
// svelte-ignore state_referenced_locally -- initial-value only
let email = $state<string>(form?.email ?? '');
let password = $state('');

function fillDevAccount(accountEmail: string) {
	email = accountEmail;
	password = DEV_PASSWORD;
}
</script>

<svelte:head>
	<title>Sign in - airboss hangar</title>
</svelte:head>

<ThemeProvider theme="airboss/default">
	<main class="page">
		<section class="card" aria-labelledby="login-heading">
			<div class="hd">
				<h1 id="login-heading">Sign in to airboss hangar</h1>
				<p class="sub" aria-hidden="true">airboss hangar</p>
			</div>

			{#if form?.error}
				<Banner tone="danger">{form.error}</Banner>
			{/if}

			<!--
				aria-live region announces submit-in-flight to AT users -- the Button's
				text swap is not consistently re-announced by NVDA/VoiceOver.
			-->
			<span class="sr-only" aria-live="polite">{loading ? 'Signing in...' : ''}</span>

			<form
				method="POST"
				class="form"
				use:enhance={() => {
					loading = true;
					return async ({ update, result }) => {
						loading = false;
						await update();
						if (result.type === 'failure') {
							// Move focus to the password field on failed submit so keyboard
							// users get a clear signal something changed and can correct.
							document.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
						}
					};
				}}
			>
				<TextField
					name="email"
					label="Email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					disabled={loading}
					placeholder="you@example.com"
					invalid={!!form?.error}
				/>
				<TextField
					name="password"
					label="Password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
					disabled={loading}
					invalid={!!form?.error}
				/>
				<Button
					type="submit"
					variant="primary"
					size="md"
					fullWidth
					loading={loading}
					loadingLabel="Signing in..."
				>
					Sign in
				</Button>
			</form>

			{#if dev}
				<section class="dev">
					<p class="dev-label">Dev accounts</p>
					<div class="dev-accounts">
						{#each DEV_ACCOUNTS as account (account.email)}
							<button
								type="button"
								class="dev-btn"
								aria-label="Pre-fill login form as {account.name} ({account.role})"
								onclick={() => fillDevAccount(account.email)}
								disabled={loading}
							>
								<span class="dev-name">{account.name}</span>
								<span class="dev-role">{account.role}</span>
							</button>
						{/each}
					</div>
					<!--
						Dev-account buttons pre-fill the password field on click; we
						deliberately do NOT print the password to screen so the login page
						doesn't train people to expect credentials to live there. Matches
						study/login.
					-->
				</section>
			{/if}
		</section>
	</main>
</ThemeProvider>

<style>
	.page {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-2xl) var(--space-lg);
		background: var(--surface-page);
	}

	.card {
		width: 100%;
		max-width: 22rem;
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.hd {
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		font-weight: var(--type-heading-1-weight);
		letter-spacing: var(--type-heading-1-tracking);
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--type-ui-badge-tracking);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.dev {
		padding-top: var(--space-lg);
		border-top: 1px dashed var(--edge-default);
	}

	.dev-label {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--type-heading-3-weight);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--type-ui-badge-tracking);
	}

	.dev-accounts {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.dev-btn {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		font-family: inherit;
		font-size: var(--type-ui-label-size);
		cursor: pointer;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.dev-btn:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.dev-btn:focus-visible {
		/*
		 * outline:transparent preserves a visible system focus ring in forced-
		 * colors / Windows High-Contrast Mode (where box-shadow is discarded).
		 * The themed box-shadow renders on top in normal modes.
		 */
		outline: 2px solid transparent;
		outline-offset: 2px;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.dev-name {
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	.dev-role {
		color: var(--ink-subtle);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--type-ui-caption-tracking);
	}

</style>
