"""OCR-leakage detection for section bodies.

WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.

When a figure escapes the figure-clipper's detection AND its OCR'd contents
end up in the surrounding section body, the result is a long string of
single-letter or two-letter tokens (often duplicated to handle vector vs
raster letter-shape ambiguity). The IFH 2/5 phonetic-alphabet figure
illustrates the canonical leak pattern:

    r R 0 q Q9 p P 8 o O7 n N6 z ZZ y Y Y x XX

The detector finds runs of >= 8 consecutive 1-2-character tokens within
a stretch of body text. Conservative bounds and negative-case rejection
keep prose with single-letter words ("a", "I"), acronyms ("U.S.", "N.W.A."),
and section codes ("1.1.2") from triggering.

The eliding emitter replaces each detected span with a markdown comment
carrying the elided text up to 200 chars (forensic traceability for the
hangar triage dashboard) and emits a `ocr-leak-in-section-body` warning
per span.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Minimum number of consecutive 1-2-character tokens to flag as a leak.
# Eight is conservative: a typical phonetic / alphabet leak runs 26-78
# tokens (one for each letter, often doubled). A four-token run fires
# on legitimate prose ("a a a a") in poetry / lyrics; eight gives margin.
MIN_LEAK_RUN = 8

# Cap one detected leak span at this many tokens. Longer spans get split.
# Prevents one outsized span from swallowing an entire mis-extracted page.
MAX_LEAK_RUN = 200

# A "short token" candidate for the run: 1 or 2 characters, alphanumeric.
# Excludes punctuation by virtue of `\w`. Excludes section-code-style
# `1.1.2` because those tokens contain `.`.
_SHORT_TOKEN_RE = re.compile(r"^[A-Za-z0-9]{1,2}$")

# Acronym-like tokens: dotted abbreviations (U.S., N.W.A.) MUST NOT
# trigger the leak detector. The tokenizer emits them as single tokens
# since they contain `.`, but defensive belt-and-suspenders: short tokens
# that look like an acronym piece ("U", "S") with a `.` adjacent in the
# original text should not be the head of a run.
_ACRONYM_PIECE_RE = re.compile(r"^[A-Z]\.[A-Z](?:\.[A-Z])*\.?$")

# A run is "leak-shaped" if at least 70% of the tokens in it are alpha
# (not pure-digit). The phonetic-alphabet leak is dominantly letters; a
# pure-digit run is more likely a coordinate sequence or page-number
# block and we leave that to other detectors.
_MIN_ALPHA_RATIO = 0.70

# Run gating: the run is rejected when fewer than this many DISTINCT
# tokens appear. A repeated single character ("a a a a a a a a") is
# more likely poetry / a typesetting glitch than an OCR figure leak.
_MIN_DISTINCT_TOKENS = 4


@dataclass(frozen=True)
class OcrLeakSpan:
    """One detected OCR-leak span.

    `start` / `end` are character offsets into the body markdown the
    detector ran against. `tokens` is the sequence of leak tokens for
    forensic readout.
    """

    start: int
    end: int
    tokens: tuple[str, ...]

    @property
    def text(self) -> str:
        return " ".join(self.tokens)


@dataclass(frozen=True)
class OcrLeakWarning:
    """One warning to emit for an elided leak span.

    Routed through `normalize.write_outputs` `extra_warnings` lane; the
    code prefix matches the closed `ocr-leak-in-section-body` value on
    `ALLOWED_WARNING_CODES`.
    """

    section_code: str
    message: str

    def as_extra_warning_str(self) -> str:
        return f"ocr-leak-in-section-body: {self.message}"


def detect_ocr_leaks(body_md: str) -> list[OcrLeakSpan]:
    """Find runs of >= MIN_LEAK_RUN consecutive 1-2-char tokens in `body_md`.

    Tokenization is whitespace-based; tokens spanning a `.` are kept whole
    (so `U.S.` survives intact and never qualifies as a leak head).

    Negative cases that MUST NOT trigger:

    - prose with single-letter words ("a", "I") scattered through long
      paragraphs (run length stays below the threshold).
    - acronyms like "U.S." or "N.W.A." (each token contains `.` so they
      don't match `_SHORT_TOKEN_RE`).
    - section codes like "1.1.2" (same reason).
    - a few short tokens flanked by longer prose tokens (run length stays
      below the threshold).
    """
    spans: list[OcrLeakSpan] = []
    # Walk tokens with their character positions so we can convert run
    # extent into (start, end) offsets in the source body.
    tokens: list[tuple[int, int, str]] = []  # (start, end, token)
    for match in re.finditer(r"\S+", body_md):
        tokens.append((match.start(), match.end(), match.group()))
    n = len(tokens)
    i = 0
    while i < n:
        if not _is_short_token(tokens[i][2]):
            i += 1
            continue
        # Greedily extend the run.
        run_start = i
        while i < n and _is_short_token(tokens[i][2]):
            i += 1
        run_end = i  # exclusive
        run_tokens = [t[2] for t in tokens[run_start:run_end]]
        if len(run_tokens) < MIN_LEAK_RUN:
            continue
        if not _run_qualifies_as_leak(run_tokens):
            continue
        # Cap absurdly long runs.
        if len(run_tokens) > MAX_LEAK_RUN:
            run_tokens = run_tokens[:MAX_LEAK_RUN]
            run_end = run_start + MAX_LEAK_RUN
        char_start = tokens[run_start][0]
        char_end = tokens[run_end - 1][1]
        spans.append(
            OcrLeakSpan(
                start=char_start,
                end=char_end,
                tokens=tuple(run_tokens),
            )
        )
    return spans


def elide_ocr_leaks(
    body_md: str,
    spans: list[OcrLeakSpan],
    *,
    section_code: str,
) -> tuple[str, list[OcrLeakWarning]]:
    """Remove leak spans from `body_md` and emit one warning per span.

    Returns the cleaned body markdown + the warnings list. Spans are
    elided in reverse order so earlier offsets stay valid as we cut.

    The forensic message carries the elided text truncated to 200 chars
    so the hangar triage dashboard can route the operator to the right
    figure-pairing fix without exposing megabytes of OCR garbage in
    `manifest.json`.
    """
    if not spans:
        return body_md, []
    out_text = body_md
    warnings: list[OcrLeakWarning] = []
    # Reverse-order elision so earlier offsets remain stable.
    for span in sorted(spans, key=lambda s: s.start, reverse=True):
        head = span.text[:200]
        warnings.append(
            OcrLeakWarning(
                section_code=section_code,
                message=(
                    f"OCR-leak run of {len(span.tokens)} short tokens in §{section_code}; "
                    f"elided. Likely a figure that escaped the figure-clipper. "
                    f"Elided text (truncated): {head}"
                ),
            )
        )
        out_text = out_text[: span.start] + out_text[span.end :]
    # Warnings were appended in reverse-offset order; reverse so the order
    # of emission matches document order (leak1, leak2, ...).
    warnings.reverse()
    # Collapse 3+ blank lines that the elision may have introduced.
    out_text = re.sub(r"\n{3,}", "\n\n", out_text)
    return out_text, warnings


def _is_short_token(token: str) -> bool:
    """Return True for tokens that count toward a potential leak run."""
    if _ACRONYM_PIECE_RE.match(token):
        return False
    return bool(_SHORT_TOKEN_RE.match(token))


def _run_qualifies_as_leak(run_tokens: list[str]) -> bool:
    """Apply the alpha-ratio + distinct-token guards to a candidate run.

    The phonetic-alphabet leak is dominantly letters and uses ~26 distinct
    short tokens. A run of 12 identical tokens ("a a a a a ...") fails
    the distinctness guard and isn't flagged.
    """
    alpha_count = sum(1 for t in run_tokens if t.isalpha())
    if alpha_count / len(run_tokens) < _MIN_ALPHA_RATIO:
        return False
    distinct = len({t.lower() for t in run_tokens})
    if distinct < _MIN_DISTINCT_TOKENS:
        return False
    return True
