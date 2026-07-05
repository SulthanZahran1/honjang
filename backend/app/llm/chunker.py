"""Korean-aware text chunker for streaming translation.

Splits Korean text into clause-sized chunks so that partial translations
can be sent to the LLM as the user speaks, reducing latency.
"""

import re

# ---------------------------------------------------------------------------
# Split pattern
# ---------------------------------------------------------------------------

# Sentence endings: -습니다, -요, -다, -네 (with optional trailing punctuation)
_SENTENCE_ENDINGS = r"(?:습니다|요|다|네)"

# Korean / Latin punctuation that acts as a clause boundary
_PUNCT = r"[.,!?;。、！？；]"

# Conjunctions that start a new clause
_CONJUNCTIONS = r"(?:그리고|그래서|하지만|그런데)"

# Combined split regex — matches at:
#   1. punctuation
#   2. Korean sentence-ending particles followed by optional punctuation / space
#   3. conjunctions preceded by a space
_SPLIT_RE = re.compile(
    rf"""
    (
        {_PUNCT}                              # punctuation boundary
        |
        {_SENTENCE_ENDINGS}(?:{_PUNCT}|\s|$)  # sentence-ending particle
        |
        \s{_CONJUNCTIONS}\s                   # conjunction surrounded by spaces
    )
    """,
    re.VERBOSE,
)


def split_korean_clauses(text: str) -> list[str]:
    """Split *text* into clause-sized chunks.

    Splits on:
      - commas, periods, and other punctuation
      - Korean sentence endings (습니다, 요, 다, 네)
      - conjunctions (그리고, 그래서, 하지만, 그런데)

    Whitespace-only chunks are discarded.  If no split point is found the
    original text is returned as a single-element list.  An empty string
    yields an empty list.
    """
    if not text:
        return []

    # Find all split positions
    positions: list[tuple[int, int]] = []  # (start, end) of delimiter
    for m in _SPLIT_RE.finditer(text):
        positions.append((m.start(), m.end()))

    if not positions:
        return [text.strip()] if text.strip() else []

    # Build chunks by slicing between delimiters.
    # The delimiter itself is kept with the *preceding* chunk (it is part
    # of the clause, e.g. "선배님," or "죄송합니다.").
    chunks: list[str] = []
    prev = 0
    for start, end in positions:
        chunk = text[prev : start + (end - start)]  # include the delimiter
        # Actually: include delimiter with preceding chunk
        chunk = text[prev:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        prev = end

    # Trailing remainder
    if prev < len(text):
        remainder = text[prev:]
        if remainder.strip():
            chunks.append(remainder.strip())

    return chunks