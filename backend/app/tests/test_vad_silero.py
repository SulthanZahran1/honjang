"""Tests for app.vad.silero — VAD wrapper chunking & event logic.

These tests do **not** load the real Silero model.  Instead we inject a
fake VADIterator into the wrapper and verify that ``_process_chunks``
correctly translates iterator outputs into speech_start/speech_end events,
and that silence produces no events.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.vad.silero import SileroVAD


# ----------------------------------------------------------------------
# Fake iterator
# ----------------------------------------------------------------------
class FakeVADIterator:
    """Mimics silero_vad.VADIterator.__call__ return contract.

    ``return_seconds=True`` is always passed by ``_process_chunks``.
    """

    def __init__(self, responses):
        # responses: list of dicts or None, one per chunk call
        self._responses = list(responses)
        self._call_index = 0
        self.calls = 0

    def __call__(self, chunk, return_seconds=False):
        self.calls += 1
        idx = self._call_index
        self._call_index += 1
        if idx < len(self._responses):
            return self._responses[idx]
        return None

    def reset_states(self):
        self._call_index = 0
        self.calls = 0


# ----------------------------------------------------------------------
# initialisation
# ----------------------------------------------------------------------
class TestSileroVADInit:
    def test_defaults_korean_tuned(self):
        v = SileroVAD()
        assert v.min_silence_ms == 450
        assert v.threshold == 0.6
        assert v.sample_rate == 16000
        assert v.chunk_ms == 32

    def test_chunk_samples_derived(self):
        v = SileroVAD()
        # 16000 * 32 / 1000 = 512
        assert v._chunk_samples == 512

    def test_custom_params(self):
        v = SileroVAD(min_silence_ms=300, threshold=0.5, sample_rate=8000, chunk_ms=64)
        assert v.min_silence_ms == 300
        assert v.threshold == 0.5
        assert v.sample_rate == 8000
        assert v._chunk_samples == 512  # 8000*64/1000

    def test_lazy_model_load(self):
        """Model + iterator should be None until process/_load_model."""
        v = SileroVAD()
        assert v._model is None
        assert v._iterator is None


# ----------------------------------------------------------------------
# chunking / event logic
# ----------------------------------------------------------------------
class TestProcessChunks:
    def _make_vad_with_fake(self, responses):
        v = SileroVAD()
        v._iterator = FakeVADIterator(responses)
        return v

    def test_silence_produces_no_events(self):
        """A long stretch of zeros should emit zero events."""
        v = self._make_vad_with_fake([None] * 20)
        audio = np.zeros(20 * 512, dtype=np.float32)
        events = v._process_chunks(audio)
        assert events == []
        assert v._iterator.calls == 20

    def test_speech_start_emitted(self):
        v = self._make_vad_with_fake([
            {"start": 0.03},   # first chunk → speech_start
            None,
            None,
        ])
        audio = np.zeros(3 * 512, dtype=np.float32)
        events = v._process_chunks(audio)
        assert len(events) == 1
        assert events[0]["type"] == "speech_start"
        assert events[0]["timestamp"] == pytest.approx(0.03)

    def test_speech_end_emitted(self):
        v = self._make_vad_with_fake([
            None,
            {"end": 1.5},  # second chunk → speech_end
            None,
        ])
        audio = np.zeros(3 * 512, dtype=np.float32)
        events = v._process_chunks(audio)
        assert len(events) == 1
        assert events[0]["type"] == "speech_end"
        assert events[0]["timestamp"] == pytest.approx(1.5)

    def test_start_then_end(self):
        v = self._make_vad_with_fake([
            {"start": 0.0},
            None,
            None,
            {"end": 1.2},
        ])
        audio = np.zeros(4 * 512, dtype=np.float32)
        events = v._process_chunks(audio)
        assert len(events) == 2
        assert events[0] == {"type": "speech_start", "timestamp": 0.0}
        assert events[1] == {"type": "speech_end", "timestamp": 1.2}

    def test_partial_chunk_at_end(self):
        """Audio length not a multiple of chunk size still processed."""
        v = self._make_vad_with_fake([None, None])
        audio = np.zeros(600, dtype=np.float32)  # 512 + 88
        events = v._process_chunks(audio)
        assert events == []
        assert v._iterator.calls == 2  # two chunks: 512 + 88

    def test_reset_calls_iterator_reset(self):
        v = self._make_vad_with_fake([])
        v.reset()
        assert v._iterator.calls == 0  # reset zeroed the counter