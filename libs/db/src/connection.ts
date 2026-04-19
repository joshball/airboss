import {
	DB_CONNECT_TIMEOUT_MS,
	DB_IDLE_TIMEOUT_MS,
	DB_MAX_LIFETIME_MS,
	DB_POOL_SIZE,
	SHUTDOWN_TIMEOUT_MS,
} from '@ab/constants';
import { getEnvInt, requireEnv } from '@ab/constants/env';
import { createLogger } from '@ab/utils';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const log = createLogger('db');

const connectionString = requireEnv('DATABASE_URL');

export const client = postgres(connectionString, {
	max: getEnvInt('DB_POOL_SIZE', DB_POOL_SIZE),
	connect_timeout: Math.floor(DB_CONNECT_TIMEOUT_MS / 1000),
	idle_timeout: Math.floor(DB_IDLE_TIMEOUT_MS / 1000),
	max_lifetime: Math.floor(DB_MAX_LIFETIME_MS / 1000),
});

export const db = drizzle(client);

// Graceful shutdown
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;

	log.info(`Received ${signal}, draining connection pool...`);

	const timer = setTimeout(() => {
		log.warn('Shutdown timeout exceeded, forcing exit');
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);

	try {
		await client.end();
		log.info('Connection pool drained, exiting');
	} catch (err) {
		log.error('Error during pool drain', undefined, err instanceof Error ? err : undefined);
	} finally {
		clearTimeout(timer);
		process.exit(0);
	}
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
