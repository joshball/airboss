import { PORTS } from './ports';

/** Dev-only seed accounts for quick login panels. */
export const DEV_ACCOUNTS = [
	{ email: 'joshua@ball.dev', name: 'Joshua Ball', firstName: 'Joshua', lastName: 'Ball', role: 'admin' },
	{ email: 'learner@airboss.test', name: 'Test Learner', firstName: 'Test', lastName: 'Learner', role: 'learner' },
	{ email: 'abby@airboss.test', name: 'Abby', firstName: 'Abby', lastName: 'Learner', role: 'learner' },
] as const;

export const DEV_PASSWORD = 'Pa33word!';

/**
 * Canonical dev-seed test learner email. Abby owns the rich seeded content
 * (personal cards, scenarios, plan, sessions, reviews) so the local dev
 * environment has something realistic to study against. The older
 * `learner@airboss.test` row is intentionally kept (it may have data attached)
 * but is no longer the target of new seed writes.
 */
export const DEV_SEED_LEARNER_EMAIL = 'abby@airboss.test';

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

/**
 * Hostnames considered "obviously local" for the dev-seed production guard.
 * The seed pipeline parses the host out of `DATABASE_URL` and refuses to
 * proceed unless it matches one of these (suffix `*.local` is also accepted).
 */
export const DEV_DB_HOST_ALLOWLIST = ['localhost', '127.0.0.1', 'airboss-db'] as const;

/** Suffix allowlist (e.g. `.local` lets `airboss-db.local` pass). */
export const DEV_DB_HOST_SUFFIX_ALLOWLIST = ['.local'] as const;

/**
 * Tag stamped onto every row written by the dev-seed pipeline. Production rows
 * always have `seed_origin = NULL`. The remove + check subcommands key on this
 * value to find and clean up seeded rows.
 *
 * The date in the tag is the date the current dev-seed shape was authored;
 * bumping it forces a clean reseed (old rows are still removable via the prior
 * tag). Treat as opaque from the BC's point of view -- only the seed pipeline
 * and `db seed:check` / `db seed:remove` care about the value.
 */
export const DEV_SEED_ORIGIN_TAG = 'dev-seed-2026-04-25' as const;

/**
 * Bypass flag for the production guard. Required (alongside an interactive
 * `yes`) to run the dev-seed pipeline against a non-allowlisted host.
 */
export const DEV_SEED_BYPASS_FLAG = '--i-know-what-im-doing' as const;
