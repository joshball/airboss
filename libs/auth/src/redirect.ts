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
