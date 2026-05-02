/**
 * Network denylist constants for outbound HTTP fetches.
 *
 * The hangar source-ingest pipeline accepts operator-supplied URLs for the
 * binary-visual `bv_index_url`, the source `url`, and any future fetch input.
 * Without filtering these resolve through `fetch()` directly, which lets an
 * AUTHOR session aim the fetcher at:
 *
 *   - cloud metadata services (`http://169.254.169.254/...` -> IAM creds)
 *   - localhost / loopback (sibling apps, internal Postgres, etc.)
 *   - RFC1918 ranges (corp internal services on the host network)
 *   - link-local (any router admin panel adjacent to the worker)
 *   - IPv6 equivalents of all of the above
 *
 * A denylist is the right shape for a learning platform whose source corpus
 * is open-ended: an allowlist of public hosts is maintained per upstream
 * (`SOURCE_FETCH_ALLOWED_HOSTS` for the corpus pipeline), but operator-typed
 * URLs are inherently "we cannot enumerate them all"; deny private space
 * instead.
 *
 * Used by `validateOutboundUrl` in `@ab/utils`.
 */

/**
 * IPv4 CIDR ranges the outbound fetcher must refuse. Each tuple is
 * `[networkAddress, prefixLength]`; the validator masks the candidate IP
 * against the prefix and rejects on a match.
 *
 * Coverage:
 *   - 0.0.0.0/8        unspecified / "this network" (RFC 1122)
 *   - 10.0.0.0/8       RFC1918 private
 *   - 127.0.0.0/8      loopback
 *   - 169.254.0.0/16   link-local (includes 169.254.169.254 cloud metadata)
 *   - 172.16.0.0/12    RFC1918 private
 *   - 192.168.0.0/16   RFC1918 private
 */
export const PRIVATE_IPV4_CIDRS: readonly (readonly [string, number])[] = [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.168.0.0', 16],
] as const;

/**
 * IPv6 CIDR ranges the outbound fetcher must refuse. Each tuple is
 * `[fullyExpandedAddress, prefixLength]`; the validator expands the
 * candidate IPv6 to its full 128-bit form and masks it against the prefix.
 *
 * Coverage:
 *   - ::/128           unspecified
 *   - ::1/128          loopback
 *   - fc00::/7         unique local addresses (IPv6 RFC1918 equivalent)
 *   - fe80::/10        link-local
 *   - ::ffff:0:0/96    IPv4-mapped IPv6 (catches `::ffff:127.0.0.1` style
 *                      bypass attempts; the validator also re-checks the
 *                      embedded IPv4 against PRIVATE_IPV4_CIDRS)
 */
export const PRIVATE_IPV6_CIDRS: readonly (readonly [string, number])[] = [
	['0000:0000:0000:0000:0000:0000:0000:0000', 128],
	['0000:0000:0000:0000:0000:0000:0000:0001', 128],
	['fc00:0000:0000:0000:0000:0000:0000:0000', 7],
	['fe80:0000:0000:0000:0000:0000:0000:0000', 10],
	['0000:0000:0000:0000:0000:ffff:0000:0000', 96],
] as const;

/** Schemes accepted by `validateOutboundUrl`. Anything else is rejected. */
export const ALLOWED_OUTBOUND_SCHEMES: readonly string[] = ['http:', 'https:'] as const;
