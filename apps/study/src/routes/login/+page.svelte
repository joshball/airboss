<script lang="ts">
import { DEV_ACCOUNTS, DEV_PASSWORD } from '@ab/constants';
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

<main>
	<section class="card">
		<header>
			<h1>airboss</h1>
			<p class="sub">study</p>
		</header>

		{#if form?.error}
			<div class="error" role="alert">{form.error}</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					loading = false;
					await update();
				};
			}}
		>
			<label>
				<span>Email</span>
				<input
					type="email"
					name="email"
					bind:value={email}
					required
					autocomplete="email"
					disabled={loading}
					placeholder="you@example.com"
				/>
			</label>

			<label>
				<span>Password</span>
				<input
					type="password"
					name="password"
					bind:value={password}
					required
					autocomplete="current-password"
					disabled={loading}
				/>
			</label>

			<button type="submit" disabled={loading}>
				{loading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		{#if dev}
			<section class="dev">
				<p class="dev-label">Dev accounts</p>
				<div class="dev-accounts">
					{#each DEV_ACCOUNTS as account (account.email)}
						<button type="button" class="dev-btn" onclick={() => fillDevAccount(account.email)}>
							<span class="dev-name">{account.name}</span>
							<span class="dev-role">{account.role}</span>
						</button>
					{/each}
				</div>
				<p class="dev-hint">password: <code>{DEV_PASSWORD}</code></p>
			</section>
		{/if}
	</section>
</main>

<style>
	main {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 2rem 1rem;
		background: #f8fafc;
	}

	.card {
		width: 100%;
		max-width: 22rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.error {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		padding: 0.625rem 0.875rem;
		border-radius: 8px;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: #334155;
	}

	input {
		font: inherit;
		padding: 0.625rem 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		background: white;
		color: #0f172a;
		transition: border-color 120ms, box-shadow 120ms;
	}

	input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
	}

	input:disabled {
		background: #f1f5f9;
		cursor: not-allowed;
	}

	button[type='submit'] {
		margin-top: 0.5rem;
		padding: 0.625rem 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		transition: background 120ms;
	}

	button[type='submit']:hover:not(:disabled) {
		background: #1d4ed8;
	}

	button[type='submit']:disabled {
		background: #94a3b8;
		cursor: not-allowed;
	}

	.dev {
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: 1px dashed #e2e8f0;
	}

	.dev-label {
		margin: 0 0 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.dev-accounts {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.dev-btn {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background 120ms, border-color 120ms;
	}

	.dev-btn:hover {
		background: #eff6ff;
		border-color: #bfdbfe;
	}

	.dev-name {
		color: #0f172a;
		font-weight: 500;
	}

	.dev-role {
		color: #64748b;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dev-hint {
		margin: 0.625rem 0 0;
		font-size: 0.75rem;
		color: #94a3b8;
		text-align: center;
	}

	.dev-hint code {
		background: #f1f5f9;
		padding: 0.0625rem 0.375rem;
		border-radius: 4px;
		font-size: 0.75rem;
		color: #475569;
	}
</style>
