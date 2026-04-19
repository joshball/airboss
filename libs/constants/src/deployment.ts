export const DB_POOL_SIZE = 10;
export const DB_CONNECT_TIMEOUT_MS = 10_000;
export const DB_IDLE_TIMEOUT_MS = 30_000;
export const DB_MAX_LIFETIME_MS = 600_000;
export const SHUTDOWN_TIMEOUT_MS = 30_000;
export const HEALTH_CHECK_DB_TIMEOUT_MS = 5_000;
export const DISK_WARN_BYTES = 1_073_741_824; // 1 GB
export const DISK_ERROR_BYTES = 104_857_600; // 100 MB

/** Session cookie max age: 7 days (expressed in seconds). */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const LOG_LEVELS = {
	DEBUG: 'debug',
	INFO: 'info',
	WARN: 'warn',
	ERROR: 'error',
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};
