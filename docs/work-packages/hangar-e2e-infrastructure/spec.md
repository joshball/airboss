---
id: hangar-e2e-infrastructure
title: 'Hangar Playwright e2e infrastructure'
product: hangar
category: platform
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-04-30
owner: agent
depends_on: []
unblocks: []
tags: [e2e, testing, hangar]
legacy_fields:
  feature: hangar-e2e-infrastructure
  type: spec
---

# Spec: Hangar Playwright e2e infrastructure

Stand up Playwright e2e coverage for the hangar app. Today `playwright.config.ts` targets the study app only -- single project, single auth state (learner), single dev server. Hangar admin-write WPs (audit explorer, users editing, future invite flow, future moderation) need browser-level coverage but each currently defers it because the per-WP cost of building hangar test infrastructure is bigger than the WP itself.

This WP builds the infrastructure once so every later hangar WP can ship e2e coverage as routine work.

## Why this WP exists

Two WPs have already shipped to main without their planned Playwright coverage:

- `hangar-audit-explorer` -- ratified spec lists Playwright e2e for list smoke / filter round-trip / detail render / ADMIN-only redirect. Shipped in PR #365 with the e2e tests deferred.
- `hangar-users-editing` -- ratified spec lists Playwright e2e for typed-gate / role assign / ban + login-blocked / revoke-induced logout / last-admin guard / self-target rejection. Shipped with manual test plan + BC unit + component unit coverage; e2e deferred.

Both deferrals are honest -- the integration coverage rides on the manual test plans documented in each WP's `test-plan.md`. But manual coverage doesn't catch regressions automatically. Once this WP lands, both deferred suites can be authored in follow-up PRs.

## In Scope

1. **Playwright project for hangar.** Add a `hangar` project to `playwright.config.ts` alongside the existing `chromium` (study) and `chromium-unauthed` projects. Same browser, separate `baseURL`, separate `storageState`, separate `testMatch`.
2. **Hangar admin auth seed.** Extend `tests/e2e/global.setup.ts` (or factor a shared helper) to seed an admin user, sign in via better-auth's password handler, and persist the storage state to `tests/e2e/.auth/hangar-admin.json`. The seed must be idempotent so re-runs don't error on duplicate inserts.
3. **Hangar dev-server orchestration.** Today the `webServer` block boots `bun run dev` (which boots all four apps in parallel). Verify the parallel mode actually exposes hangar on its port; if not, extend the config to launch hangar explicitly.
4. **Hangar test directory.** New `tests/e2e/hangar/` housing all hangar specs. Pattern matches study (which currently has its specs at the top level of `tests/e2e/`, but a subdirectory makes the project boundary clearer).
5. **Smoke spec.** A single hangar spec proving the infra works: sign in as admin, navigate to `/users`, verify the directory renders, sign out. Useful as the canary for any future hangar suite breakage.
6. **Document the pattern.** Add a section to `docs/agents/best-practices.md` (or a new `docs/agents/hangar-e2e.md`) covering how to author a hangar e2e spec: where to put it, how to use the auth state, how to wait for server-rendered data, common gotchas.

## Out of Scope (explicit)

- **Authoring the deferred suites.** This WP gets the infrastructure to green. The audit-explorer + users-editing e2e suites land in their own follow-up PRs once the infrastructure is available.
- **Multi-role auth fixtures.** This WP seeds one admin. Author / operator / learner fixtures for negative-path tests (the redirect-on-403 scenarios) come in a follow-on if the per-spec inline cost gets painful.
- **Cross-app e2e tests.** Specs that walk between hangar and study (e.g. an admin promotes someone in hangar; the user logs into study and sees the new role) are a power-user pattern. Not needed for v1.
- **CI integration.** This WP gets local + manual `bun run test:e2e` passing. CI wiring is a separate concern.

## Acceptance

- `playwright.config.ts` has a `hangar` project; `bun run test:e2e -- --project=hangar` runs the hangar smoke spec end-to-end against a local `bun run dev`.
- `tests/e2e/.auth/hangar-admin.json` is regenerated idempotently by the global setup. Adding `--project=hangar` to a clean clone (`bunx playwright test --project=hangar`) does not error on first run.
- `bun run test:e2e` runs both the study and hangar projects and both pass.
- The smoke spec asserts: `/login` -> sign in as admin -> redirect to hangar dashboard -> click /users -> directory renders. ~30 lines.
- A `docs/agents/hangar-e2e.md` (or section in `best-practices.md`) describes how to write a hangar e2e spec.

## Triggers

This WP is the **prerequisite** for two deferred suites:

- `hangar-audit-explorer-e2e` (the WP that lands the deferred Playwright coverage from PR #365).
- `hangar-users-editing-e2e` (the WP that lands the deferred Playwright coverage from this current users-editing WP).

The user can prioritise this when either deferred suite becomes load-bearing -- e.g. a regression slips past manual smoke and the engineering value of automated coverage starts to outweigh the infra build cost.

## References

- [hangar-audit-explorer](../hangar-audit-explorer/spec.md) -- first deferred consumer
- [hangar-users-editing](../hangar-users-editing/spec.md) -- second deferred consumer
- `tests/e2e/global.setup.ts` -- existing study auth seed; pattern to mirror
- `playwright.config.ts` -- where the new project lands
