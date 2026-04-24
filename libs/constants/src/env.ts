/**
 * Type-safe environment variable access with defaults.
 */

/** Names of every environment variable the app reads. Single source of truth. */
export const ENV_VARS = {
	NODE_ENV: 'NODE_ENV',
	LOG_LEVEL: 'LOG_LEVEL',
	DATABASE_URL: 'DATABASE_URL',
	DB_POOL_SIZE: 'DB_POOL_SIZE',
	DB_CONNECT_TIMEOUT_MS: 'DB_CONNECT_TIMEOUT_MS',
	DB_IDLE_TIMEOUT_MS: 'DB_IDLE_TIMEOUT_MS',
	DB_MAX_LIFETIME_MS: 'DB_MAX_LIFETIME_MS',
	BETTER_AUTH_SECRET: 'BETTER_AUTH_SECRET',
	BETTER_AUTH_URL: 'BETTER_AUTH_URL',
	RESEND_API_KEY: 'RESEND_API_KEY',
	AIRBOSS_ALLOW_DEV_SEED: 'AIRBOSS_ALLOW_DEV_SEED',
	/** Hangar sync-to-disk mode override. Values: `commit-local` | `pr`. */
	HANGAR_SYNC_MODE: 'HANGAR_SYNC_MODE',
	/**
	 * Dev-only override for the sectional edition resolver. When set, the
	 * binary-visual fetch pipeline loads HTML from this location (an http(s)://
	 * URL or a local filesystem path) instead of the source's configured index
	 * URL. Off by default. Used to simulate a "next edition available" payload
	 * during the wp-hangar-non-textual manual walkthrough (test-plan step 18).
	 * Refuses to activate when `NODE_ENV=production`.
	 */
	HANGAR_EDITION_STUB_URL: 'HANGAR_EDITION_STUB_URL',
} as const;

export type EnvVarName = (typeof ENV_VARS)[keyof typeof ENV_VARS];

export function getEnv(key: EnvVarName, fallback?: string): string {
	const value = process.env[key];
	if (value !== undefined && value !== '') return value;
	if (fallback !== undefined) return fallback;
	return '';
}

export function getEnvInt(key: EnvVarName, fallback: number): number {
	const raw = process.env[key];
	if (raw === undefined || raw === '') return fallback;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) {
		throw new Error(`Environment variable ${key} must be an integer, got "${raw}"`);
	}
	return parsed;
}

export function getEnvBool(key: EnvVarName, fallback: boolean): boolean {
	const raw = process.env[key];
	if (raw === undefined || raw === '') return fallback;
	if (raw === 'true' || raw === '1') return true;
	if (raw === 'false' || raw === '0') return false;
	throw new Error(`Environment variable ${key} must be a boolean (true/false/1/0), got "${raw}"`);
}

export function requireEnv(key: EnvVarName): string {
	const value = process.env[key];
	if (value === undefined || value === '') {
		throw new Error(`Required environment variable ${key} is not set`);
	}
	return value;
}

export function isProd(): boolean {
	return process.env[ENV_VARS.NODE_ENV] === 'production';
}
