/**
 * Outbound URL validator -- defends against SSRF in operator-supplied URLs.
 *
 * Used by the hangar source-ingest pipeline (`bv_index_url`, source `url`,
 * and any future fetch input). Every operator-typed URL passes through
 * `validateOutboundUrl` before the worker hands it to `fetch()`.
 *
 * Defense layers:
 *   1. Scheme allowlist (`http:` / `https:` only -- rejects `file:`, `gopher:`, etc.)
 *   2. Hostname extraction; literal IPs are checked directly against the
 *      `PRIVATE_IPV4_CIDRS` / `PRIVATE_IPV6_CIDRS` denylists.
 *   3. DNS hostnames are resolved (all `A`/`AAAA` records) and every resolved
 *      IP must clear the same denylists. A hostname with mixed public + private
 *      records is rejected (the public record could be returned today and the
 *      private one tomorrow).
 *
 * The validator is async (it awaits DNS) and returns a discriminated
 * `{ ok: true, url } | { ok: false, reason }` result so callers can wire it
 * into Zod `.refine()` blocks or surface the reason as a form error.
 *
 * Note: TOCTOU is not closed by validation alone -- DNS can rebind between
 * the lookup and the fetch. The downstream fetcher should also reject
 * redirects to private space. For the current call sites the additional
 * cost of a custom-resolver `fetch` was deemed disproportionate; the
 * validator covers the typed-URL surface and the redirect chain is bounded
 * by `SOURCE_FETCH_ALLOWED_HOSTS` for the YAML-driven corpus pipeline.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ALLOWED_OUTBOUND_SCHEMES, PRIVATE_IPV4_CIDRS, PRIVATE_IPV6_CIDRS } from '@ab/constants';

/** Successful validation: URL is safe to hand to `fetch()`. */
export interface OutboundUrlOk {
	ok: true;
	url: string;
}

/** Validation failure: `reason` is a one-line explanation suitable for form errors. */
export interface OutboundUrlError {
	ok: false;
	reason: string;
}

export type OutboundUrlResult = OutboundUrlOk | OutboundUrlError;

/**
 * Optional DNS resolver override for tests. Production callers omit this.
 * The default uses `node:dns/promises` `lookup` with `all: true`.
 */
export interface ValidateOutboundUrlOptions {
	resolveAll?: (hostname: string) => Promise<readonly { address: string; family: number }[]>;
}

async function defaultResolveAll(hostname: string): Promise<readonly { address: string; family: number }[]> {
	const records = await lookup(hostname, { all: true });
	return records.map((r) => ({ address: r.address, family: r.family }));
}

/**
 * Validate an operator-supplied URL against the SSRF denylist.
 *
 * Returns `{ ok: true, url }` on success or `{ ok: false, reason }` with a
 * short explanation. Never throws -- DNS failures, malformed input, and
 * denied addresses are all reported through `reason`.
 */
export async function validateOutboundUrl(
	rawUrl: string,
	options: ValidateOutboundUrlOptions = {},
): Promise<OutboundUrlResult> {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return { ok: false, reason: 'URL is not parseable' };
	}

	if (!ALLOWED_OUTBOUND_SCHEMES.includes(parsed.protocol)) {
		return {
			ok: false,
			reason: `URL scheme '${parsed.protocol}' is not allowed (only ${ALLOWED_OUTBOUND_SCHEMES.join(', ')})`,
		};
	}

	const rawHost = parsed.hostname;
	if (rawHost.length === 0) {
		return { ok: false, reason: 'URL is missing a hostname' };
	}

	// WHATWG `URL.hostname` returns IPv6 literals wrapped in `[...]`. Node's
	// `isIP` rejects the bracketed form, so strip them before classifying.
	const unbracketed = rawHost.startsWith('[') && rawHost.endsWith(']') ? rawHost.slice(1, -1) : rawHost;
	const literalFamily = isIP(unbracketed);
	if (literalFamily === 4) {
		const denial = checkIpv4(unbracketed);
		if (denial !== null) return { ok: false, reason: denial };
		return { ok: true, url: parsed.toString() };
	}
	if (literalFamily === 6) {
		const denial = checkIpv6(unbracketed);
		if (denial !== null) return { ok: false, reason: denial };
		return { ok: true, url: parsed.toString() };
	}

	// Hostname: resolve and check every record.
	const resolveAll = options.resolveAll ?? defaultResolveAll;
	let records: readonly { address: string; family: number }[];
	try {
		records = await resolveAll(rawHost);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, reason: `DNS lookup failed for '${rawHost}': ${msg}` };
	}
	if (records.length === 0) {
		return { ok: false, reason: `DNS lookup returned no records for '${rawHost}'` };
	}

	for (const record of records) {
		const denial = record.family === 6 ? checkIpv6(record.address) : checkIpv4(record.address);
		if (denial !== null) {
			return {
				ok: false,
				reason: `host '${rawHost}' resolves to a denied address: ${denial}`,
			};
		}
	}

	return { ok: true, url: parsed.toString() };
}

/**
 * Return null when `addr` is allowed; return a denial reason when it falls
 * inside any `PRIVATE_IPV4_CIDRS` range.
 */
function checkIpv4(addr: string): string | null {
	const ip = ipv4ToInt(addr);
	if (ip === null) return `'${addr}' is not a valid IPv4 address`;
	for (const [network, prefix] of PRIVATE_IPV4_CIDRS) {
		const networkInt = ipv4ToInt(network);
		if (networkInt === null) continue;
		const mask = prefix === 0 ? 0 : (-1 << (32 - prefix)) >>> 0;
		if ((ip & mask) === (networkInt & mask)) {
			return `${addr} is in denied range ${network}/${prefix}`;
		}
	}
	return null;
}

function ipv4ToInt(addr: string): number | null {
	const parts = addr.split('.');
	if (parts.length !== 4) return null;
	let out = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const n = Number.parseInt(part, 10);
		if (n < 0 || n > 255) return null;
		out = (out << 8) | n;
	}
	return out >>> 0;
}

/**
 * Return null when `addr` is allowed; return a denial reason when it falls
 * inside any `PRIVATE_IPV6_CIDRS` range.
 *
 * Also re-checks IPv4-mapped (`::ffff:a.b.c.d`) and IPv4-compatible
 * (`::a.b.c.d`) forms against the IPv4 denylist so an attacker can't bypass
 * by hiding `127.0.0.1` inside an IPv6 string.
 */
function checkIpv6(addr: string): string | null {
	const expanded = expandIpv6(addr);
	if (expanded === null) return `'${addr}' is not a valid IPv6 address`;

	// IPv4-mapped: ::ffff:a.b.c.d -- expanded form ends with `:ffff:NNNN:NNNN`
	// where NNNN:NNNN encodes the embedded IPv4. Re-extract and check.
	const v4Embedded = extractEmbeddedIpv4(expanded);
	if (v4Embedded !== null) {
		const v4Reason = checkIpv4(v4Embedded);
		if (v4Reason !== null) {
			return `${addr} embeds IPv4 ${v4Embedded}: ${v4Reason}`;
		}
	}

	const ipBits = ipv6ToBits(expanded);
	if (ipBits === null) return `'${addr}' is not a valid IPv6 address`;

	for (const [network, prefix] of PRIVATE_IPV6_CIDRS) {
		const networkBits = ipv6ToBits(network);
		if (networkBits === null) continue;
		if (bitsMatch(ipBits, networkBits, prefix)) {
			return `${addr} is in denied range ${network}/${prefix}`;
		}
	}
	return null;
}

/**
 * Expand `::` and short-form IPv6 to the canonical 8-group hex form.
 * Returns null on malformed input. Accepts embedded IPv4 syntax
 * (`::ffff:1.2.3.4`).
 */
function expandIpv6(addr: string): string | null {
	let work = addr;

	// Translate trailing IPv4 dotted-quad to two hex groups so the rest of
	// the expander can treat it as plain hex.
	const lastColon = work.lastIndexOf(':');
	if (lastColon >= 0 && work.slice(lastColon + 1).includes('.')) {
		const v4 = work.slice(lastColon + 1);
		const parts = v4.split('.');
		if (parts.length !== 4) return null;
		const nums: number[] = [];
		for (const p of parts) {
			if (!/^\d{1,3}$/.test(p)) return null;
			const n = Number.parseInt(p, 10);
			if (n < 0 || n > 255) return null;
			nums.push(n);
		}
		const high = ((nums[0] << 8) | nums[1]).toString(16);
		const low = ((nums[2] << 8) | nums[3]).toString(16);
		work = `${work.slice(0, lastColon + 1)}${high}:${low}`;
	}

	const doubleColonIdx = work.indexOf('::');
	let groups: string[];
	if (doubleColonIdx === -1) {
		groups = work.split(':');
	} else {
		const before = work.slice(0, doubleColonIdx);
		const after = work.slice(doubleColonIdx + 2);
		// Reject a second `::` (the spec forbids it).
		if (after.includes('::')) return null;
		const beforeGroups = before.length === 0 ? [] : before.split(':');
		const afterGroups = after.length === 0 ? [] : after.split(':');
		const fillCount = 8 - beforeGroups.length - afterGroups.length;
		if (fillCount < 0) return null;
		const fill: string[] = [];
		for (let i = 0; i < fillCount; i += 1) fill.push('0');
		groups = [...beforeGroups, ...fill, ...afterGroups];
	}

	if (groups.length !== 8) return null;
	const padded: string[] = [];
	for (const g of groups) {
		if (g.length === 0 || g.length > 4 || !/^[0-9a-fA-F]+$/.test(g)) return null;
		padded.push(g.padStart(4, '0').toLowerCase());
	}
	return padded.join(':');
}

function ipv6ToBits(expanded: string): readonly number[] | null {
	const groups = expanded.split(':');
	if (groups.length !== 8) return null;
	const bits: number[] = [];
	for (const g of groups) {
		const n = Number.parseInt(g, 16);
		if (!Number.isFinite(n) || n < 0 || n > 0xffff) return null;
		for (let i = 15; i >= 0; i -= 1) bits.push((n >> i) & 1);
	}
	return bits;
}

function bitsMatch(a: readonly number[], b: readonly number[], prefix: number): boolean {
	if (prefix > 128 || prefix < 0) return false;
	for (let i = 0; i < prefix; i += 1) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Extract a dotted-quad IPv4 from a fully-expanded IPv6 string when the
 * top 96 bits are an IPv4-mapped or IPv4-compatible prefix. Returns null
 * when the address is plain IPv6.
 */
function extractEmbeddedIpv4(expanded: string): string | null {
	const groups = expanded.split(':');
	if (groups.length !== 8) return null;
	// IPv4-mapped: ::ffff:NNNN:NNNN -- groups 0..4 are 0, group 5 is ffff.
	const mapped =
		groups[0] === '0000' &&
		groups[1] === '0000' &&
		groups[2] === '0000' &&
		groups[3] === '0000' &&
		groups[4] === '0000' &&
		groups[5] === 'ffff';
	// IPv4-compatible (deprecated but worth catching): ::NNNN:NNNN with
	// groups 0..5 all zero.
	const compatible =
		groups[0] === '0000' &&
		groups[1] === '0000' &&
		groups[2] === '0000' &&
		groups[3] === '0000' &&
		groups[4] === '0000' &&
		groups[5] === '0000' &&
		!(groups[6] === '0000' && groups[7] === '0000') &&
		!(groups[6] === '0000' && groups[7] === '0001');
	if (!mapped && !compatible) return null;
	const high = Number.parseInt(groups[6], 16);
	const low = Number.parseInt(groups[7], 16);
	if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
	const a = (high >> 8) & 0xff;
	const b = high & 0xff;
	const c = (low >> 8) & 0xff;
	const d = low & 0xff;
	return `${a}.${b}.${c}.${d}`;
}
