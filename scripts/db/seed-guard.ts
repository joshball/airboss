/**
 * Production guard for the dev-seed pipeline.
 *
 * Refuses to seed when:
 *   - NODE_ENV === 'production', AND
 *   - the host parsed out of DATABASE_URL is NOT in the dev allowlist.
 *
 * Bypassable only by passing `--i-know-what-im-doing` AND answering an
 * interactive `yes`. Both legs are required: a stale `.env` with a prod URL
 * shouldn't accidentally seed because someone forgot the flag, and an
 * interactive flag shouldn't seed because someone left a prod URL in the env.
 *
 * Pure logic: no IO. The dispatcher (scripts/db.ts) is responsible for the
 * interactive `yes` confirmation; this module decides whether the guard fires
 * and why.
 */

import { DEV_DB_HOST_ALLOWLIST, DEV_DB_HOST_SUFFIX_ALLOWLIST, DEV_SEED_BYPASS_FLAG, ENV_VARS } from '@ab/constants';

export interface GuardInput {
	/** Raw DATABASE_URL value, possibly empty. */
	databaseUrl: string;
	/** Raw NODE_ENV value, possibly undefined. */
	nodeEnv: string | undefined;
	/** Process flags as a Set, e.g. parsed from process.argv. */
	flags: ReadonlySet<string>;
}

export type GuardDecision =
	| { kind: 'allow'; reason: 'host-allowlisted' }
	| { kind: 'allow-bypass'; reason: 'bypass-flag-acknowledged' }
	| { kind: 'block'; reason: 'database-url-missing'; message: string }
	| { kind: 'block'; reason: 'production-host'; message: string };

/**
 * Decide whether the dev-seed pipeline may proceed. The dispatcher consumes
 * the result and (for `allow-bypass`) prompts the user for confirmation.
 */
export function decideSeedGuard(input: GuardInput): GuardDecision {
	const { databaseUrl, nodeEnv, flags } = input;

	if (!databaseUrl) {
		return {
			kind: 'block',
			reason: 'database-url-missing',
			message: `${ENV_VARS.DATABASE_URL} is not set; refusing to seed without a known target.`,
		};
	}

	const host = extractHost(databaseUrl);
	const hostAllowlisted = host !== null && isHostAllowlisted(host);
	const isProduction = nodeEnv === 'production';

	if (hostAllowlisted && !isProduction) {
		return { kind: 'allow', reason: 'host-allowlisted' };
	}

	if (flags.has(DEV_SEED_BYPASS_FLAG)) {
		return { kind: 'allow-bypass', reason: 'bypass-flag-acknowledged' };
	}

	return {
		kind: 'block',
		reason: 'production-host',
		message: buildBlockMessage(host, isProduction),
	};
}

/**
 * Extract the host portion of a postgres connection string. Returns `null` if
 * the URL doesn't parse as a recognizable connection string.
 */
export function extractHost(connectionString: string): string | null {
	const match = /^postgres(?:ql)?:\/\/(?:[^@/]*@)?([^:/?#]+)/i.exec(connectionString);
	if (!match) return null;
	return match[1].toLowerCase();
}

export function isHostAllowlisted(host: string): boolean {
	if ((DEV_DB_HOST_ALLOWLIST as readonly string[]).includes(host)) return true;
	for (const suffix of DEV_DB_HOST_SUFFIX_ALLOWLIST) {
		if (host.endsWith(suffix)) return true;
	}
	return false;
}

function buildBlockMessage(host: string | null, isProduction: boolean): string {
	const hostLabel = host ?? '(unknown host)';
	const allowlist = [...DEV_DB_HOST_ALLOWLIST, ...DEV_DB_HOST_SUFFIX_ALLOWLIST.map((s) => `*${s}`)].join(', ');
	const lines = [
		`Refusing to run dev-seed against host '${hostLabel}'.`,
		isProduction ? `NODE_ENV=production is set.` : 'Host is not on the dev allowlist.',
		`Allowed: ${allowlist}.`,
		`To bypass: pass ${DEV_SEED_BYPASS_FLAG} AND answer 'yes' to the prompt.`,
	];
	return lines.join('\n  ');
}
