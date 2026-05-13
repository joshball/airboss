---
title: 'Spec: UI Primitives'
feature: ui-primitives
type: spec
status: unread
review_status: pending
---

# Spec: UI Primitives

Close primitive gaps and ship the missing primitives that `apps/study` needs before page migration (#5). Combines what were originally two packages (ui-contract-pass + ui-primitives-forms-data) into one — primitive work is primitive work; splitting contract fixes from net-new primitives produced two small reviews when one reviewer owns the whole surface.

## Scope

### Part A: contract fixes on existing primitives

**Shared tone enum:**

- Badge, StatTile, Banner, and future Alert/Toast accept `tone: Tone` from `@ab/themes/tones`.
- StatTile widens to full tone set (`default | primary | success | warning | danger | info | muted | accent`).
- `neutral` aliased to `default` with TODO for migration in #5.

**Size variants:**

- `TextField` gains `size: 'sm' | 'md' | 'lg'`.
- `Select` gains same.
- `Badge` gains `lg` (currently `sm | md`).

**Control-height tokens:**

- `--input-height-{sm,md,lg}`, `--button-height-{sm,md,lg}`, `--badge-height-{sm,md,lg}` added to chrome emission.

**Primitive micro-hardcodes (from UX review):**

- `Badge.svelte` — `min-height: 1rem`/`1.25rem` → `--badge-height-*`.
- `KbdHint.svelte` — `min-width: 1.25rem`/`min-height: 1.1rem`/`text-underline-offset: 2px` → tokens (new `--underline-offset-2xs` if needed).
- `ConfidenceSlider.svelte` — `min-width: 5rem`/`text-underline-offset: 2px` → tokens.

**Barrel export:**

- `libs/ui/src/index.ts` exports prop types (`ButtonVariant`, `ButtonSize`, `BadgeTone`, `BadgeSize`, `TextFieldSize`, etc.) and re-exports `Tone`.
- Components still imported by file path to preserve the no-Svelte-runtime-leak contract.

### Part B: new primitives

**Forms:**

- **Dialog** — headless + styled. Snippets for header/body/footer. Controlled open. Focus trap. ESC-to-close. Scrim (`--overlay-scrim`). Component tokens `--dialog-*`.
- **FormField** — wraps label + input + help + error. Props: `label`, `help?`, `error?`, `required?`, `for?`. Sets `aria-describedby` on slot.
- **Checkbox** — label-associated; states: default/checked/indeterminate/disabled/error; size variants.
- **Radio** + **RadioGroup** — group owns name+value; members are Radio; arrow-key navigation.

**Data:**

- **Table** — `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>`, `<TableHeaderCell>`. Hover, selected-row states. Optional sticky header. Component tokens `--table-*`.
- **Spinner** — indeterminate. `size: 'sm' | 'md' | 'lg'`. `tone: 'default' | 'inverse'`. Respects `prefers-reduced-motion`.
- **Divider** — horizontal/vertical. `inset` prop. Uses `--edge-default`.
- **Tabs** — tab list + panels. Keyboard nav (Arrow, Home, End). Active state via `--action-default-wash` + `--action-default-edge`.

## Non-goals

- Toast (defer; no page needs queued notifications yet).
- Tooltip, Breadcrumb, Accordion (defer).
- Page migration (#5).

## Acceptance

- All 12 existing primitives updated with contract fixes.
- 8 new primitives built, typed, accessible.
- Every `<style>` block passes the (upcoming) lint rule — no hardcoded values.
- Dev demo page at `apps/study/src/routes/(dev)/primitives/+page.svelte` exercises every primitive.
- Each new primitive: Vitest unit test covering happy path + keyboard interaction; Playwright smoke for flow.
- `bun run check` clean.
- Visual regression: existing primitives pixel-identical on study routes (only new props are additive; defaults unchanged).
