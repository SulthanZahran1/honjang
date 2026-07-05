"""Tests for app.llm.chunker."""

from app.llm.chunker import split_korean_clauses


def test_split_on_comma():
    chunks = split_korean_clauses("선배님, 마감일을 미뤄야 할 것 같습니다")
    assert len(chunks) == 2
    assert "선배님" in chunks[0]
    assert "마감일을" in chunks[1]


def test_split_on_sentence_ending():
    chunks = split_korean_clauses("죄송합니다. 다음 주까지 하겠습니다.")
    assert len(chunks) == 2


def test_split_on_conjunction():
    chunks = split_korean_clauses(
        "내일 미팅이 있습니다 그리고 자료를 준비해야 합니다"
    )
    assert len(chunks) >= 2


def test_single_chunk_no_split_point():
    chunks = split_korean_clauses("안녕하세요")
    assert len(chunks) == 1
    assert chunks[0] == "안녕하세요"


def test_empty_string():
    chunks = split_korean_clauses("")
    assert chunks == []


def test_preserves_text():
    text = "선배님, 마감일을 미뤄야 할 것 같습니다"
    chunks = split_korean_clauses(text)
    joined = "".join(chunks).replace(" ", "")
    assert joined == text.replace(" ", "")