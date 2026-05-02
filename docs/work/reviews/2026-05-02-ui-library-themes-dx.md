---
feature: ui-library-themes
category: dx
date: 2026-05-02
branch: main
status: unread
review_status: pending
counts:
  critical: 0
  major: 4
  minor: 7
  nit: 5
---

## Summary

Reviewed `libs/ui`, `libs/themes`, `libs/activities`, `libs/help` from a "2am on-call debugging" lens: prop names, error messages, defaults, log signal, console-log behaviour, composability. Overall the libraries are unusually well-documented for a young project: every primitive opens with a comment block that explains the role-token contract, the a11y model, and how it composes into the rest of the system. Error messages from the theme registry (`getTheme`) and the help-page validator are the gold standard - actionable, named, and include the available alternatives. Test data hooks (`data-testid`, `data-state`, `data-variant`) are consistent across UI primitives, which makes Playwright failures easy to read.

The findings cluster into three real DX problems, plus a handful of polish items:

1. Three of four `package.json` files in scope (`@ab/themes`, `@ab/help`, `@ab/activities`) lack an `exports` field even though their `index.ts` JSDoc documents specific subpath imports (`@ab/themes/picker/ThemePicker.svelte`, `@ab/themes/generated/tokens.css`, `@ab/help/ui/HelpLayout.svelte`, `@ab/activities/<surface>/Component.svelte`). `@ab/ui` is the only one with the contract written down in `package.json`. The pre-hydration.ts header comment specifically calls out an outage caused by this exact category of resolution ambiguity.
2. `libs/themes/contrast.ts#luminance` returns `0` silently for unparseable input (`return 0; // defensive`). When a contrast test fails, the failure says "ratio 1.05" - it doesn't tell you which input the parser rejected. At 2am that turns into a 10-minute "wait, the color IS valid" debugging detour.
3. `Dialog.svelte` and `Drawer.svelte` and `ConfirmAction.svelte` allocate a fresh `createFocusTrap(panelEl, ...)` object inside the `keydown` handler every keystroke. Functionally correct, but it makes the focus-trap module's lifecycle harder to reason about than the JSDoc suggests (the doc implies the trap is built once and detached on close).

No critical issues found. The architecture is sound; the concerns are about predictability and self-explaining errors when something does break.

## Issues

### MAJOR: `@ab/themes`, `@ab/help`, `@ab/activities` ship documented subpath imports without an `exports` field

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/package.json`, `/Users/joshua/src/_me/aviation/airboss/libs/help/package.json`, `/Users/joshua/src/_me/aviation/airboss/libs/activities/package.json`

Problem: All three packages document subpath consumption in their `index.ts` headers:

- `libs/themes/index.ts:7-14` says "import ThemeProvider from '@ab/themes/ThemeProvider.svelte'" and "import '@ab/themes/generated/tokens.css'".
- `libs/themes/picker/pre-hydration.ts:22-31` describes a real production outage caused by Vite preferring a sibling `pre-hydration.js` over the `.ts` for `@ab/themes/generated/pre-hydration` because the path was unmediated by `exports`.
- `libs/help/src/index.ts:7-8` says "import HelpLayout from '@ab/help/ui/HelpLayout.svelte'".
- `libs/activities/src/index.ts:5-9` says "imported by the knowledge-learn surface via '@ab/activities/<activity>/Component.svelte'".

But the `package.json` files have **no** `exports` field. They rely on bundler heuristics (file-system fallthrough). `libs/ui/package.json` is the only one that uses `exports` to pin subpaths to `./src/components/*`, `./handbooks/*`, etc. The asymmetry means new contributors importing from `@ab/themes` or `@ab/help` will at best see inconsistent behaviour vs. `@ab/ui`, and at worst hit the same `.js`-vs-`.ts` ambiguity that pre-hydration.ts already documents as a shipped bug.

Fix: add an `exports` map to all three packages mirroring the `@ab/ui` pattern. For `@ab/themes`:

```json
{
  "exports": {
    ".": "./index.ts",
    "./ThemeProvider.svelte": "./ThemeProvider.svelte",
    "./picker/*": "./picker/*",
    "./generated/*": "./generated/*",
    "./study/*": "./study/*",
    "./sim/*": "./sim/*"
  }
}
```

Same pattern for `@ab/help` (`./ui/*`, `./schema/*`) and `@ab/activities` (`./pfd/*`, `./cockpit-panel/*`, `./crosswind-component/*`). This makes the contract self-explanatory and prevents the resolution-order bug class.

### MAJOR: `luminance()` swallows parse failures and returns 0

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/contrast.ts:204-212`

Problem: `luminance(value)` returns `0` for any string the parsers reject. The comment says "Returns 0 for unparseable input (defensive; callers decide whether to treat that as a test failure)". In practice every caller is the contrast-matrix test or `contrastRatio()`, neither of which can distinguish "the color is genuinely black" from "the parser rejected the string". When a contrast assertion fails ("expected ratio >= 4.5, got 1.05"), the test output gives no signal that the actual cause is a malformed token value (`var(--foo)`, an `oklch()` with a stray space, an `hsl()` value the lib never claimed to support). At 2am the debug path is "log every input by hand and find the one that doesn't parse" instead of "read the failure".

Fix: split the surface. Keep `luminance(value)` returning a `number` for hot paths but add a `luminanceStrict(value)` (or change the return to `number | undefined`) and use the strict form in `contrastRatio()`. When `contrastRatio` sees a failed parse it should throw with the offending input quoted: `throw new Error(\`contrastRatio: cannot parse color '${foreground}'\`)`. Tests then fail with the actual cause on the first run.

### MAJOR: Focus-trap allocated per keystroke in Dialog / Drawer / ConfirmAction

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Dialog.svelte:49-53`, `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Drawer.svelte:62-66`, `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmAction.svelte:81-88`

Problem: Each `handleKeyDown` runs `const trap = createFocusTrap(panelEl, { onEscape: ... }); trap.handleKeyDown(event);`. A fresh trap object is created per keystroke. The `focus-trap.ts` module documents `release()` as "Reserved for future teardown. Kept on the interface so callers have a symmetric lifecycle even when there's nothing to tear down" - the design clearly anticipates a per-mount lifecycle, but the consumers don't honour it. The semantic mismatch is the DX risk: if a future change adds a real document listener inside `createFocusTrap`, every Dialog/Drawer/ConfirmAction will leak a listener per keystroke without any error surface to catch it. Today's behaviour is correct because `release()` is a no-op, but the contract is fragile - a maintenance change to `focus-trap.ts` triggers silent regressions across three consumers.

Fix: build the trap once when the panel mounts (inside the existing `$effect`), store it in component-local state, and reuse it across keypresses. Call `trap.release()` in the effect's cleanup. This is the lifecycle the helper already documents; aligning the consumers eliminates the trap door.

### MAJOR: `PageHelp` and `InfoTip` silently render nothing for unknown ids in production

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/PageHelp.svelte:52-57,110`, `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte:76`

Problem: When a page mounts `<PageHelp pageId="some-typo">`, the component logs a `console.warn` in `import.meta.env.DEV` and renders nothing (`{#if exists && helpPage}`). In production no warning fires and the help affordance just disappears - users notice the missing button, authors don't notice the broken id. This is a content-pipeline blind spot: a page's `pageId` is a hand-typed string, so typos are likely, and the dev-only warn doesn't survive to the environment where regressions actually surface (preview deploys, prod). The validator catches build-time orphans, but route-mounted ids are excluded from orphan detection (`opts.routeMountedIds`), so a typo'd route mount has no validator coverage at all.

Fix: pick one of two approaches and commit. Either (a) make `PageHelp` render a visible authoring-error chicklet when the id misses (e.g. `[?] missing help: <id>` styled in `--signal-warning`) so authors notice on every preview, or (b) emit a `data-help-missing="<id>"` attribute on a zero-size element so a Playwright assertion (`expect(page.locator('[data-help-missing]')).toHaveCount(0)`) can guard the production build. Option (a) is the lower-effort fix and gives authors the fastest signal.

### MINOR: `Banner.svelte` dismiss button is a literal lowercase `x`

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Banner.svelte:49`

Problem: `>x</button>`. The aria-label is "Dismiss" so screen readers are fine, but visually a lowercase `x` in a banner reads as a glyph rather than a close button - users learn to recognise `×` (multiplication sign U+00D7) or an icon. The character also collapses to the surrounding font's lowercase x metrics, making the click target visually different per theme.

Fix: use `&times;` (or `×`) for the visual glyph. Same correction belongs in any other primitive that ships a literal close character - grep for `>x</button>` showed only this one site.

### MINOR: `themeToCss` error doesn't list available appearances

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/emit.ts:481-483`

Problem: `throw new Error(\`Theme ${theme.id} has no palette for appearance ${appearance}\`)`. Compare to `registry.ts:29` which does `throw new Error(\`Unknown theme: ${id}. Registered: ${known}\`)` - the latter tells you what to try next. A theme author seeing "no palette for appearance dark" doesn't get told "this theme declares appearances: ['light']" without going to read the source.

Fix: extend the message to `\`Theme ${theme.id} has no palette for appearance '${appearance}'. Declared: ${theme.appearances.join(', ')}.\``.

### MINOR: `forcedAppearanceFor` only checks one theme; new forced themes silently fall through

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/resolve.ts:96-103`, `/Users/joshua/src/_me/aviation/airboss/libs/themes/picker/pre-hydration.ts:101`

Problem: `pre-hydration.ts` hardcodes `var forcedDark = theme === '${SIM_THEME}'`. The comment two lines up says "if another theme joins the forced set, surface it via a named export here so this script picks it up at codegen time" - but no such export exists, and there's no test that the pre-hydration script stays in sync with `FORCED_APPEARANCE_BY_THEME`. The next person who adds a forced theme will follow the documented `FORCED_APPEARANCE_BY_THEME` map, run `themes:emit`, and ship a pre-hydration script that quietly ignores their addition. The bug surfaces as a brief light-mode flash on first paint - hard to attribute to this script.

Fix: export `FORCED_APPEARANCE_BY_THEME` (today private) from `resolve.ts`, have `pre-hydration.ts` build a JS allow-table from it (`var forced = { 'sim/glass': 'dark' }; var forcedAppearance = forced[theme];`), and add a determinism test that confirms every entry in the TS map appears in the generated script body.

### MINOR: `helpRegistry.search` ignores `parsed.filters` when freeText is empty + filters nonempty

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/registry.ts:68-85`

Problem: `rankHelpPage` returns bucket 3 when needle is empty and filters were applied. That's fine - but the same registry's `search` then returns those bucket-3 results, which `searchHelp` in `search.ts:210-215` does honor. So `lib:help kind:concept` (no freeText) returns concept pages. Good. However, the subtle bug is in `searchHelp` line 212: `if (parsed.freeText.trim().length === 0 && parsed.filters.length === 0) return []` - it short-circuits on empty filters. Fine. But `helpRegistry.search` itself doesn't make this distinction; if a future caller bypasses `searchHelp` (e.g. an admin diagnostic surface), they'll get every page in registration order and have no signal that's what happened.

Fix: in `helpRegistry.search`, return `[]` (with a `console.warn` in dev) when both freeText and filters are empty, so the empty-query-floods-everything case is caught regardless of caller. Keeps the contract symmetric.

### MINOR: `ThemePicker` snapshots `listThemes()` at module-init, not at component mount

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/picker/ThemePicker.svelte:65-69`

Problem: `const availableThemes = listThemes().map(...)` runs once when the module is first evaluated, not when the component mounts. The comment correctly notes this is intentional given the registry is side-effect-populated at import time. But for HMR / test scenarios where `__resetRegistryForTests()` is called between renders, the picker's option list will be stale relative to the registry until the dev server fully reloads the module. A test author chasing "why does my new theme not appear in the picker after registering it" has no obvious lead.

Fix: either move the snapshot inside the component (`const availableThemes = listThemes().map(...)` inside the `<script>` body, computed once at component instantiation rather than module load) or add a comment+console.warn path when `availableThemes.length === 0` to make the empty-registry case obvious.

### MINOR: `ConfirmDialog` "dangerLevel" wins over "variant" silently

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmDialog.svelte:71-73`

Problem: When a caller passes both `variant="danger"` and `dangerLevel="caution"`, `dangerLevel` wins (mapping caution -> primary). The JSDoc says so, but a maintenance change that adds a `variant` to a call site that already had `dangerLevel` will silently no-op without any warning. The two props are also conceptually duplicated - the doc says `dangerLevel` is for callers that "think in admin-write terms" but offers no path to retire `variant` once everyone migrates.

Fix: in dev mode, `console.warn` when both props are set. Longer-term, add a TODO with a specific trigger ("once all hangar admin-write surfaces use `dangerLevel`, deprecate `variant` here") so the cleanup isn't just hopeful.

### MINOR: `Select.svelte` and `TextField.svelte` derive an id from the label string

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Select.svelte:49`, `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/TextField.svelte:54`

Problem: `const autoId = $derived(id ?? (name ? \`sel-${name}\` : \`sel-${label.replace(/\\s+/g, '-').toLowerCase()}\`))`. When a page has two `Select` components with the same label (e.g. two "Status" filters), they generate identical ids and the resulting `<label for="sel-status">` references collide - clicking one label focuses the wrong control. Tests that don't use unique labels won't catch this; users hit it on filter-heavy admin pages.

Fix: incorporate `$props.id()` into the fallback chain so duplicate labels get unique component-instance ids: `id ?? (name ? \`sel-${name}\` : \`sel-${$props.id()}\`)`. Drops the dependency on label text being unique on a page.

### NIT: `EmptyState`, `BrowseList`, `ResultSummary` etc. not in the type-export barrel

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/index.ts`

Problem: The barrel exports types for ~25 components but skips a handful (`EmptyState`, `Banner`'s `BannerTone` is there but `EmptyState` has no exported props type, `PanelShell`, `PageHeader`, `Card`, `Divider`, etc.). A consumer typing `import type { EmptyStateProps } from '@ab/ui'` gets `Cannot find ... 'EmptyStateProps'`. Most components don't have an exported `Props` interface at all because they're typed inline in the script block.

Fix: pick one convention - either every component exposes a `Props` interface (or `XxxProps` named export from a `module` block) or accept that the convention is "import the .svelte file directly for types via Svelte's component-instance type". Document the choice in the barrel header so consumers know which path to take.

### NIT: `DataTable.sortIndicator` returns ASCII `^` / `v` for sort direction

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/DataTable.svelte:78-82`

Problem: ` ^` for ascending and ` v` for descending render as the literal letter `v` next to a column header. Users have learned `▲` / `▼` (or chevrons) for "this column is sorted". A lowercase `v` reads as text - especially confusing when the column header is also alphabetic (e.g. "Version v"). aria-sort is correctly set, so AT users are fine; visual users get a mild WTF.

Fix: replace with `▲` / `▼` (or ▴/▾ if subtler) and keep the ` ` space for non-sortable columns to preserve column width.

### NIT: `Button.svelte` `loading` plus `loadingLabel` semantics surprising

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Button.svelte:91-95,110-114`

Problem: `{#if loading && loadingLabel} {loadingLabel} {:else} {@render children()} {/if}`. When `loading` is true but `loadingLabel` is undefined, the button still renders its normal children (just disabled). Half the loading-state visual cue (the label change) is lost without any signal. A spinner glyph isn't rendered either - the only feedback is `data-state="loading"` for stylesheets to react to, plus `aria-disabled`.

Fix: render a small inline `<Spinner size="sm" />` (or a CSS-only spinner) when `loading` is true regardless of whether `loadingLabel` is set. The button currently only has visual loading feedback if the caller remembers to also pass `loadingLabel`, which is too easy to forget.

### NIT: `pre-hydration.ts` `try { ... } catch (e) { /* fall through */ }` swallows errors silently

File: `/Users/joshua/src/_me/aviation/airboss/libs/themes/picker/pre-hydration.ts:106-108`

Problem: The inline pre-hydration script catches any exception and silently continues. The comment "Fall through to the HTML defaults" explains the intent, but in practice an exception here means the theme attributes aren't set and the user gets a flash. No console signal, no `data-pre-hydration-error` attribute - the bug class is invisible from devtools.

Fix: in the catch, set `doc.setAttribute('data-pre-hydration-error', e && e.message ? e.message : '1')`. Costs nothing on the success path, gives 2am-debug visibility into "did the script throw?". Optionally `console.error` only when running on localhost (`window.location.hostname === 'localhost'`).

### NIT: `ConfirmDialog` typed-confirmation input has no `id` / `for` linkage

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmDialog.svelte:101-111`

Problem: The label wraps the input, which is technically valid HTML (implicit association), but the input itself has no `id` and no `aria-describedby` - if the caller's instructions live in `children` above the typed-gate, AT users won't have the relationship spoken when the input gains focus.

Fix: generate an id via `$props.id()` and use `<label for={id}>...</label> <input {id} ...>` plus `aria-describedby` pointing at the children-wrapped instructions block.
