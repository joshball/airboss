---
title: 'ADR 018 context: Source artifact storage policy'
date: 2026-04-26
participants: Joshua Ball, Claude
---

# Context: Source artifact storage policy

The handbook ingestion WP (handbook-ingestion-and-reader) is the first ingestion pipeline airboss has shipped. It produces three kinds of artifact from one input PDF: section markdown, figure PNGs, and table HTML. The original spec gitignored the source PDFs entirely; the pipeline re-fetched from `faa.gov` on demand and committed only the derivatives.

That worked for one handbook. It does not work as a pattern. Future ingestion WPs are already named in the spec's "Out of scope" list ([handbook-ingestion-and-reader/spec.md](../../work-packages/handbook-ingestion-and-reader/spec.md#L54)): Pilot/Controller Glossary, Advisory Circulars, NTSB reports, POH excerpts, AIM. Each will produce a similar derivative set from a similar source artifact. The decision being made here is the rule for all of them, not just for handbook PDFs.

This ADR was rewritten on 2026-04-26 from an earlier draft that recommended GitHub LFS. Joshua pushed back: he is the only developer, won't pay for GitHub LFS storage, and won't run a self-hosted LFS server for $5/month either. The conversation explored what "keep the LFS protocol so it doesn't break and later we can deal with it" meant operationally, then settled on the configuration this ADR documents (Flavor D in the conversation: gitignore PDFs, cache locally, leave LFS plumbing dormant).

## Why an earlier "gitignore the PDF" plan was wrong

Three reasons surfaced during initial review:

1. **The FAA replaces and removes editions.** Handbook URLs change on edition bumps; older editions get removed from `faa.gov` within months of a new edition publishing. A pipeline that depends on the live URL becomes unable to regenerate a prior edition's extraction once that URL is gone. The markdown sitting in the repo becomes a frozen artifact whose source-of-truth no longer exists.
2. **`manifest.json` recorded `(url, sha256, fetched_at)` but not the bytes.** The SHA-256 only proves a PDF was *that one* if you still have a copy of it to verify against. Without committing the PDF or keeping it cached, the SHA was unverifiable in the future.
3. **The pattern repeats.** Every future ingestion WP faces the same question. Deciding "commit or not" per WP invites drift; one WP commits the source, another doesn't, and the audit story degrades over time.

Flavor D answers (1) and (2) by keeping the bytes in a developer-local cache and answering (3) with a uniform repo-wide rule.

## Why "commit the PDF inline as a regular blob" was rejected at scale

PDFs are large (50-261 MB each for FAA handbooks). The repo's current target list is PHAK + AFH + AvWX in v1 (~400 MB). The medium-term list adds IFH + IPH + AC 61-65 + ACS publications + AIM + a growing POH library. At the third or fourth handbook the inline-blob approach starts breaking:

- Pack-file performance degrades visibly past ~500 MB to 1 GB of binary blobs.
- GitHub's web UI struggles on diff views of large binaries (every PHAK / AFH PDF would render as "this file is too large to display").
- Every `git clone` pulls every edition of every handbook ever ingested, forever.

Flavor D sidesteps this entirely by keeping the bytes outside the repo.

## Why GitHub LFS was rejected for current airboss

GitHub LFS is the obvious "best practice" answer, and the original draft of this ADR recommended it. Joshua pushed back on three grounds:

- **Cost.** GitHub Free LFS gives 1 GB storage and 1 GB/month bandwidth. Three handbooks (~400 MB) consume 40% of the free storage; a single re-clone with LFS pulled consumes 40% of the monthly bandwidth. The next tier ($5/month per 50 GB pack) is cheap but Joshua doesn't want to pay for storage he doesn't yet need.
- **Single developer.** The "team needs reproducibility on a fresh clone" argument doesn't bind when the team is one person who already has the bytes locally.
- **Edition cadence.** FAA handbooks change every 5-20 years. The "we need pinned bytes for audit" argument is real but rare; manifest.json's SHA-256 plus a personal-cloud archive of source PDFs covers the audit case adequately.

## Why a self-hosted LFS server was rejected

Lightweight LFS servers exist (rudolfs, giftless, lfs-test-server) and run on a $5/month VPS or a Raspberry Pi. Joshua's pushback:

- Real ongoing maintenance for zero current payoff.
- Even a localhost LFS server has a "remember to start it before `git push`" footgun.
- "I don't want to throw money at MS [GitHub] for something I don't need" applies equally to "throw $5/month at a VPS for something I don't need."

## Why a custom file-system transfer agent was rejected

Git LFS supports custom transfer agents that bypass the HTTP protocol. A 30-line shell script can `cp` files to and from a directory of your choice; the LFS extension calls it for clean/smudge instead of speaking HTTP.

This was the technically clever answer. Rejected because:

- Per-developer config (lives in `.gitconfig`, not in the repo) means a fresh clone on a new machine doesn't "just work."
- "Did I remember to add the transfer agent before this `git push`?" is a real ergonomic cost.
- Nothing it provides over Flavor D's simpler "gitignore the PDFs, plumbing stays dormant" approach.

## Why "drop LFS entirely, no plumbing in `.gitattributes`" was rejected

Considered but rejected because the future flip becomes harder. With no `.gitattributes` line, "later we want LFS" requires:

1. Add `.gitattributes` filter line.
2. Add the source PDFs.
3. They go through the LFS clean filter (correct).
4. But `.gitattributes` was added *in a commit* -- if any prior history of the repo ever committed a PDF inline (even by mistake), that history doesn't get retroactively LFS-tracked. Migrating it requires `git lfs migrate import`, which rewrites history.

Keeping `.gitattributes` in place from day one means the LFS filter is always ready to activate. The future flip is "remove a gitignore line." No history rewrite, no surprise.

## Why "commit the PDFs inline now, migrate to LFS later" was rejected

The "ship simple, refactor later" answer. Rejected because:

- 400 MB of PDFs in the pack file isn't catastrophic, but it's ugly. Clones take longer for everyone forever, even if only Joshua ever clones.
- The migration to LFS later involves `git lfs migrate import`, which rewrites history. Doable, but a bigger ceremony than Flavor D's "remove a line from .gitignore."
- Pack-file degradation past 500 MB to 1 GB of binaries is a real concern for the medium-term corpus growth (10+ editions across many handbooks over the next decade).

## What the conversation actually settled on

The user's stated goal: "keep the LFS protocol so it doesn't break and later we can deal with it." Operationalized as:

- `.gitattributes` filter line stays (dormant plumbing for the future flip)
- `.gitignore` blocks the source PDFs from being staged
- Local cache directory holds the bytes
- `manifest.json` records SHA-256 + URL for the audit story
- No LFS server runs anywhere

This is "Flavor D" in the conversation. The decision document spells it out at the operational level.

## What the decision unblocks

- Handbook ingestion WP can land with all derivatives committed and source PDFs cached locally. No GitHub LFS spend, no self-hosted server, no custom transfer agent.
- Future ingestion WPs (AC, NTSB, POH, AIM, audio narration masters) follow the same rule mechanically: gitignored source files in cache, derivatives inline, generated artifacts out of repo.
- `docs/platform/STORAGE.md` becomes the canonical reference; agents and contributors consult it before adding a new content corpus.
- The day Joshua wants to flip to real LFS storage (because of a second contributor, CI, or an FAA URL break), the change is removing one `.gitignore` line and choosing where the LFS server lives. No re-architecture.

## Open questions resolved during this conversation

- **Per-corpus `.gitattributes` lines vs one wildcard?** Per-corpus. Each ingestion WP adds its own line, named by corpus (`handbooks/**/*.pdf`, `regulations/**/*.pdf`, etc). Keeps the rule explicit and discoverable; avoids accidentally LFS-tracking a stray PDF dropped elsewhere in the repo when the policy flips.
- **Where does the cache live?** `~/Documents/airboss-handbook-cache/` by default; overridable via `AIRBOSS_HANDBOOK_CACHE` env var. Outside the repo; not gitignored because it's not in the repo at all.
- **Where does extracted text live?** It *is* the markdown. There's no separate plaintext blob alongside the markdown; the markdown body is the canonical extracted text, and the section's `content_hash` SHA-256s the markdown file. Two artifacts (raw + formatted) was considered and rejected: it doubles the source-of-truth surface for no consumer.
- **Audio masters when audio surface lands?** Same pattern. Audio source files (WAV / FLAC) get a `.gitattributes` LFS filter line + `.gitignore` block + cache directory at `<cache>/audio/<doc>/<edition>/source.<ext>`; transcripts and segment timing JSON stay inline.

## ADR number history

This ADR was originally numbered 017. It was renumbered to 018 on 2026-04-26 because main merged a separate `017-firc-compliance-dormant.md` while this branch was unmerged.
