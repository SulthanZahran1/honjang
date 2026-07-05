"""Silero VAD wrapper.

Wraps the silero-vad model (loaded lazily via the ``silero_vad`` package)
and exposes a simple :meth:`process` method that chunks a raw 1-D PCM
``numpy.ndarray`` and emits ``speech_start`` / ``speech_end`` events.

Korean-tuned defaults come from ``app.config.Settings``:
    min_silence_ms = 450, threshold = 0.6, sample_rate = 16000, chunk_ms = 32
"""

from __future__ import annotations

from typing import Any, List, Optional

import numpy as np


class SileroVAD:
    """Thin wrapper around ``silero_vad.VADIterator``.

    The actual torch / silero model is loaded **lazily** the first time
    :meth:`process` is called (or when :meth:`_load_model` is invoked
    explicitly).  This keeps unit tests fast – they can inject a fake
    iterator via ``vad._iterator`` without ever importing torch.
    """

    def __init__(
        self,
        min_silence_ms: int = 450,
        threshold: float = 0.6,
        sample_rate: int = 16000,
        chunk_ms: int = 32,
    ) -> None:
        self.min_silence_ms = min_silence_ms
        self.threshold = threshold
        self.sample_rate = sample_rate
        self.chunk_ms = chunk_ms

        # derived
        self._chunk_samples = int(sample_rate * chunk_ms / 1000)

        # lazily initialised
        self._model: Any = None
        self._iterator: Any = None

    # ------------------------------------------------------------------
    # model lifecycle
    # ------------------------------------------------------------------
    def _load_model(self) -> None:
        """Import torch + silero lazily and build the VADIterator."""
        import torch  # noqa: F401  – ensure torch is available
        from silero_vad import VADIterator, load_silero_vad

        self._model = load_silero_vad()
        self._iterator = VADIterator(
            self._model,
            threshold=self.threshold,
            sampling_rate=self.sample_rate,
            min_silence_duration_ms=self.min_silence_ms,
        )

    def reset(self) -> None:
        """Reset VAD internal state (call between independent sessions)."""
        if self._iterator is not None:
            self._iterator.reset_states()

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def process(self, audio: np.ndarray) -> List[dict]:
        """Process a 1-D float32 PCM array and return a list of events.

        Each event is a dict with ``type`` ∈ {"speech_start", "speech_end"}
        and a ``timestamp`` in **seconds**.
        """
        if self._iterator is None:
            self._load_model()
        return self._process_chunks(audio)

    # ------------------------------------------------------------------
    # internal – testable without the real model
    # ------------------------------------------------------------------
    def _process_chunks(self, audio: np.ndarray) -> List[dict]:
        """Chunk *audio* and feed each chunk through ``self._iterator``.

        ``self._iterator`` is expected to behave like
        ``silero_vad.VADIterator.__call__`` – returning ``None`` or a dict
        with ``{'start': float}`` / ``{'end': float}`` (in seconds when
        ``return_seconds=True``).
        """
        events: List[dict] = []
        chunk_size = self._chunk_samples
        offset = 0
        total = len(audio)

        while offset < total:
            chunk = audio[offset : offset + chunk_size]
            result = self._iterator(chunk, return_seconds=True)
            if result is not None:
                if "start" in result:
                    events.append(
                        {"type": "speech_start", "timestamp": float(result["start"])}
                    )
                elif "end" in result:
                    events.append(
                        {"type": "speech_end", "timestamp": float(result["end"])}
                    )
            offset += chunk_size

        return events