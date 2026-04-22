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
let email = $state('');
let password = $state('');

// Sync email from server-returned form state (populated after a failed submit).
$effect(() => {
	if (form?.email) email = form.email;
});

function fillDevAccount(accountEmail: string) {
	email = accountEmail;
	password = DEV_PASSWORD;
}
</script>

<svelte:head>
	<title>Sign in -- airboss</title>
</svelte:head>

<ThemeProvider theme="web">
	<main class="page">
		<section class="card">
			<header class="hd">
				<h1>airboss</h1>
				<p class="sub">study</p>
			</header>

			{#if form?.error}
				<Banner variant="danger">{form.error}</Banner>
			{/if}

			<form
				method="POST"
				class="form"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
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
				/>
				<TextField
					name="password"
					label="Password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
					disabled={loading}
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
							>
								<span class="dev-name">{account.name}</span>
								<span class="dev-role">{account.role}</span>
							</button>
						{/each}
					</div>
					<p class="dev-hint">
						password: <code>{DEV_PASSWORD}</code>
					</p>
				</section>
			{/if}
		</section>
	</main>
</ThemeProvider>

<style>
	.page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: var(--ab-space-2xl) var(--ab-space-lg);
		background: var(--ab-color-bg);
	}

	.card {
		width: 100%;
		max-width: 22rem;
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-lg);
		padding: var(--ab-space-2xl);
		box-shadow: var(--ab-shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-lg);
	}

	.hd {
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: var(--ab-font-size-xl);
		font-weight: var(--ab-font-weight-bold);
		letter-spacing: var(--ab-letter-spacing-tight);
		color: var(--ab-color-fg);
	}

	.sub {
		margin: var(--ab-space-2xs) 0 0;
		font-size: var(--ab-font-size-sm);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-caps);
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-md);
	}

	.dev {
		padding-top: var(--ab-space-lg);
		border-top: 1px dashed var(--ab-color-border);
	}

	.dev-label {
		margin: 0 0 var(--ab-space-sm);
		font-size: var(--ab-font-size-xs);
		font-weight: var(--ab-font-weight-semibold);
		color: var(--ab-color-fg-subtle);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-caps);
	}

	.dev-accounts {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
	}

	.dev-btn {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--ab-space-sm) var(--ab-space-md);
		background: var(--ab-color-surface-sunken);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		font-family: inherit;
		font-size: var(--ab-font-size-sm);
		cursor: pointer;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.dev-btn:hover {
		background: var(--ab-color-primary-subtle);
		border-color: var(--ab-color-primary-subtle-border);
	}

	.dev-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.dev-name {
		color: var(--ab-color-fg);
		font-weight: var(--ab-font-weight-medium);
	}

	.dev-role {
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-wide);
	}

	.dev-hint {
		margin: var(--ab-space-sm) 0 0;
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-faint);
		text-align: center;
	}

	.dev-hint code {
		background: var(--ab-color-surface-sunken);
		padding: 0 var(--ab-space-2xs);
		border-radius: var(--ab-radius-sm);
		font-family: var(--ab-font-family-mono);
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-muted);
	}
</style>
