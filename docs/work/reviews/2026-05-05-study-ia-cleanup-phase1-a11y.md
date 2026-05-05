# A11y review -- study-ia-cleanup Phase 1

issues_found: 4

## A-1 (major) -- duplicate `id="tooltip-<key>"` when the same Tooltip key is mounted multiple times

See correctness C-1. Duplicate `id` attributes are a WCAG 4.1.1 violation (parsing); `aria-describedby` resolves to "the first match" in most ATs, but behavior is not portable. The home page mounts three `for="goal"` tooltips and four `for="plan"` tooltips today, so this is a live a11y bug, not theoretical.

## A-2 (major) -- Tooltip wraps inline content with `tabindex="0"`, inserting tab stops mid-prose

`libs/ui/src/components/Tooltip.svelte:144-153`

The host span carries `tabindex="0"` so keyboard users can focus it. On the Home page that means the prose

> If you don't have a [a goal], set one. If you have a goal but no [plan], build one.

introduces two extra tab stops inside a single sentence, then later in `<TodayPanel>` and `<TilesPanel>` introduces more. Keyboard users tabbing through the page hit every Tooltip target before reaching the primary CTA.

Two options:

- Drop `tabindex="0"` and rely on the trigger's natural focusability when the consumer wraps an interactive element. Plain-text wrappers lose keyboard parity but gain a sane tab order.
- Keep the tabindex but add `data-tooltip-target` styling so the user has a visible focus indicator (currently the `:focus` style on `tooltip-host` is implicit -- inherits the underline only, no outline).

The spec (`tasks.md` 1.2) mandates "Hover + keyboard focus parity. Touch fallback (tap-to-show); blur / mouseleave dismisses; Esc dismisses + restores focus." Pick option A or document why option B is necessary.

## A-3 (minor) -- Tooltip lacks visible focus indicator

`libs/ui/src/components/Tooltip.svelte:165-172`

The `.tooltip-host` style block does not define `:focus` / `:focus-visible`. Browsers will paint the default outline on the tabindex target, but the dotted underline is the only visual cue, which is easy to miss. Add an explicit `:focus-visible` outline using `var(--focus-ring)` (or the project's equivalent token).

## A-4 (nit) -- PageExplainer collapse button label is "Hide", not "Hide page explainer"

`libs/ui/src/components/PageExplainer.svelte:115`

The reopen button has `aria-label="Show page explainer"` (good); the collapse button only has the visible text "Hide". Screen-reader users tabbing to it hear "Hide button" with no context. Either give it an `aria-label="Hide page explainer"` or change the visible text.
