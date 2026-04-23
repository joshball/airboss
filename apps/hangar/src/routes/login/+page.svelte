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
	<title>Sign in -- hangar</title>
</svelte:head>

<ThemeProvider theme="airboss/default">
	<main class="page">
		<section class="card">
			<header class="hd">
				<h1>airboss</h1>
				<p class="sub">hangar</p>
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
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
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

	.dev-hint {
		margin: var(--space-sm) 0 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		text-align: center;
	}

	.dev-hint code {
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}
</style>
