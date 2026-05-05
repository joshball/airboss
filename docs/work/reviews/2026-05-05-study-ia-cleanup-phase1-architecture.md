# Architecture review -- study-ia-cleanup Phase 1

issues_found: 2

## AR-1 (minor) -- `Tooltip` glossary resolver is the third such inversion in `libs/ui` and the pattern deserves consolidation

`libs/ui/src/lib/tooltip-glossary-resolver.ts` mirrors `libs/ui/src/lib/info-tip-resolver.ts` near-identically; both invert the `ui -> help` dependency by having the consuming app register a resolver at boot. We now have two parallel resolver registries. A third one (the deferred number-explainer popover from spec.md `Q10`) is on the roadmap.

This is an emerging pattern, not a bug. Capture it before the third instance lands:

- Generalize to one `setUiResolver(kind, resolver)` registry keyed by a `UI_RESOLVER_KINDS` enum.
- Or document the inversion convention in `docs/agents/best-practices.md` so future `libs/ui` authors don't re-derive it.

Per CLAUDE.md "no undecided considerations": pick one in this slice.

## AR-2 (info) -- `apps/study/src/routes/api/page-explainer/+server.ts` lives in the study app, but the underlying mechanism is app-agnostic

The API route is in `apps/study/`, the BC helpers are in `libs/bc/study/`, and the `<PageExplainer>` component is in `libs/ui/`. If `apps/sim/` or `apps/hangar/` want to mount an explainer tomorrow, they'll need to either duplicate the `+server.ts` or share it.

Two sane futures:

- Promote `+server.ts` into `libs/ui/` once a second app needs it. Today there is exactly one consumer.
- Park it in `study/` and copy on demand; the BC helper is already shared.

This is a "the second use will tell us" question. No fix in this slice; flag in the dispatcher report so a Phase 2 reviewer doesn't redo the analysis.
