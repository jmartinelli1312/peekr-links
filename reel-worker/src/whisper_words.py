#!/usr/bin/env python3
"""Word-level timestamps for a narration MP3 → JSON on stdout.

Usage: whisper_words.py <audio.mp3> [lang]
Output: {"words":[{"w":"Hola","s":0.12,"e":0.41}, ...], "duration": 12.3}
"""
import json
import sys

from faster_whisper import WhisperModel

audio = sys.argv[1]
lang = sys.argv[2] if len(sys.argv) > 2 else "es"

model = WhisperModel("small", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio, language=lang, word_timestamps=True, vad_filter=True)

words = []
end = 0.0
for seg in segments:
    for w in seg.words or []:
        words.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
        end = max(end, w.end)

print(json.dumps({"words": words, "duration": round(end, 3)}))
