import { PORTS } from './ports';

/** Dev-only seed accounts for quick login panels. */
export const DEV_ACCOUNTS = [
	{ email: 'joshua@ball.dev', name: 'Joshua Ball', firstName: 'Joshua', lastName: 'Ball', role: 'admin' },
	{ email: 'learner@airboss.test', name: 'Test Learner', firstName: 'Test', lastName: 'Learner', role: 'learner' },
] as const;

export const DEV_PASSWORD = 'Pa33word!';

/** Dev-only local Postgres credentials -- aligned with docker-compose.yml. */
export const DEV_DB = {
	USER: 'airboss',
	PASSWORD: 'airboss',
	NAME: 'airboss',
	HOST: 'localhost',
} as const;

/** Dev-only fallback DATABASE_URL used when the env var is not set. */
export const DEV_DB_URL =
	`postgresql://${DEV_DB.USER}:${DEV_DB.PASSWORD}@${DEV_DB.HOST}:${PORTS.DB}/${DEV_DB.NAME}` as const;

/** Regex matching connection strings that point at a local dev database. */
export const DEV_DB_HOST_PATTERN = /@(localhost|127\.0\.0\.1|airboss-db)(:|\/)/;
