"""Heuristic endpointing layer.

Sits on top of the raw VAD events emitted by :class:`SileroVAD` and the
transcript events coming from the ASR stream, and decides **when** an
utterance is complete and ready to be sent to translation.

Two independent endpoint conditions are exposed:

* :meth:`vad_endpoint_needed` – VAD says speech ended and we have text.
* :meth:`utterance_endpoint_needed` – no speech for ``pause_threshold``
  seconds after the last recognised word.

Call :meth:`endpoint_current_utterance` to finalise the current utterance
and move it into ``completed_utterances``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class VADHeuristic:
    """Stateful heuristic endpointer.

    Feed it events via :meth:`process`.  Event types recognised:

    * ``{"type": "speech_start", "timestamp": float}``
    * ``{"type": "speech_end",   "timestamp": float}``
    * ``{"type": "transcript", "text": str, "is_final": bool, "word_end": float|None}``
    * ``{"type": "utterance_end"}``  (external force-end)
    """

    pause_threshold: float = 1.2  # seconds of silence to force endpoint

    # VAD state
    vad_speech_detected: bool = False
    vad_speech_end_at: Optional[float] = None

    # utterance state
    current_utterance: str = ""
    current_utterance_start: Optional[float] = None
    current_interim_utterance: str = ""
    interim_endpointed: bool = False
    completed_utterances: List[Dict[str, Any]] = field(default_factory=list)

    # timing
    last_word_end: Optional[float] = None
    audio_cursor: float = 0.0

    # ------------------------------------------------------------------
    # dispatch
    # ------------------------------------------------------------------
    def process(self, event: dict) -> Optional[dict]:
        """Route *event* to the appropriate handler.

        Returns the finalised utterance dict if this event caused an
        endpoint, otherwise ``None``.
        """
        etype = event.get("type")
        if etype in ("speech_start", "speech_end"):
            return self._handle_vad_event(event)
        elif etype == "transcript":
            return self._handle_transcript(event)
        elif etype == "utterance_end":
            return self._handle_utterance_end(event)
        return None

    # ------------------------------------------------------------------
    # handlers
    # ------------------------------------------------------------------
    def _handle_vad_event(self, event: dict) -> Optional[dict]:
        ts = event.get("timestamp", self.audio_cursor)
        if event["type"] == "speech_start":
            self.vad_speech_detected = True
            self.vad_speech_end_at = None
            if self.current_utterance_start is None:
                self.current_utterance_start = ts
        elif event["type"] == "speech_end":
            self.vad_speech_detected = False
            self.vad_speech_end_at = ts
        return None

    def _handle_transcript(self, event: dict) -> Optional[dict]:
        text = event.get("text", "")
        is_final = event.get("is_final", False)
        word_end = event.get("word_end")

        if is_final:
            if self.current_utterance:
                self.current_utterance = (
                    self.current_utterance + " " + text
                ).strip()
            else:
                self.current_utterance = text
            self.current_interim_utterance = ""
            self.interim_endpointed = False
        else:
            self.current_interim_utterance = text

        if word_end is not None:
            self.last_word_end = word_end

        return None

    def _handle_utterance_end(self, event: dict) -> Optional[dict]:
        # External force-end (e.g. Deepgram utterance_end signal)
        return self.endpoint_current_utterance()

    # ------------------------------------------------------------------
    # endpoint decisions
    # ------------------------------------------------------------------
    def vad_endpoint_needed(self) -> bool:
        """True when VAD reports speech-end and we have utterance text."""
        if not self.vad_speech_detected and self.vad_speech_end_at is not None:
            if self.current_utterance or self.current_interim_utterance:
                return True
        return False

    def utterance_endpoint_needed(self) -> bool:
        """True when silence after last word exceeds ``pause_threshold``."""
        if (
            self.last_word_end is not None
            and not self.vad_speech_detected
        ):
            silence = self.audio_cursor - self.last_word_end
            if silence >= self.pause_threshold:
                return True
        return False

    def endpoint_current_utterance(self) -> Optional[dict]:
        """Finalise the current utterance.

        Returns the utterance dict (``text``, ``start``, ``end``) or
        ``None`` if there is no text to finalise.
        """
        text = self.current_utterance or self.current_interim_utterance
        if not text:
            return None

        utterance: Dict[str, Any] = {
            "text": text,
            "start": self.current_utterance_start,
            "end": self.vad_speech_end_at if self.vad_speech_end_at is not None else self.audio_cursor,
        }
        self.completed_utterances.append(utterance)

        # reset for next utterance
        self.current_utterance = ""
        self.current_interim_utterance = ""
        self.current_utterance_start = None
        self.vad_speech_end_at = None
        self.interim_endpointed = True
        self.last_word_end = None

        return utterance