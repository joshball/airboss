#!/usr/bin/env bun

/**
 * `bun scripts/airboss-ref.ts` -- runs the ADR 019 reference-identifier
 * validator against `course/regulations/**`. Called by `bun run check` and
 * usable standalone for ad-hoc author runs.
 */

import { runCli } from '@ab/sources/check';

process.exit(runCli());
