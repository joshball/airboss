// Stub for `$app/navigation` used in DOM tests. SvelteKit's runtime is not
// available in the standalone DOM project, so components that import goto /
// replaceState / pushState here resolve to no-ops.

export const goto = async (_url: string | URL, _opts?: unknown): Promise<void> => {};

export const replaceState = (_url: string | URL, _state: Record<string, unknown> = {}): void => {};

export const pushState = (_url: string | URL, _state: Record<string, unknown> = {}): void => {};

export const invalidate = async (_dependency?: string | URL | ((url: URL) => boolean)): Promise<void> => {};

export const invalidateAll = async (): Promise<void> => {};

export const preloadCode = async (..._urls: string[]): Promise<void> => {};

export const preloadData = async (_href: string): Promise<unknown> => undefined;

export const beforeNavigate = (_fn: (n: unknown) => void): void => {};

export const afterNavigate = (_fn: (n: unknown) => void): void => {};

export const onNavigate = (_fn: (n: unknown) => void): void => {};

export const disableScrollHandling = (): void => {};
