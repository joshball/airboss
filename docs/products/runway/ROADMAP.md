# Runway -- Roadmap

## Phase 4a -- Foundation `[DONE]`

Infrastructure, public pages, catalog, checkout, email auth.

- [x] App shell + auth (WP-A)
- [x] Marketing pages (WP-B)
- [x] Course catalog + module detail (WP-C)
- [x] Payment stub + checkout (WP-D)
- [x] Email verification, password reset, magic link (Resend)
- [x] 8-category code review + fixes

Plan: [20260329-PHASE4-RUNWAY-PLAN.md](../../.archive/work/plans/phase-4a/20260329-PHASE4-RUNWAY-PLAN.md)
Reviews: `docs/.archive/work/reviews/phase-4a/`

## Phase 4b -- Payment Integration (Future)

Replace payment stub with real provider (Stripe or similar).

- [ ] Provider selection + ADR
- [ ] Webhook handling
- [ ] Subscription vs one-time model decision
- [ ] Refund flow
- [ ] Receipt generation
- [ ] Require email verification (flip flag)

## Phase 4c -- Polish (Future)

- [ ] Analytics / conversion tracking
- [ ] A/B testing infrastructure
- [ ] Social auth (Google)
