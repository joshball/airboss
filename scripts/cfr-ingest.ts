#!/usr/bin/env bun

/**
 * `bun scripts/cfr-ingest.ts` -- Phase 3 CFR ingestion entry point.
 *
 * Source of truth: ADR 019 §1.2 (`regs` corpus) + the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Usage:
 *
 *   bun run cfr-ingest --edition=<YYYY-MM-DD> [--title=14|49] [--out=<path>]
 *   bun run cfr-ingest --fixture=<path> [--title=14|49] [--out=<path>]
 *   bun run cfr-ingest --help
 *
 * Live ingestion (no `--fixture=`) hits the eCFR Versioner API and caches the
 * XML under `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>/`.
 * CI runs MUST pass `--fixture=` -- live network ingest is an operator action.
 */

import { runIngestCli } from '@ab/sources/regs';

const exitCode = await runIngestCli(process.argv.slice(2));
process.exit(exitCode);
