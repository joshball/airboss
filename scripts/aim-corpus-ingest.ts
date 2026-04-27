#!/usr/bin/env bun
/**
 * `bun scripts/aim-corpus-ingest.ts` -- Phase 7 of ADR 019 (AIM corpus
 * registration).
 *
 * This script registers entries from an AIM derivative tree into the
 * @ab/sources registry. It does NOT fetch source PDFs or extract markdown --
 * that's a separate operator pipeline (a follow-up to ADR 016 phase 0).
 *
 * Workflow:
 *
 *   bun run aim-ingest --edition=2026-09          # future operator pipeline: PDF/HTML -> derivatives
 *   bun run aim-corpus-ingest --edition=2026-09   # this script: derivatives -> registry
 *
 * Source of truth: ADR 019 §1.2 (aim shape), the WP at
 * `docs/work-packages/reference-aim-ingestion/`.
 */

import { runIngestCli } from '@ab/sources/aim';

const code = await runIngestCli(process.argv.slice(2));
process.exit(code);
