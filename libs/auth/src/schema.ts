/**
 * READ-ONLY Drizzle schemas matching better-auth's auto-created tables.
 * These are for querying only -- better-auth manages the tables.
 *
 * Table prefix: bauth_ (set via modelName in server.ts).
 * These live in the default public schema since better-auth
 * does not support PostgreSQL schema namespaces.
 */

import { AUTH_RATE_LIMIT } from '@ab/constants';
import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const bauthUser = pgTable('bauth_user', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name').notNull(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	role: text('role'),
	address: jsonb('address'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthSession = pgTable('bauth_session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id),
	token: text('token').notNull().unique(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	impersonatedBy: text('impersonated_by'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthAccount = pgTable('bauth_account', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => bauthUser.id),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	idToken: text('id_token'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const bauthVerification = pgTable('bauth_verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

/**
 * Rate-limit storage for better-auth.
 *
 * Populated by better-auth itself when `rateLimit.storage = 'database'`
 * (see `createAuth` in `./server.ts`). The fields exactly match the shape
 * the better-auth core expects (`key`, `count`, `lastRequest`); this Drizzle
 * declaration exists so:
 *
 *   1. drizzle-kit generates the migration that creates the table; and
 *   2. tests can read the rows directly to prove that rate-limit state is
 *      persisted in Postgres (not just in process memory).
 *
 * `lastRequest` stores a JS millisecond timestamp (`Date.now()` -- well
 * within the safe-integer range, so `mode: 'number'` is correct).
 *
 * The JS property names (`key`, `count`, `lastRequest`) match better-auth's
 * default field keys; the column names use snake_case to match the rest of
 * the schema. Renaming the JS property would force a `fields` override on
 * the better-auth side, which silently breaks the drizzle-adapter lookup.
 */
export const bauthRateLimit = pgTable(AUTH_RATE_LIMIT.TABLE_NAME, {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
