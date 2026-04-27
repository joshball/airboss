#!/usr/bin/env bun
/**
 * `bun scripts/handbook-corpus-ingest.ts` -- Phase 6 of ADR 019 (handbook
 * corpus registration).
 *
 * This script registers entries from the handbook derivative tree (written by
 * PR #242's Python pipeline) into the @ab/sources registry. It does NOT
 * fetch source PDFs or extract markdown -- that's `bun run handbook-ingest`.
 *
 * Workflow:
 *
 *   bun run handbook-ingest --doc=phak                # PR #242: PDF -> derivatives
 *   bun run handbook-corpus-ingest --doc=phak --edition=8083-25C   # this script: derivatives -> registry
 *
 * Source of truth: ADR 019 §1.2 (handbooks shape), the WP at
 * `docs/work-packages/reference-handbook-ingestion/`.
 */

import { runIngestCli } from '@ab/sources/handbooks';

const code = await runIngestCli(process.argv.slice(2));
process.exit(code);
