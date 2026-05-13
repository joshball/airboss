---
title: 'Spec: Appearance — Dark Mode'
feature: appearance-dark-mode
type: spec
status: unread
review_status: pending
---

# Spec: Appearance — Dark Mode

Ship real dark palettes for `airboss/default`, `study/sectional`, `study/flightdeck`. User-facing appearance toggle (system/light/dark) in the identity menu. Cookie persistence. Honors `prefers-color-scheme` when set to system.

This is the payoff for everything before it.

## Goal

- Every role token has a real dark value in OKLCH.
- Appearance toggle in the nav's identity menu: three options (System / Light / Dark), radio-style.
- Choice persists to `appearance=light|dark|system` cookie (not localStorage; server must read it for SSR).
- Server sees the cookie and sets `data-appearance` on first response.
- Pre-hydration script reconciles system appearance with user preference.
- Contrast tests pass WCAG AA on every (theme × appearance) × required-role-pair.
- No FOUC: dark users see dark from first paint, always.

## Dark palette design

- Use OKLCH for all values. Same hues as light, inverted lightness + adjusted chroma.
- Design surfaces for dark:
  - `surface-page` — near-black, not pure black (OKLCH ~0.12 L).
  - `surface-panel` — slightly lighter than page.
  - `surface-raised` — a touch lighter still.
  - Inverted ink: `ink-body` high lightness (~0.92).
- Action/signal roles: dark-mode-appropriate intensity. Hover/active derivations lighten rather than darken.
- Focus ring: higher chroma in dark to stay visible.

## Appearance toggle UI

In `apps/study/src/routes/(app)/+layout.svelte` identity menu panel: a form posting to `/appearance` (new endpoint) with a three-option radio group (`system`/`light`/`dark`). Submit via fetch; on success update document attribute without reload.

`/appearance` form action: sets cookie (`appearance=<value>; Path=/; Max-Age=31536000; SameSite=Lax`); returns 204.

System option: cookie set to `system`; client-side script reads `prefers-color-scheme` on page load + on media-query change.

## Server-side read

In `apps/study/src/hooks.server.ts`, read `appearance` cookie; set `event.locals.appearance` to `'light' | 'dark' | 'system'`. Route `(app)/+layout.server.ts` passes it to the layout. Layout passes it to `<ThemeProvider>`.

For `system`, server can't know the client's system preference — the pre-hydration script handles it, and the server renders assuming light (safe default). The attribute flip is instant pre-hydration, so there's no visible flicker.

## Non-goals

- High-contrast mode (future package).
- Custom color schemes per user (future).
- Per-route appearance override.

## Acceptance

- Toggle works: choose dark, reload, still dark.
- Toggle works: choose system, system in dark, page is dark; switch system to light, page goes light without reload.
- Contrast tests pass on every role pair per [04-VOCABULARY.md](../../../platform/theme-system/04-VOCABULARY.md).
- No FOUC on any route, either appearance.
- Lighthouse contrast score 100 on key routes.
- UX: dark palette feels intentional, not a sloppy invert.
