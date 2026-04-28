---
title: 'ADR 018: Source artifact storage policy'
date: 2026-04-26
status: accepted
participants: Joshua Ball, Claude
context: ./context.md
supersedes: null
---

# ADR 018: Source artifact storage policy

## Decision

Airboss adopts a three-tier storage rule for content artifacts. Source documents (FAA PDFs, AC PDFs, audio masters, etc.) are kept in a **developer-local cache directory outside the repo**, with **LFS plumbing left in place** so the storage decision can flip later without breaking commit history. Extracted derivatives stay inline. Generated artifacts stay out of the repo.

| Tier                      | Examples                                                                  | Where                                                                                                  | Tracked how                                     |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Source documents**      | FAA handbook PDFs, AC PDFs, ACS publications, NTSB reports, audio masters | `$AIRBOSS_HANDBOOK_CACHE/<doc>/<edition>/source.<ext>` (default `~/Documents/airboss-handbook-cache/`) | Local cache + gitignore + LFS plumbing dormant  |
| **Extracted derivatives** | Section markdown, figure PNGs, table HTML, manifest.json, transcripts     | Alongside the corpus root, inline tree                                                                 | Inline git                                      |
| **Generated artifacts**   | DB rows, search indexes, computed graph edges                             | Postgres / app runtime                                                                                 | Not in repo at all                              |

The canonical reference for contributors and agents is [docs/platform/STORAGE.md](../../platform/STORAGE.md). Every new content corpus added to the repo follows this rule.

## What "Flavor D" means in concrete terms

This is the configuration airboss runs:

1. **`.gitattributes` carries an LFS filter line for the corpus** (`handbooks/**/*.pdf filter=lfs diff=lfs merge=lfs -text`). The line is dormant. It only activates if a matching file is ever staged. Today, no matching file is ever staged because of (2).
2. **`.gitignore` blocks the source files from staging entirely** (`handbooks/**/*.pdf`). `git add` silently refuses any file matching the pattern. Stage 1 of git's pipeline rejects the file before Stage 2 (the `.gitattributes` filter) is consulted.
3. **The Python ingestion pipeline reads/writes the source PDF in a cache directory** controlled by the `AIRBOSS_HANDBOOK_CACHE` env var (default `~/Documents/airboss-handbook-cache/`). Cache layout mirrors the in-repo derivative tree: `<cache>/handbooks/<doc>/<edition>/source.pdf`. If the cache file is missing, the pipeline fetches from the FAA URL and populates it.
4. **`manifest.json` (committed inline) records `(source_url, source_sha256, fetched_at)`** for every ingestion run. The SHA-256 is the same OID that LFS would have used; if we ever flip to actual LFS storage, the manifest's recorded SHAs validate against the LFS bytes retroactively.
5. **No LFS server runs anywhere.** Not on GitHub, not self-hosted, not on localhost. The plumbing is plumbing -- water doesn't flow through it.

### Pipeline interaction with `.gitignore` + `.gitattributes`

Walking through `git add handbooks/phak/8083-25C/source.pdf` in this configuration:

- **Stage 1 -- gitignore check.** `.gitignore` matches `handbooks/**/*.pdf`. Git refuses to stage the file. Pipeline stops here.
- **Stage 2 -- never reached.** The `.gitattributes` LFS filter is configured but never invoked.

Walking through the same `git add` if Joshua flips the policy later (removes the gitignore line):

- **Stage 1 -- gitignore check.** No match. File proceeds.
- **Stage 2 -- clean filter.** `.gitattributes` says `filter=lfs`. Git computes SHA-256, stores bytes in `.git/lfs/objects/`, replaces the file in the index with a 130-byte pointer.
- **Push.** LFS uploads the bytes to whatever LFS server is configured at that point (GitHub, self-hosted, etc.).

The plumbing makes the future decision a one-line gitignore removal, not an architecture change.

## Why this configuration

You've got four constraints:

1. Single developer (Joshua), no team needing reproducibility today
2. Handbook editions change every 5-20 years (low churn)
3. Don't want to pay GitHub for LFS storage/bandwidth
4. Don't want to run an LFS server (cloud or on-laptop)

And you don't want to paint yourself into a corner: if year 4 of this repo brings real contributors or a real "I lost my laptop" recovery scenario, you want LFS to be a one-command flip, not a re-architecture.

Flavor D meets all five:

- Constraint 1: cache-on-laptop is fine when the only laptop is yours.
- Constraint 2: re-fetching the FAA PDF every 5-20 years is a non-event.
- Constraint 3: zero GitHub LFS spend (zero bytes pass through GitHub LFS).
- Constraint 4: zero servers, anywhere.
- Future-proofing: the LFS filter line stays in `.gitattributes`. Future activation is "remove one gitignore line and `git add` the cached PDFs." Future-Joshua doesn't have to undo a decision; he just removes a guardrail.

## Concrete shape per corpus

For the handbook corpus this means:

```text
# In the repo (committed):
handbooks/phak/8083-25C/
  manifest.json                                 <- inline (audit metadata: source_url, source_sha256, fetched_at)
  12/
    index.md                                    <- inline (chapter overview)
    03-atmospheric-pressure.md                  <- inline (section markdown)
  figures/
    fig-12-7-pressure-altitude.png              <- inline
  tables/
    tbl-12-3-density-altitude.html              <- inline

# On Joshua's laptop only (cached, gitignored):
~/Documents/airboss-handbook-cache/handbooks/phak/8083-25C/
  source.pdf                                    <- 74 MB, FAA-fetched
```

For future corpora the same shape applies with a different root:

```text
regulations/ac/61-65/
  manifest.json
  paragraphs/...md
~/Documents/airboss-handbook-cache/regulations/ac/61-65/source.pdf

aim/2025-09/
  manifest.json
  5-1-7.md                                      (per AIM paragraph)
~/Documents/airboss-handbook-cache/aim/2025-09/source.pdf

audio/phak/8083-25C/12-3/
  transcript.md
  segments.json
~/Documents/airboss-handbook-cache/audio/phak/8083-25C/12-3/source.wav
```

## What this implies in the repo

1. `.gitattributes` at repo root carries one line per corpus that has source documents. Each line is dormant plumbing:

   ```text
   handbooks/**/*.pdf filter=lfs diff=lfs merge=lfs -text
   ```

   Future ingestion WPs add their own line for their corpus root. The pattern is explicit and scoped, never a global `*.pdf` wildcard.

2. `.gitignore` carries the actual block. One line per corpus:

   ```text
   handbooks/**/*.pdf
   ```

3. The Python pipeline reads/writes from `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`). Layout mirrors the in-repo derivative tree. If the env var is unset, the pipeline uses the default path; if the cache file is missing, it downloads from FAA.

4. `manifest.json` is the audit trail. The SHA-256 it records is the OID that LFS would have used. Future flip to LFS validates the manifest retroactively.

5. Contributors (today: only Joshua, on this laptop) populate the cache once via the ingestion pipeline. Re-clones to a new machine re-populate the cache by re-running the pipeline. If FAA URLs ever break, the relevant edition is unrecoverable on a new machine -- but the markdown/figures/tables in the repo continue to render fine forever.

6. `git lfs install` is **not** a developer prerequisite under Flavor D. The `.gitattributes` filter does nothing without the LFS extension installed, and that's fine -- nothing matches the filter anyway. README documents `git lfs install` as a *future* prerequisite for the day the policy flips.

## Scale-tier exception: high-cardinality derivative corpora

The default rule ("derivatives are committed") assumes derivative count is in the same order of magnitude as source count -- a 700-page handbook produces ~30 chapter markdown files plus a few hundred figure PNGs. Reviewable, greppable, useful as repo content.

CFR corpora violate that assumption. Title 14 alone produces ~6,300 per-section markdown files (one per `§`), Title 49 adds more, and the full FAA-relevant cross-title sweep would push past 15,000. That number is not greppable in any useful way -- developers don't read regulations by greping for `§91.103` across a 13K-file tree, they query the registry. Committing the bodies inflates clone size without buying anything the registry doesn't already provide.

The exception:

- **Commit:** `manifest.json` (corpus-level audit + `sourceSha256`) and `sections.json` (the structural index: per-section `id`, `canonical_short`, `canonical_title`, `last_amended_date`, `body_path`, `body_sha256`). This is the registry's source of truth and the audit trail.
- **Gitignore:** the per-section body markdown (`regulations/cfr-*/**/*.md`). Bodies are computed -- they regenerate deterministically from the cached XML by re-running `bun run sources register cfr`. The `body_sha256` recorded in `sections.json` validates regeneration retroactively.
- **Threshold for applying this exception:** > ~1,000 derivative files per corpus version. Below that, default rule applies (commit everything).

This is consistent with the policy's intent ("audit trail is the SHA, not the bytes"). For CFR, the audit trail moves from the body file's git history to `body_sha256` in the committed `sections.json`. Greppability moves from the repo to the app -- the registry exposes section bodies via query, which is where developers actually consume them.

Trigger to revisit: if a second contributor joins, regeneration of 13K files on every fresh clone becomes friction worth re-evaluating against committing the bodies (or flipping the corpus to LFS).

## Trade-offs accepted

- **No reproducibility on a new machine without re-fetching from FAA.** If the FAA replaces an edition's URL or removes it, that edition is unrecoverable on a fresh clone unless Joshua has kept a copy somewhere outside the cache. Mitigation: Joshua manually archives source PDFs to a personal cloud (iCloud/Dropbox/etc.) when an edition is published. This is an ops practice, not enforced by the repo.
- **Cache directory must exist or be re-created** when running the pipeline. The pipeline auto-creates it.
- **Audit trail is "the SHA in manifest.json" rather than "the bytes pinned in git history."** For airboss's current scale (one developer), this is sufficient.

## What flips Flavor D to actual LFS

The trigger: any of these happen, the policy gets re-opened.

1. **A second active contributor joins.** Local cache breaks at the moment "where do I get the PDFs?" becomes a non-trivial question.
2. **CI starts running ingestion.** Cache-on-laptop doesn't transfer to a CI runner.
3. **An FAA URL breaks and an edition becomes unrecoverable** for some reason that matters (regulator audit, accreditation request).
4. **Joshua acquires a second machine he wants to dev on.**

The flip itself, when triggered:

1. Choose an LFS storage target (GitHub Free LFS at $0/month for 1 GB / 1 GB bandwidth, GitHub paid at $5/month per 50 GB pack, self-hosted via giftless/rudolfs, S3-backed via git-lfs-s3).
2. Remove `handbooks/**/*.pdf` from `.gitignore`.
3. `git add handbooks/<doc>/<edition>/source.pdf` -- the `.gitattributes` filter activates, files go through LFS clean filter, pointer files get committed.
4. `git push` uploads bytes to the LFS server.
5. Update [docs/platform/STORAGE.md](../../platform/STORAGE.md) to reflect the new storage location.
6. Document the LFS server endpoint in the README so contributors know what to clone against.

This is mechanical. None of it requires an ADR rewrite or a re-architecture.

## Why not the alternatives

The alternatives considered (don't commit source / inline blob / sibling repo / object storage / GitHub LFS / self-hosted LFS server / file-system custom transfer agent) and the reasons each was rejected for *current* airboss are documented in [context.md](./context.md). The short version:

- **GitHub LFS** -- costs money beyond the free tier; you don't want to pay for storage you don't yet need.
- **Self-hosted LFS server** (rudolfs / giftless / Gitea) -- real ongoing maintenance, real complexity, no payoff at single-dev scale.
- **Custom transfer agent (file-system)** -- clever, but the ergonomics ("remember to cp before git push") aren't worth the cleverness; just gitignore the files.
- **Inline blob** -- works fine at the current scale (~400 MB total for three handbooks) and was on the table; ruled against because zero-bytes-in-repo with cache + plumbing dormant is cheaper for the same outcome at this scale, and avoids the eventual pack-file degradation risk if the corpus grows past expectations.
- **Sibling repo** -- invents a coordination cost without a payoff at this scale.
- **Object storage (S3 etc.)** -- trades one storage problem for another; access control friction without a corresponding gain.

Flavor D is the smallest configuration that satisfies the stated constraints today while preserving the option to flip to any of the others tomorrow.

## Migration

This ADR is forward-looking. The repo today has zero committed source PDFs. The handbook ingestion WP is the first to land artifacts under this policy.

When the next ingestion WP runs (AC, NTSB, POH, AIM), it adds its own `.gitattributes` + `.gitignore` line for its corpus root and follows the same shape. No coordination across WPs needed.

## Acceptance criteria

- [ ] [docs/platform/STORAGE.md](../../platform/STORAGE.md) is the canonical policy reference.
- [ ] `.gitattributes` at the repo root has the `handbooks/**/*.pdf` LFS line (dormant plumbing).
- [ ] `.gitignore` at the repo root has the `handbooks/**/*.pdf` block (active gate).
- [ ] `tools/handbook-ingest/` reads/writes from `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`).
- [ ] [handbook-ingestion-and-reader/spec.md](../../work-packages/handbook-ingestion-and-reader/spec.md) and [tasks.md](../../work-packages/handbook-ingestion-and-reader/tasks.md) reflect the cache + dormant-plumbing layout.
- [ ] [CLAUDE.md](../../../CLAUDE.md) Critical Rules points contributors and agents at this ADR + STORAGE.md before adding a new corpus.
- [ ] Repo `README.md` documents the cache directory, the `AIRBOSS_HANDBOOK_CACHE` env var, and the "git lfs install is not currently required" note.

## Future considerations

The user has explicitly chosen to drop these (per CLAUDE.md "no undecided considerations for future work"):

- **CI bandwidth budget for LFS pulls.** Not a problem because there is no LFS traffic.
- **Edition GC.** Cache directory grows by one source PDF per edition per handbook. At ~75-260 MB per PDF and FAA's edition cadence (5-20 years), the cache stays under 5 GB on Joshua's laptop indefinitely. No GC needed.
- **Sibling-repo escape hatch.** Considered and rejected in [context.md](./context.md). Not a deferred decision.
- **Day-zero LFS migration playbook.** Documented above in "What flips Flavor D to actual LFS." Not a deferred decision; the steps are listed when the trigger fires.
