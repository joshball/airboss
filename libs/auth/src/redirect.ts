import { HOST_PREFIXES, QUERY_PARAMS, ROUTES, siblingOrigin } from '@ab/constants';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Cross-app sign-in URL pointing at the study login page.
 *
 * Sister apps (sim, avionics, flightbag) live on different subdomains, so a
 * sign-in affordance has to redirect back to study where the form-action
 * lives. The path is composed once here so callers do not duplicate origin
 * derivation + redirectTo encoding across every per-app layout-server.
 *
 * The `redirectTo` parameter targets the user's current cross-origin URL so
 * the post-login redirect lands them back where they came from. Study's
 * login page validates this against `isSafeRedirect` before honoring it.
 */
export function studyLoginUrl(event: RequestEvent): string {
	const studyOrigin = siblingOrigin(event.url, HOST_PREFIXES.STUDY);
	const currentUrl = event.url.toString();
	const redirectTo = encodeURIComponent(currentUrl);
	return `${studyOrigin}${ROUTES.LOGIN}?${QUERY_PARAMS.REDIRECT_TO}=${redirectTo}`;
}

/**
 * True when the path is a safe local redirect target (no open-redirect
 * bypasses). The character allowlist + URL-parse-against-placeholder pattern
 * forces the result to resolve relative to the current origin: any value that
 * either contains a control character or parses to a host other than the
 * placeholder is rejected.
 *
 * Used by login pages (and any other server action that honours a
 * `?redirectTo=...` parameter) to gate user-controlled destinations before
 * handing them to `redirect()`.
 */
export function isSafeRedirect(path: string): boolean {
	if (!path.startsWith('/')) return false;
	if (path.startsWith('//')) return false;
	// Block percent-encoded slash / backslash in the leading position. `/%2f...`
	// or `/%5c...` decode to `//...` after a downstream normalisation pass and
	// would smuggle a host through. Match case-insensitively.
	if (/^\/%(2f|5c)/i.test(path)) return false;
	// Block backslashes (some browsers normalize /\evil.com -> //evil.com)
	if (path.includes('\\')) return false;
	// Block CR/LF header injection
	if (path.includes('\r') || path.includes('\n')) return false;
	// Reject any whitespace or any character outside the URL-safe set so
	// Unicode tricks (RTL override, leading tab) cannot smuggle a host in.
	if (!/^[A-Za-z0-9_\-./?&=%~+#:@!$',;*]+$/.test(path)) return false;
	// Parse against a placeholder origin and confirm the result still resolves
	// to the placeholder host. Any value that promotes to a different host
	// (e.g. via percent-encoded `//` after a normalisation pass) is rejected.
	try {
		const placeholder = 'https://x.local';
		const parsed = new URL(path, placeholder);
		if (parsed.host !== 'x.local') return false;
	} catch {
		return false;
	}
	return true;
}
