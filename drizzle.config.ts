import { defineConfig } from 'drizzle-kit';
import { PORTS } from './libs/constants/src/ports';

export default defineConfig({
	dialect: 'postgresql',
	schema: ['./libs/auth/src/schema.ts'],
	schemaFilter: ['public', 'identity', 'audit', 'study'],
	out: './drizzle',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? `postgresql://airboss:airboss@localhost:${PORTS.DB}/airboss`,
	},
});
