---
title: Autocomplete -- separate dropdown UX
parent: REDESIGN.md
---

# Autocomplete dropdown

The autocomplete is a SEPARATE UI from the search results. **More than separate -- the two components are orthogonal.** Autocomplete is a generic input affordance; the search modal is a result-presentation surface. The autocomplete component knows nothing about the modal. The modal hosts an autocomplete-wrapped input but doesn't own the dropdown.

This means:

- **The autocomplete dropdown can pop up under ANY text input** that wears the component -- the modal's input, an inline header search bar, a `/library` filter box, a future search-on-chart input, future Cmd+Shift+P / Cmd+P modes. Same component, same keyboard model, same triggers.
- **The search modal opens ONLY on Enter or click of a search button.** Not when the autocomplete fires. Tab from the dropdown commits the canonical form into the input and dismisses the dropdown; the modal stays in whatever state it was in (closed, if it was closed; visible, if the user opened it already).
- **The two are composed by the host surface,** not entangled in one component.

## Lib shape

```text
libs/autocomplete/                              (new)
  src/
    Autocomplete.svelte                         <- the generic dropdown component
    types.ts                                    <- AutocompleteSource interface
    DocCodeSource.ts                            <- bundled source for doc codes
    TitlePrefixSource.ts                        <- bundled source for title prefixes
    index.ts
  package.json                                  <- @ab/autocomplete
```

Component contract:

```ts
interface AutocompleteProps {
  value: string;                                // bindable input value
  sources: readonly AutocompleteSource[];       // pluggable suggestion providers
  onCommit: (entry: AutocompleteEntry) => void; // fires on Tab / Enter-in-dropdown
  // standard input props pass through
}

interface AutocompleteSource {
  // Given the current input, return matching entries (or null if this source
  // doesn't think the input shape applies).
  match(input: string): readonly AutocompleteEntry[] | null;
}

interface AutocompleteEntry {
  id: string;                  // stable
  display: string;             // primary text in dropdown row (e.g. "Aviation Weather Handbook")
  secondary?: string;          // secondary text (e.g. "FAA-H-8083-28")
  canonicalForm: string;       // what replaces the input on commit
  payload?: unknown;           // arbitrary data for the host's onCommit handler
}
```

Hosts:

- **`<CommandPalette>`** uses `<Autocomplete>` for its search input with sources `[DocCodeSource, TitlePrefixSource]`. `onCommit` sets a `doc:<code>` filter chip.
- **`<HeaderSearchBar>`** (future) uses the same component with the same sources. `onCommit` opens the result modal pre-scoped to that doc.
- **Command palette Phase 4** uses `<Autocomplete>` with a `CommandSource` that suggests registered commands. `onCommit` invokes the command.
- **Quick-open Phase 5** uses `<Autocomplete>` with a `RecentsSource + DocCodeSource` mix.

## Trigger rules

Triggers when ANY of these match the current input:

1. **Doc-code pattern** detected by `libs/aviation/src/doc-code-detector.ts`:
   - `^FAA-H-`, `^FAA-S-`, `^FAA-P-`
   - `^AC[\s-]`, `^ACS\s`, `^PTS\s`
   - `^14\s?CFR`, `^49\s?CFR`, `^Part\s`, `^§`
   - `^(\d{2,4})(-(\d{1,4}))?$` (bare numeric fragments like `8083`, `8083-28`, `61-83`)
   - `^AIM\s?\d`
   - Known handbook abbreviations: `^(AvWX|PHAK|AFH|IFH|IPH|RMH|AIH|IAH|HFH|GFH|BFH|AMT)\b`
2. **Title prefix** of length >= 4 against any known doc title or alias. Trie-style prefix match across the aviation registry.

Triggers do NOT fire on synonym tokens (e.g. `wx`, `tstm`, `metar` alone). Those run the full search; the synonym chip surfaces in the search results.

## Dropdown content

Bidirectional. Whether the user typed the code or the title, the dropdown shows BOTH:

```text
+-----------------------------------------------------------------+
| FAA-H-8083-28   Aviation Weather Handbook                       |
| FAA-H-8083-25   Pilot's Handbook of Aeronautical Knowledge      |
| FAA-H-8083-3    Airplane Flying Handbook                        |
| FAA-H-8083-15   Instrument Flying Handbook                      |
| FAA-H-8083-16   Instrument Procedures Handbook                  |
| FAA-H-8083-2    Risk Management Handbook                        |
| FAA-H-8083-9    Aviation Instructor's Handbook                  |
+-----------------------------------------------------------------+
```

Doc ID is always shown (R8). The title is the secondary text. Each row is one matching document.

## Sort order

1. Exact prefix match on doc code first (e.g. user types `FAA-H-808`, all `FAA-H-808*` come first).
2. Then prefix matches on title (`Avia...` matches `Aviation...`).
3. Then alias matches.
4. Inside each group: numeric prefix sort for doc codes (so `808`, `8083-2`, `8083-3`, `8083-15`, `8083-16`, `8083-25`, `8083-28` appear in that order, not alphabetic).

## Two-stage search model (autocomplete drives the disambiguation)

The autocomplete dropdown is the user's mechanism to declare "I'm doing intent I-1 (find a specific doc + things connected to it)" rather than I-2 (broad search) or I-3 (phrase FTS).

Three intents, one input:

```text
User types something:
  |
  +-- Autocomplete fires? (doc-code pattern OR title prefix >=4 chars)
  |     |
  |     +-- YES, user Tab-commits a dropdown entry
  |     |     -> Intent I-1: SCOPED search. Sets `doc:<code>` chip.
  |     |        Result: doc headline card + references-to-doc panel.
  |     |
  |     +-- YES, user dismisses with Esc and hits Enter
  |     |     -> Intent I-2: BROAD search. Top hits + buckets + detail.
  |     |
  |     +-- YES, user keeps typing past trigger, dismisses
  |           -> Intent I-2 or I-3 (depending on input shape on Enter)
  |
  +-- Autocomplete does NOT fire (synonym, fuzzy phrase, quoted, etc.)
        |
        +-- Short query (<=3 words), no operators, no title-prefix match
        |     -> Intent I-2: BROAD search.
        |
        +-- Long query OR quoted OR clearly-natural-language
              -> Intent I-3: PHRASE-FTS search.
                 Result: passage cards with highlighted snippets.
                 No top-hits strip; no type nav.
```

## Keyboard model

| Key                         | Action                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `↑` / `↓`                   | Move highlight inside dropdown.                                                                                                                                   |
| `Tab`                       | Commit highlighted entry to input. Input value replaces with canonical form (code OR title; see below). After commit, dropdown dismisses. Cursor at end of input. |
| `Enter` (dropdown open)     | Same as Tab -- commits, dropdown dismisses. Search does NOT run yet; user can keep typing or hit Enter again.                                                     |
| `Enter` (dropdown closed)   | Runs the full search and renders the multi-column result view.                                                                                                    |
| `Esc`                       | Dismiss dropdown only. Input text preserved.                                                                                                                      |
| `Cmd+Enter` (dropdown open) | Set `doc:<code>` filter chip and clear input. Returns focus to input. Runs the search scoped to that doc.                                                         |
| Continued typing            | Past the autocomplete-trigger prefix, dismisses dropdown automatically.                                                                                           |

## What "canonical form" means on commit

If the user typed a code prefix (`FAA-H-808`) and tab-commits a code match, the input becomes the full code: `FAA-H-8083-28`.

If the user typed a title prefix (`Aviation Weath`) and tab-commits, the input becomes the canonical title: `Aviation Weather Handbook`.

If the user wanted the OTHER form, they can hit Tab again -- the dropdown comes back with the canonical-form match highlighted -- or they retype.

The decision of "which canonical form to commit" defaults to whichever side the user was typing. Always shows BOTH in the dropdown so the user sees the linkage either way.

## Synonyms still work in search, just not in autocomplete

User types `wx`:

- Autocomplete does NOT trigger (no doc-code, no title-prefix match).
- Hitting Enter runs the search.
- The search results show a synonym chip: `wx -> weather`.
- The Top Hits strip ranks the canonical weather documents (AvWX handbook, AC 00-6, Weather course) first.

User types `weather`:

- Autocomplete DOES trigger ("Aviation Weather Handbook" prefix match on length 4 word).
- Dropdown shows AvWX + AC 00-6 (titled "Aviation Weather") + any other "weather"-titled refs.
- Tab commits one of them; Enter on dropdown closed runs the broader search.

## Why this matters

Today's mashed-into-column autocomplete confuses the user about whether they're navigating a dropdown or navigating result columns. Keyboard model collisions: Up/Down means one thing in the dropdown, another in the columns. Separating the surfaces makes the keyboard predictable:

- Dropdown open: Up/Down/Tab/Enter act on the dropdown.
- Dropdown closed: Up/Down/Tab/Enter act on the column view.

## Implementation note

The `DocCodeAutocomplete.svelte` component already exists (Phase 3). The change:

1. It moves OUT of the column display.
2. It becomes a true overlay-positioned `<ul role="listbox">` directly under the input.
3. The parent `CommandPalette.svelte` is the only thing that knows whether the dropdown is open; it routes keyboard events accordingly (dropdown open: forward Up/Down/Tab/Enter to the dropdown; dropdown closed: handle them in the column view).
4. APG combobox semantics: `aria-controls`, `aria-expanded`, `aria-activedescendant` on the input; `role="listbox"` on the dropdown.
