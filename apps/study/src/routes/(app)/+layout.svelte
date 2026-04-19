<script>
let { children } = $props();
</script>

<nav>
	<a href="/memory">Memory</a>
	<a href="/reps">Reps</a>
	<a href="/calibration">Calibration</a>
</nav>

<main>
	{@render children()}
</main>

<style>
	nav {
		display: flex;
		gap: 1.5rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		background: white;
	}

	nav a {
		color: #475569;
		text-decoration: none;
		font-weight: 500;
	}

	nav a:hover {
		color: #1a1a2e;
	}

	main {
		padding: 1.5rem;
		max-width: 48rem;
		margin: 0 auto;
	}
</style>
