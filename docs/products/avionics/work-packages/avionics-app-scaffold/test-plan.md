---
title: 'Test plan: Avionics App Scaffold'
product: avionics
feature: avionics-app-scaffold
type: test-plan
status: done
review_status: done
---

# Test plan: Avionics App Scaffold

Manual-only. The scaffold has no scored or persisted product feature; the point is that the surface is alive, the chrome is the airboss platform, the BC contract imports cleanly, and every PFD instrument responds to input. Test IDs use the `AV` prefix.

## Prerequisites

- `/etc/hosts` entry: `127.0.0.1 avionics.airboss.test` (run `bun run setup` to surface the missing line)
- DB running: `bun run db up` (only required so the auth path resolves; the demo doesn't write rows)
- Dev users seeded if you want to test the signed-in path: `bun run setup`

## Boot and routing

| ID   | Scenario                                                | Expected                                                                                   |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AV-1 | `bun run dev avionics`                                  | vite boots on port 9630; the printed URL is `https://avionics.airboss.test`                |
| AV-2 | Visit `https://avionics.airboss.test/` while signed out | 302 redirect to `/pfd`; PFD page renders without an auth wall (anonymous OK)               |
| AV-3 | Visit `/pfd` directly                                   | PFD renders; chrome shows `airboss / avionics` brand label and a (locked) theme picker     |
| AV-4 | Visit `/pfd` with a stale dev session cookie            | Page renders identically; signed-in name/role appears in chrome instead of the auth banner |
| AV-5 | `bun run dev` (multi-spawn)                             | study, sim, hangar, avionics all boot; their four URLs print at startup; each renders      |

## BC package wiring

| ID   | Scenario                                                           | Expected                                                                                   |
| ---- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| AV-6 | `bunx tsc --noEmit -p apps/avionics/tsconfig.json`                 | Clean. `import type { Attitude, AirData, NavData } from '@ab/bc-avionics'` resolves        |
| AV-7 | Same import added temporarily to `apps/sim/src/lib/server/auth.ts` | Resolves cleanly (proves the alias is wired across all sibling apps); revert before commit |
| AV-8 | `bun run check`                                                    | 0 errors, 0 warnings                                                                       |

## Auth paths (cross-subdomain bridge to study)

Mirrors sim's auth model -- avionics doesn't host login.

| ID    | Scenario                                                 | Expected                                                                                 |
| ----- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AV-9  | Click "Sign in via study" in the auth banner from `/pfd` | Cross-subdomain navigation to `https://study.airboss.test/login?redirectTo=...`          |
| AV-10 | Sign in on study, return to avionics                     | The `bauth_session_token` cookie is recognised; auth banner gone; chrome shows your name |
| AV-11 | Sign out on study, reload avionics                       | Auth banner reappears; PFD continues to render normally                                  |
| AV-12 | Tamper with `bauth_session_token` cookie                 | Avionics renders anonymously without a 500; banner reappears                             |

## Theme

| ID    | Scenario                                                           | Expected                                                                                                         |
| ----- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| AV-13 | Visit `/pfd` -- read the `<html data-theme>` attribute in devtools | `data-theme="sim/glass"`, `data-appearance="dark"`                                                               |
| AV-14 | Open the theme picker                                              | Picker is in its locked variant with the same explanation chip the sim picker uses                               |
| AV-15 | Try to pick a non-locked theme                                     | The pick is recorded as a preference but the resolver still renders `sim/glass` with the locked-explanation chip |
| AV-16 | Set system appearance to light, reload                             | `data-appearance` stays `dark` (forced by the lock)                                                              |
| AV-17 | Re-run all `apps/sim/` theme picker tests                          | No regression in sim behaviour after the resolver generalisation                                                 |

## PFD rendering and feel

| ID    | Scenario                                       | Expected                                                                                                            |
| ----- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| AV-18 | Page first renders                             | All five instruments visible, defaults from spec applied (pitch 0, bank 0, ASI 100, ALT 3000, HDG 360, VSI 0)       |
| AV-19 | Drag the pitch slider full range               | Pitch ladder slides smoothly; horizon stays parallel to the bank line; pitch labels readable at every 10deg         |
| AV-20 | Drag the bank slider full range                | Bank pointer rotates; sky-blue and ground-brown halves rotate; pitch ladder rotates with bank (combined gimbal)     |
| AV-21 | Drag the airspeed slider through the arc bands | Boxed readout updates 1:1 with slider; arc-band coloration on the tape edge is visible at white/green/yellow/red    |
| AV-22 | Drag the altitude slider                       | Hundreds digits roll smoothly; thousands digit rolls when crossing a thousand-foot boundary                         |
| AV-23 | Drag the heading slider through 0/90/180/270   | Compass strip slides; cardinal labels appear at the right positions; boxed readout matches slider value             |
| AV-24 | Drag the VSI slider                            | Pointer moves smoothly within +/-2000 fpm; ticks at +/-1000 fpm visible                                             |
| AV-25 | Set every slider to a target, release, observe | Rendered values converge to slider targets within ~1s with no overshoot; the easing reads as "settled" not "snappy" |
| AV-26 | Toggle browser tab to a different tab and back | rAF loop pauses while hidden (CPU profile drops); resumes on visibility return without a jump                       |
| AV-27 | Click `0` (reset) keyboard shortcut            | All sliders snap to defaults; instruments animate to defaults                                                       |
| AV-28 | Press `?`                                      | Keyboard legend overlay shows; press `?` again or `Esc` and it closes                                               |
| AV-29 | Walk every keyboard shortcut from spec         | Each shortcut adjusts the right slider in the right direction by the right amount                                   |

## Animation health

| ID    | Scenario                                            | Expected                                                                        |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| AV-30 | Open Performance devtools, record 5s of slider play | Frame budget under 16ms median, no dropped frames at the demo's primitive count |
| AV-31 | Resize the window from 800x600 to 1920x1080         | PFD scales smoothly; instruments stay legible at every size in the range        |
| AV-32 | Navigate from `/pfd` to `/` and back                | rAF loop cancelled on unmount; reactivated on remount; no console errors        |

## Theme tokens audit

| ID    | Scenario                                          | Expected                               |
| ----- | ------------------------------------------------- | -------------------------------------- |
| AV-33 | `grep -ER '#[0-9A-Fa-f]{3,8}' apps/avionics/src/` | Zero hits (every color through tokens) |
| AV-34  | `grep -ER 'href="/' apps/avionics/src/ \| grep -v routes.ts`         | Zero hits (every route through `ROUTES`)                                                  |
| AV-35  | `grep -ER 'localhost\|airboss.test' apps/avionics/src/`              | Zero hits (every host through `HOSTS`)                                                    |

## Browser matrix

| ID    | Browser          | Expected                                |
| ----- | ---------------- | --------------------------------------- |
| AV-36 | Safari (current) | Renders, sliders work, animation smooth |
| AV-37 | Chrome (current) | Renders, sliders work, animation smooth |

Firefox is not in the explicit matrix for the demo; it is expected to work but not blocking.

## Negative paths

| ID    | Scenario                                                   | Expected                                                                       |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AV-38 | Visit `/pfd` with the DB stopped                           | Page renders anyway (anonymous reads no DB); no 500                            |
| AV-39 | Push slider out-of-range via devtools (set state directly) | Instrument clamps at its visible-range limit; no NaN, no SVG transform error   |
| AV-40 | Disable JS                                                 | Page renders an explanatory non-interactive fallback or an empty SVG; no error |

## Automated checks

- `bun run check` clean (svelte-check, biome)
- `bunx biome check .` clean
- No new e2e tests in this WP (Playwright e2e for avionics drills lands with the first scored drill WP); the manual happy path in AV-1..AV-29 substitutes

## Definition of done

- [ ] All AV-* items pass against the implemented branch
- [ ] User has signed in once via study and confirmed the cross-subdomain bridge works (AV-9..AV-12)
- [ ] User has played with all sliders and confirmed the PFD's gestural feel reads right (AV-18..AV-29) -- this is the subjective "is the surface alive?" check, and it's the one this WP exists to ship
- [ ] `bun run check` clean
