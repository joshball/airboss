/**
 * Type-safe environment variable access with defaults.
 */

export function getEnv(key: string, fallback?: string): string {
	const value = process.env[key];
	if (value !== undefined && value !== '') return value;
	if (fallback !== undefined) return fallback;
	return '';
}

export function getEnvInt(key: string, fallback: number): number {
	const raw = process.env[key];
	if (raw === undefined || raw === '') return fallback;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed)) {
		throw new Error(`Environment variable ${key} must be an integer, got "${raw}"`);
	}
	return parsed;
}

export function getEnvBool(key: string, fallback: boolean): boolean {
	const raw = process.env[key];
	if (raw === undefined || raw === '') return fallback;
	if (raw === 'true' || raw === '1') return true;
	if (raw === 'false' || raw === '0') return false;
	throw new Error(`Environment variable ${key} must be a boolean (true/false/1/0), got "${raw}"`);
}

export function requireEnv(key: string): string {
	const value = process.env[key];
	if (value === undefined || value === '') {
		throw new Error(`Required environment variable ${key} is not set`);
	}
	return value;
}
