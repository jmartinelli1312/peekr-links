#!/usr/bin/env python3
"""
Builds a word-accurate caption timeline by aligning the known script to the
narration that was actually synthesised.

Why alignment instead of arithmetic: the previous timeline shared each TTS
chunk's duration out by character count. A chunk is ~1.800 characters — over a
minute of speech — and character count says nothing about pauses, emphasis or
how a number gets read aloud, so captions drifted seconds away from the voice
in the middle of every chunk and snapped back at the seams.

Whisper transcribes the rendered audio with word timestamps, which are ground
truth. But its transcript is not always the script (it drops filler, spells
numbers differently), so its words are used only as timing anchors: the script
is sequence-aligned against the transcript, matched words take the transcript's
timing, and unmatched runs are interpolated across the gap. The caption text is
therefore always exactly the approved script.

Usage:
    transcribe-captions.py <audio> <script.txt> <out.json>

Environment:
    VIDEO_WHISPER_MODEL     faster-whisper model size (default "base")

Writes a JSON list of {start, end, text} in audio seconds.
"""

import difflib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    sys.exit(
        "Falta faster-whisper (se usa para sincronizar los subtítulos).\n"
        "  python3 -m pip install --user faster-whisper"
    )

# Caption shape. Short, fast captions are what this format uses.
MAX_WORDS = 5
MAX_CHARS = 42
# A silence longer than this ends the caption instead of stretching it: holding
# text over a pause is what reads as "out of sync" even when it technically is.
PAUSE_BREAK_SECONDS = 0.55
SENTENCE_END = re.compile(r"[.!?…][\"'”’)\]]*$")


def normalize(word: str) -> str:
    """Comparison form: no accents, no punctuation, lowercase."""
    stripped = unicodedata.normalize("NFD", word)
    stripped = "".join(c for c in stripped if unicodedata.category(c) != "Mn")
    return re.sub(r"[^0-9a-zA-Z]", "", stripped).lower()


def transcribe(audio: str) -> list[tuple[str, float, float]]:
    size = os.environ.get("VIDEO_WHISPER_MODEL", "base")
    # int8 on CPU: this runs on a laptop next to FFmpeg, and the transcript is
    # only used for timing, so accuracy beyond word boundaries buys nothing.
    model = WhisperModel(size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        audio,
        language="es",
        word_timestamps=True,
        beam_size=1,
        # Both off on purpose: VAD would silently drop quiet words and shift
        # every timestamp after them, and conditioning on previous text makes
        # a 15-minute read prone to repetition loops.
        vad_filter=False,
        condition_on_previous_text=False,
    )

    words: list[tuple[str, float, float]] = []
    for segment in segments:
        for word in segment.words or []:
            key = normalize(word.word)
            if key:
                words.append((key, float(word.start), float(word.end)))
    return words


def align(script_words: list[str], heard: list[tuple[str, float, float]], total: float):
    """Maps every script word onto the transcript's timeline."""
    script_keys = [normalize(w) for w in script_words]
    heard_keys = [w[0] for w in heard]

    starts: list[float | None] = [None] * len(script_words)
    ends: list[float | None] = [None] * len(script_words)

    matcher = difflib.SequenceMatcher(None, script_keys, heard_keys, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag != "equal":
            continue
        for k in range(i2 - i1):
            starts[i1 + k] = heard[j1 + k][1]
            ends[i1 + k] = heard[j1 + k][2]

    anchored = sum(1 for s in starts if s is not None)

    # Unmatched runs (whisper misheard, or the script spells something out) get
    # spread across the gap between their anchored neighbours, weighted by word
    # length so a long word doesn't get the same slice as "y".
    index = 0
    while index < len(script_words):
        if starts[index] is not None:
            index += 1
            continue

        run_start = index
        while index < len(script_words) and starts[index] is None:
            index += 1
        run_end = index  # exclusive

        left = ends[run_start - 1] if run_start > 0 else 0.0
        right = starts[run_end] if run_end < len(script_words) else total
        if right is None or right < left:
            right = left
        span = max(0.0, right - left)

        weights = [max(1, len(script_words[i])) for i in range(run_start, run_end)]
        weight_total = sum(weights) or 1
        cursor = left
        for offset, i in enumerate(range(run_start, run_end)):
            share = span * (weights[offset] / weight_total)
            starts[i] = cursor
            ends[i] = cursor + share
            cursor += share

    return starts, ends, anchored


def group(script_words: list[str], starts, ends) -> list[dict]:
    """Packs timed words into caption-sized lines."""
    captions: list[dict] = []
    current: list[str] = []
    current_start = 0.0
    current_end = 0.0

    def flush():
        if current:
            captions.append(
                {"start": current_start, "end": current_end, "text": " ".join(current)}
            )

    for i, word in enumerate(script_words):
        if not current:
            current = [word]
            current_start, current_end = starts[i], ends[i]
            continue

        candidate = current + [word]
        gap = starts[i] - current_end
        if (
            len(candidate) > MAX_WORDS
            or len(" ".join(candidate)) > MAX_CHARS
            or gap > PAUSE_BREAK_SECONDS
            or SENTENCE_END.search(current[-1])
        ):
            flush()
            current = [word]
            current_start, current_end = starts[i], ends[i]
        else:
            current = candidate
            current_end = ends[i]

    flush()

    # Never let a line outlive the next one's cue.
    for i in range(len(captions) - 1):
        captions[i]["end"] = min(captions[i]["end"], captions[i + 1]["start"])

    return [c for c in captions if c["end"] - c["start"] >= 0.05]


def main() -> None:
    audio, script_path, out_path = sys.argv[1:4]

    script_words = Path(script_path).read_text(encoding="utf8").split()
    if not script_words:
        sys.exit("El guion está vacío.")

    heard = transcribe(audio)
    if not heard:
        sys.exit("Whisper no devolvió ninguna palabra.")

    total = heard[-1][2]
    starts, ends, anchored = align(script_words, heard, total)
    captions = group(script_words, starts, ends)

    Path(out_path).write_text(json.dumps(captions), encoding="utf8")

    print(
        f"{len(captions)} subtítulos alineados "
        f"({len(heard)} palabras transcritas, "
        f"{anchored}/{len(script_words)} del guion ancladas al audio)"
    )


if __name__ == "__main__":
    main()
