---
status: unread
review_status: done
---

# Section 2 review -- Weather + Content Authoring

10x-style review of the weather/encoded-text vertical plus the hangar
content-authoring app. Scope: `apps/hangar/`, `libs/bc/hangar/`,
`libs/bc/ingest-review/`, `libs/wx-engine/`, `libs/wx-charts/`,
`libs/wx-drill/`, `libs/wx-explain/`, `libs/content-census/`,
`libs/hangar-jobs/`, `libs/hangar-sync/` (~116k LOC).

Reviewer: Claude (Opus 4.7). Date: 2026-05-17.

## Summary

The code is broadly high quality: browser-safety contracts are documented
and held, the dual-gate auth contract is honoured on every `(app)` route,
the job queue's terminal-state transactions are sound, and the wx engines
are pure and deterministic. Findings below are mostly correctness bugs in
the truth-aware weather decoders and a pervasive house-style violation.

All findings fixed in this branch.

| Severity | Count |
| -------- | ----- |
| Major    | 3     |
| Minor    | 5     |
| Nit      | 4     |

## Major

### M1 -- METAR `M1/4SM` visibility is fabricated (wx-charts)

`libs/wx-charts/src/wx/metar/parser.ts` `tryParseVisibility` treats the
`M` prefix (ICAO "less than") by dividing the value by two:

```typescript
if (stripped.startsWith('M')) {
  const inner = stripped.slice(1);
  const v = fractionToNumber(inner);
  return v === null ? null : v / 2;   // <-- fabricates 0.125 for M1/4SM
}
```

`M1/4SM` means visibility is *less than* 1/4 SM. The FAA/NWS convention
reports it at the threshold value (0.25). Halving it invents `0.125 SM`,
a value that never appeared in the observation. In a weather-decoding
library where accuracy is pedagogically load-bearing this is a real bug:
it shifts the flight-category boundary and the decoded annotation.

Fix: drop the `/ 2`; `M`-prefixed visibility decodes to the threshold
value. The `wx-explain` decode line carries the "less than" qualifier
where it belongs (prose), not the numeric field.

### M2 -- Convective `why` line never fires for CB clouds (wx-explain)

`libs/wx-explain/src/metar.ts` `attachWhy` checks
`a.family === 'sky-cb'`, but `describeClouds` never assigns the family
`sky-cb` -- the METAR parser discards the `CB`/`TCU` cloud-type tag
(documented v1 gap in `metar/types.ts`). The branch is dead: the
truth-aware "CB layer marks the convective cell directly over the
station" annotation can never be produced.

This matters because truth-aware generators are a first-class pedagogy
concept; a synoptic `why` that silently never renders is a stub.

Fix: capture the `CB`/`TCU` modifier into `CloudLayer.cumulonimbus`
(additive optional field; the parser regex already matches it but
discards it), and tag CB layers `sky-cb` in `describeClouds`.

### M3 -- Convective `why` skips moderate thunderstorms (wx-explain)

Same file: the TS convective `why` is gated on
`a.family === 'wx-heavy' && a.token.includes('TS')`. A moderate `TSRA`
gets family `wx-descriptor-combo` (it contains `TS` and is longer than
two chars), so a station sitting under a moderate thunderstorm with a
convective cell in the truth model never receives the synoptic `why`.
The driver should attach to any TS-bearing weather token regardless of
intensity prefix.

Fix: gate the convective `why` on "token contains `TS`" rather than the
`wx-heavy` family.

## Minor

### m1 -- Raw `err.message` leaked to client on a 500 (hangar)

`apps/hangar/src/routes/(app)/glossary/sources/+page.server.ts`
`syncAll` action:

```typescript
return fail(500, { error: err instanceof Error ? err.message : '...' });
```

A failed `enqueueJob` (DB error) surfaces its raw message to the browser.
Per `common-pitfalls.md` "Never leak `err.message` to the client": log
the raw error via `createLogger`, return a fixed user string.

### m2 -- Unhandled BC throw produces a full-page 500 (hangar)

`apps/hangar/src/routes/(app)/ingest-review/[issueId]/+page.server.ts`:
the `applyOverride(...)` call at the end of the action handler is not
wrapped in `try/catch`. A DB error there throws past the action and
renders a full-page 500, kicking the operator out of the review flow.
Wrap it; return `fail(500, ...)` with a fixed string.

### m3 -- Orphan recovery re-queues live jobs (hangar-jobs)

`libs/hangar-jobs/src/recoverOrphanedRunning` flips *every* `running`
row to `queued` on worker boot, ignoring `lastHeartbeatAt`. If a second
worker handle is started while the first is mid-job (the API explicitly
supports multiple handles, and tests create them), recovery steals the
live job's row and it runs twice. Recovery must only re-queue rows whose
heartbeat is stale (older than a generous multiple of the poll interval)
or null.

### m4 -- `err.message` returned as `formError` on `NotFoundError` (hangar)

`glossary/[id]` and `glossary/sources/[id]` delete actions return
`fail(404, { formError: err.message })`. `NotFoundError.message` is a
BC-controlled string so the exposure is low, but it is inconsistent with
the fixed-string pattern used for the 409/500 paths in the same handler.
Use a fixed user string.

### m5 -- Token hole: `--type-ui-section-size` does not exist (hangar)

`content/[corpus]`, `content/`, `roadmap/`, `roadmap/[wp_id]` all write
`font-size: var(--type-ui-section-size, 1.25rem)` (and `1.1rem`).
`--type-ui-section-size` is not defined anywhere in `libs/themes`, so
every one of these ships the raw `rem` literal via the fallback. Route
to a real token: `--type-heading-3-size` for `h2`-level headings,
`--type-reading-lead-size` for lead paragraphs.

## Nit

### n1 -- `honest`/`dishonest` in agent-voice code comments (convergent)

~40 occurrences across `libs/content-census/` (adapters, types, server,
~9 test names), `libs/bc/hangar/src/review.ts`, and four hangar route
files use "honest"/"dishonest" in code comments and test descriptions.
House rule (CLAUDE.md, `common-pitfalls.md` grep list, MEMORY) bans the
word in agent voice including code comments; the word implies prior
dishonesty. Reword to "accurate"/"truthful"/"non-fabricated"/"a
deliberate placeholder". The design.md section name `"Placeholder
honesty"` stays as a citation.

### n2 -- Dead clause in METAR wind sensor-out check (wx-charts)

`parser.ts` line 98: `/^\/{3,}KT$/.test(t) || t === '/////KT'` -- the
`=== '/////KT'` arm is already covered by the regex. Drop it.

### n3 -- Magic number `12` for default TAF valid-hours (wx-engine)

`engine.ts:143` and `validate/consistency.ts:264` both inline
`truth.tafValidHours ?? 12`. Promote to a `@ab/constants`
`WX_DEFAULT_TAF_VALID_HOURS` constant.

### n4 -- Magic conversion factor `1.94384` (wx-charts)

`parser.ts:85` inlines `1.94384` for MPS->knots. `@ab/constants` already
exports `MPS_TO_KNOTS` (`1.943_844_492`, more precise). Use it. The
hPa->inHg factor `0.02953` has no constant; add `HPA_TO_INHG`.

## Notes (no action -- verified correct)

- `flightCategory` in `wx/rules.ts`: the FAA four-tier boundaries
  (LIFR/IFR/MVFR/VFR ceiling + visibility cutoffs) are correct, inclusive
  edges in the right places.
- `sampleTruthAt` (`truth/time.ts`): the v1-identity property holds; the
  `endAt`-inclusive hazard-zone boundary logic is correct.
- File-serving endpoints (`download`, `files/raw`, `thumbnail`): path
  escape is defended in depth (prefix check after `resolve`, plus an
  early `..` reject). `git.ts` spawns with an argv array and no shell --
  no command injection.
- The job worker's terminal-state transactions (`commitTerminal`,
  `cancelJob`, `enqueueJob`, `appendJobLog`) are atomic and correctly
  gated; the seq-allocation row-lock strategy is sound.
- `resolveKnowledgeNodeId` joins an authored `dir` into a path; a
  charset guard on `dir` was added as defence-in-depth (build-time
  authored content, low risk, but cheap to harden).
</content>
