<script lang="ts">
import Button, { type ButtonSize, type ButtonVariant } from '../../src/components/Button.svelte';

let {
	label,
	variant = 'primary',
	size = 'md',
	href,
	disabled = false,
	loading = false,
	loadingLabel,
	ariaLabel,
	onclick,
}: {
	label: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	href?: string;
	disabled?: boolean;
	loading?: boolean;
	loadingLabel?: string;
	ariaLabel?: string;
	onclick?: (event: MouseEvent) => void;
} = $props();
</script>

<Button {variant} {size} {href} {disabled} {loading} {loadingLabel} {ariaLabel} {onclick}>{label}</Button>
