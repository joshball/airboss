import { defineConfig } from 'drizzle-kit';
import { DEV_DB_URL, ENV_VARS, SCHEMAS } from './libs/constants/src/index';

export default defineConfig({
	dialect: 'postgresql',
	schema: [
		'./libs/auth/src/schema.ts',
		'./libs/bc/study/src/schema.ts',
		'./libs/bc/study/src/citations/schema.ts',
		'./libs/bc/hangar/src/schema.ts',
		'./libs/hangar-jobs/src/schema.ts',
		'./libs/bc/sim/src/schema.ts',
		'./libs/audit/src/schema.ts',
		'./libs/sources/src/db/schema.ts',
	],
	// 'public' is the Postgres default (home for better-auth's bauth_* tables);
	// the rest come from the SCHEMAS constant so additions stay in one place.
	schemaFilter: [
		'public',
		SCHEMAS.IDENTITY,
		SCHEMAS.AUDIT,
		SCHEMAS.STUDY,
		SCHEMAS.HANGAR,
		SCHEMAS.SIM,
		SCHEMAS.SOURCES_REGISTRY,
	],
	out: './drizzle',
	dbCredentials: {
		url: process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL,
	},
});
