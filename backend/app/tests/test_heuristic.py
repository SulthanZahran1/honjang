"""Tests for app.vad.heuristic — pure logic endpointing tests."""

from __future__ import annotations

import pytest

from app.vad.heuristic import VADHeuristic


class TestInit:
    def test_defaults(self):
        h = VADHeuristic()
        assert h.pause_threshold == 1.2
        assert h.vad_speech_detected is False
        assert h.vad_speech_end_at is None
        assert h.current_utterance == ""
        assert h.completed_utterances == []

    def test_custom_pause_threshold(self):
        h = VADHeuristic(pause_threshold=2.0)
        assert h.pause_threshold == 2.0


class TestVADEndpoint:
    def test_no_endpoint_when_speech_detected(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕하세요", "is_final": True})
        # speech still ongoing → no endpoint
        assert h.vad_speech_detected is True
        assert h.vad_endpoint_needed() is False

    def test_endpoint_after_speech_end_with_utterance(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕하세요", "is_final": True})
        h.process({"type": "speech_end", "timestamp": 1.0})
        # speech ended + we have text → endpoint needed
        assert h.vad_speech_detected is False
        assert h.vad_endpoint_needed() is True

    def test_no_endpoint_without_utterance(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "speech_end", "timestamp": 1.0})
        # speech ended but no text → no endpoint
        assert h.vad_endpoint_needed() is False

    def test_endpoint_with_interim_only(self):
        """Interim transcript (no final yet) should still allow endpointing."""
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕", "is_final": False})
        h.process({"type": "speech_end", "timestamp": 0.8})
        assert h.vad_endpoint_needed() is True


class TestUtteranceEndpoint:
    def test_no_endpoint_before_pause_threshold(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "hello", "is_final": True, "word_end": 1.0})
        h.process({"type": "speech_end", "timestamp": 1.1})
        h.audio_cursor = 1.5  # only 0.5 s after word_end
        assert h.utterance_endpoint_needed() is False

    def test_endpoint_after_pause_threshold(self):
        h = VADHeuristic(pause_threshold=1.2)
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "hello", "is_final": True, "word_end": 1.0})
        h.process({"type": "speech_end", "timestamp": 1.1})
        h.audio_cursor = 2.3  # 1.3 s after word_end → exceeds 1.2
        assert h.utterance_endpoint_needed() is True

    def test_no_endpoint_when_speech_still_detected(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "hi", "is_final": True, "word_end": 0.5})
        h.audio_cursor = 5.0  # long time, but speech still on
        assert h.utterance_endpoint_needed() is False

    def test_no_endpoint_without_word_end(self):
        h = VADHeuristic()
        h.process({"type": "speech_end", "timestamp": 1.0})
        h.audio_cursor = 10.0
        assert h.utterance_endpoint_needed() is False


class TestEndpointCurrentUtterance:
    def test_finalises_utterance(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕하세요", "is_final": True})
        h.process({"type": "speech_end", "timestamp": 1.0})
        result = h.endpoint_current_utterance()
        assert result is not None
        assert result["text"] == "안녕하세요"
        assert result["start"] == 0.0
        assert result["end"] == 1.0
        assert len(h.completed_utterances) == 1

    def test_returns_none_when_empty(self):
        h = VADHeuristic()
        result = h.endpoint_current_utterance()
        assert result is None
        assert h.completed_utterances == []

    def test_resets_after_endpoint(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕", "is_final": True})
        h.process({"type": "speech_end", "timestamp": 0.5})
        h.endpoint_current_utterance()
        assert h.current_utterance == ""
        assert h.current_interim_utterance == ""
        assert h.current_utterance_start is None
        assert h.vad_speech_end_at is None
        assert h.last_word_end is None
        assert h.interim_endpointed is True

    def test_appends_multiple_utterances(self):
        h = VADHeuristic()
        # first utterance
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "첫 번째", "is_final": True})
        h.process({"type": "speech_end", "timestamp": 1.0})
        h.endpoint_current_utterance()
        # second utterance
        h.process({"type": "speech_start", "timestamp": 2.0})
        h.process({"type": "transcript", "text": "두 번째", "is_final": True})
        h.process({"type": "speech_end", "timestamp": 3.0})
        h.endpoint_current_utterance()
        assert len(h.completed_utterances) == 2
        assert h.completed_utterances[0]["text"] == "첫 번째"
        assert h.completed_utterances[1]["text"] == "두 번째"


class TestTranscriptHandling:
    def test_interim_does_not_overwrite_final(self):
        h = VADHeuristic()
        h.process({"type": "transcript", "text": "안녕", "is_final": True})
        h.process({"type": "transcript", "text": "안녕하", "is_final": False})
        assert h.current_utterance == "안녕"
        assert h.current_interim_utterance == "안녕하"

    def test_multiple_finals_concatenate(self):
        h = VADHeuristic()
        h.process({"type": "transcript", "text": "안녕", "is_final": True})
        h.process({"type": "transcript", "text": "하세요", "is_final": True})
        assert h.current_utterance == "안녕 하세요"


class TestUtteranceEndEvent:
    def test_utterance_end_force_finalises(self):
        h = VADHeuristic()
        h.process({"type": "speech_start", "timestamp": 0.0})
        h.process({"type": "transcript", "text": "안녕하세요", "is_final": True})
        result = h.process({"type": "utterance_end"})
        assert result is not None
        assert result["text"] == "안녕하세요"
        assert len(h.completed_utterances) == 1

    def test_utterance_end_with_no_text_returns_none(self):
        h = VADHeuristic()
        result = h.process({"type": "utterance_end"})
        assert result is None