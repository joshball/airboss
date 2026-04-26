// Stub for `$app/state` used in DOM tests. SvelteKit's runtime is not
// available in the standalone DOM project, so components that import
// `page` / `navigating` from `$app/state` resolve here instead.

export const page = {
	url: new URL('https://test.example/'),
	params: {} as Record<string, string>,
	route: { id: null as string | null },
	status: 200,
	error: null,
	data: {} as Record<string, unknown>,
	form: null,
};

export const navigating = {
	from: null,
	to: null,
	type: null,
	willUnload: false,
	delta: null,
	complete: Promise.resolve(),
};

export const updated = {
	current: false,
	check: async () => false,
};
