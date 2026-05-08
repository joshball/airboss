# Plan: smarter seeding — scoped flags for content-author re-seed loops

**Date:** 2026-05-08
**Author:** Claude (session ending)
**Branch (when built):** `feat/smarter-seeding-flags`

## Problem

When you author a single CFR Part — add a row to `course/references/cfr-titles.yaml`, optionally an overlay to `regulations/cfr-14/_authoring/parts.yaml` — verifying the change requires:

```bash
bun scripts/db/seed-references.ts cfr-titles.yaml   # 2s -- already scoped
bun run db seed handbooks                            # 2-3 min -- runs every corpus
```

The `handbooks` phase walks every corpus (handbooks + ac + aim + acs + safo + info + ntsb + regulations) and inside each corpus, every doc / Part. PR #698's no-op-skip work makes unchanged work cheap (12.6s on a warm DB), but it's still 12s of disk + DB I/O for a one-Part edit. Cold runs are 2-3 min.

The underlying functions already accept scoping arguments — they're just not surfaced through the orchestrator or the `bun run db seed` dispatcher.

## Goal

Cut content-author re-seed time from ~12s warm / 2-3min cold to **under 2s** for single-corpus, single-doc edits. Without changing the full-reset code path.

## Existing scoping the seeders already accept

| Function                                                | Scoping it accepts today              | Surfaced in CLI?                                                                                                  |
| ------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `seedReferences({ filename })`                          | One YAML file in `course/references/` | Yes — positional arg on `scripts/db/seed-references.ts`                                                           |
| `seedReferencesFromManifest({ documentSlug, edition })` | One doc, one edition                  | Yes — positional args on `scripts/db/seed-references-from-manifest.ts`, but **NOT exposed via `bun run db seed`** |

So most of the work is already done at the function layer. The gap is the orchestrator and dispatcher.

## Changes (3 files, ~50 lines)

### 1. `scripts/db/seed-all.ts`

Today `phaseHandbooks` calls `seedReferencesFromManifest({ progress })` with no scoping. Add an optional argument that flows through:

```typescript
async function phaseHandbooks(opts: { documentSlug?: string; edition?: string } = {}): Promise<void> {
    process.stdout.write('\n=== seed: handbooks ===\n');
    const summary = await seedReferencesFromManifest({ ...opts, progress });
    // ... existing summary log
}
```

Plumb the optional args through the phase dispatcher:

```typescript
const PHASE_FNS: Record<Phase, (opts?: PhaseOpts) => Promise<void>> = {
    users: phaseUsers,
    knowledge: phaseKnowledge,
    handbooks: phaseHandbooks,
    references: phaseReferences,   // already scoped via filename
    // ...
};
```

Also: `phaseReferences` already accepts an `options.filename`; just expose it to the same `PhaseOpts` parser.

### 2. `scripts/db.ts`

Today the `seed` subcommand dispatcher passes `extraPositional[0]` as the phase name and stops. Extend to parse `--slug=<doc>`, `--edition=<date>`, `--file=<yaml>` flags from `extraPositional`:

```typescript
case 'seed': {
    const phase = extraPositional[0];
    const opts = parseSeedFlags(extraPositional.slice(1));
    // existing: spawn `bun scripts/db/seed-all.ts <phase>` with opts as extra args
}
```

The flags get JSON-encoded into a single `--opts` arg or passed as standard `--key=value` and re-parsed on the other side. Pick whichever pattern the existing dispatcher uses elsewhere.

### 3. New: `scripts/db/seed-references-from-manifest.ts` corpus filter

The function already accepts `documentSlug` (used by the test fixtures), but doesn't filter at the corpus level. Add `corpus?: 'handbooks' | 'aim' | 'ac' | 'regulations' | ...`:

```typescript
export async function seedReferencesFromManifest(
    options: SeedOptions = {},
): Promise<Summary> {
    const corpora = options.corpus ? [options.corpus] : CORPUS_DIRS;
    // existing parallel-corpus loop, just over the filtered list
}
```

This is the highest-leverage filter for CFR work: `--corpus regulations` cuts handbook + AIM + AC + ACS + SAFO + InFO + NTSB out of the loop entirely. Roughly an 8x speedup for content-author re-seeds.

## Files I'll touch

| File                                               | Change                                                                                                           | Estimated diff |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------- |
| `scripts/db/seed-all.ts`                           | Plumb `corpus`/`documentSlug`/`edition`/`filename` through `PHASE_FNS`                                           | +20 lines      |
| `scripts/db.ts`                                    | Parse `--corpus`/`--slug`/`--edition`/`--file` flags on `seed` subcommand                                        | +15 lines      |
| `scripts/db/seed-references-from-manifest.ts`      | Surface `corpus` filter at the dispatch layer                                                                    | +5 lines       |
| `scripts/db/seed-references-from-manifest.test.ts` | Add 2 unit tests: `corpus` filter excludes other corpora; combined `corpus` + `documentSlug` filters to one Part | +30 lines      |

No DB schema change. No new dependencies. Backwards-compatible — existing `bun run db seed handbooks` keeps working unchanged.

## Acceptance

After this lands, a content author editing one CFR Part can run:

```bash
bun scripts/db/seed-references.ts cfr-titles.yaml         # ~2s
bun run db seed handbooks --corpus regulations            # ~30s (CFR only)
# or even tighter:
bun run db seed handbooks --corpus regulations --slug 14cfr39  # ~2s
bun test scripts/db/seed-references-from-manifest.test.ts # ~6s
```

Total: ~10s warm, ~30s cold. Today: ~14s warm, 2-3 min cold. **3x warm, 6-10x cold.**

## Out of scope (do NOT do in this PR)

- Smarter `references` phase scoping beyond `--file` (the function only walks `course/references/*.yaml`; it's already fast).
- Smarter `cards` / `abby` / `knowledge` phase scoping. Different concerns; not author re-seed loops.
- A `--watch` mode. Tempting but expands scope.
- Caching across runs. PR #707's snapshot work is the right place for that.

## Verification path

1. `bun run db seed handbooks --corpus regulations` produces only CFR-related output, no handbook / AIM / etc. logs.
2. `bun run db seed handbooks --corpus regulations --slug 14cfr39` produces output for Part 39 only.
3. The full-reset path (`bun run db reset`) still runs every phase and corpus; assertion: `db reset` output unchanged before/after this PR.
4. Existing 21 contract tests in `seed-references-from-manifest.test.ts` still pass.
5. New unit tests for the corpus filter: 2 added, both pass.

## Effort

Half a session. Mostly mechanical plumbing of existing capabilities.
