from __future__ import annotations

import hashlib
import logging
import math
import json
import wave
from pathlib import Path

import numpy as np

from core.config import ProjectConfig


class SoundEngine:
    # Chord progressions with a Russian romantic / classical feel (MIDI root, quality).
    # One distinct pair per slide (indexed by scene position) so no two slides repeat.
    REGULAR_PROGRESSIONS = [
        [(57, "min"), (62, "min")],  # Am -> Dm
        [(57, "min"), (64, "maj")],  # Am -> E
        [(62, "min"), (57, "min")],  # Dm -> Am
        [(60, "maj"), (55, "maj")],  # C -> G
        [(57, "min"), (53, "maj")],  # Am -> F
        [(52, "min"), (57, "min")],  # Em -> Am
        [(65, "maj"), (64, "maj")],  # F -> E
        [(59, "dim"), (57, "min")],  # Bdim -> Am
        [(62, "min"), (55, "maj")],  # Dm -> G
        [(60, "maj"), (57, "min")],  # C -> Am
        [(55, "maj"), (57, "min")],  # G -> Am
        [(64, "maj"), (57, "min")],  # E -> Am
    ]
    FINAL_PROGRESSION = [(57, "min"), (62, "min"), (64, "maj")]  # Am - Dm - E (resolves on stinger)

    def __init__(self, config: ProjectConfig, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.sound_dir = config.paths.cache / "sound"
        self.sound_dir.mkdir(parents=True, exist_ok=True)

    def prepare_scene_layers(
        self,
        scene_index: int,
        text: str,
        duration: float,
        *,
        is_final_scene: bool = False,
    ) -> tuple[Path | None, Path, Path | None]:
        # Only the classical chord accent is produced; the horror-era ambient
        # drone and whisper layers have been removed.
        accent_path = self.sound_dir / f"accent_{scene_index:02}.wav"
        accent_style = self._accent_style(scene_index, text, is_final_scene)
        accent_fingerprint = self._fingerprint("accent", scene_index, text, duration, is_final_scene, accent_style)
        self._ensure_sound_file(
            accent_path,
            accent_fingerprint,
            lambda path: self._write_accent_fx(path, self.config.audio.accent_tail_seconds, scene_index, text, accent_style, is_final_scene),
        )
        return None, accent_path, None

    def prepare_final_stinger(self, scene_index: int, text: str, duration: float) -> Path:
        stinger_path = self.sound_dir / f"stinger_{scene_index:02}.wav"
        stinger_fingerprint = self._fingerprint("stinger", scene_index, text, duration, True, "final_chord")
        self._ensure_sound_file(
            stinger_path,
            stinger_fingerprint,
            lambda path: self._write_stinger_fx(path, self.config.audio.final_stinger_tail_seconds, scene_index, text),
        )
        return stinger_path

    def _fingerprint(self, kind: str, scene_index: int, text: str, duration: float, is_final_scene: bool, variant: str = "") -> str:
        payload = "|".join(
            [
                kind,
                str(scene_index),
                text,
                f"{duration:.3f}",
                str(is_final_scene),
                variant,
                str(self.config.audio.music_volume),
                str(self.config.audio.accent_volume),
                str(self.config.audio.whisper_volume),
                str(self.config.audio.final_accent_multiplier),
                str(self.config.audio.final_whisper_multiplier),
                str(self.config.audio.final_stinger_tail_seconds),
                str(self.config.audio.final_stinger_gap_seconds),
                str(self.config.audio.final_stinger_volume),
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _ensure_sound_file(self, output_path: Path, fingerprint: str, writer) -> None:
        meta_path = output_path.with_suffix(output_path.suffix + ".meta.json")
        if output_path.exists() and meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                if meta.get("fingerprint") == fingerprint and output_path.stat().st_size > 1000:
                    return
            except Exception:
                pass
        output_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)
        writer(output_path)
        if output_path.exists():
            meta_path.write_text(json.dumps({"fingerprint": fingerprint}, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_accent_fx(self, output_path: Path, duration: float, scene_index: int, text: str, style: str, is_final_scene: bool) -> None:
        sample_rate = 44_100
        if is_final_scene:
            progression = self.FINAL_PROGRESSION
            total = self.config.audio.final_accent_tail_seconds
        else:
            idx = scene_index % len(self.REGULAR_PROGRESSIONS)
            progression = self.REGULAR_PROGRESSIONS[idx]
            total = self.config.audio.accent_tail_seconds

        samples = self._render_chord_sequence(progression, total, sample_rate)
        volume = self.config.audio.accent_volume * (
            self.config.audio.final_accent_multiplier if is_final_scene else 1.0
        )
        samples = samples * volume
        self._write_pcm_wav(output_path, samples, sample_rate)

    def _write_stinger_fx(self, output_path: Path, duration: float, scene_index: int, text: str) -> None:
        sample_rate = 44_100
        dur = self.config.audio.final_stinger_tail_seconds
        # Warm resolving chord that closes the piece on the tonic (A minor).
        samples = self._render_chord_sequence([(57, "min")], dur, sample_rate)
        samples = samples * self.config.audio.final_stinger_volume
        self._write_pcm_wav(output_path, samples, sample_rate)

    def _accent_style(self, scene_index: int, text: str, is_final_scene: bool) -> str:
        if is_final_scene:
            return "final_cadence"
        idx = scene_index % len(self.REGULAR_PROGRESSIONS)
        return f"chords_{idx}"

    def _note_freq(self, midi: int) -> float:
        return 440.0 * (2.0 ** ((midi - 69) / 12.0))

    def _chord_notes(self, root: int, quality: str) -> list[int]:
        intervals = {"min": [0, 3, 7], "maj": [0, 4, 7], "dim": [0, 3, 6]}[quality]
        return [root - 12] + [root + i for i in intervals]

    def _piano_note(self, freq: float, t: np.ndarray) -> np.ndarray:
        tone = (
            1.00 * np.sin(2 * math.pi * freq * t)
            + 0.45 * np.sin(2 * math.pi * 2 * freq * t)
            + 0.22 * np.sin(2 * math.pi * 3 * freq * t)
            + 0.11 * np.sin(2 * math.pi * 4 * freq * t)
            + 0.05 * np.sin(2 * math.pi * 5 * freq * t)
        )
        env = np.exp(-3.2 * t)
        attack = min(len(t), 220)  # ~5 ms at 44.1 kHz to avoid clicks
        if attack > 1:
            ramp = np.ones(len(t))
            ramp[:attack] = np.linspace(0.0, 1.0, attack)
            env = env * ramp
        return tone * env

    def _render_chord_sequence(self, progression, total_dur: float, sample_rate: int) -> np.ndarray:
        frames_total = max(int(sample_rate * total_dur), sample_rate // 2)
        out = np.zeros(frames_total, dtype=np.float64)
        n = max(len(progression), 1)
        seg = total_dur / n
        for i, (root, quality) in enumerate(progression):
            start = int(i * seg * sample_rate)
            note_dur = min(total_dur - i * seg, seg * 1.85)
            note_dur = max(note_dur, 0.25)
            frames = max(int(note_dur * sample_rate), 1)
            t = np.linspace(0.0, note_dur, frames, endpoint=False)
            notes = self._chord_notes(root, quality)
            chord = np.zeros(frames, dtype=np.float64)
            for j, midi in enumerate(notes):
                amp = 0.7 if j == 0 else 1.0  # bass note a touch softer
                chord += amp * self._piano_note(self._note_freq(midi), t)
            chord /= max(len(notes), 1)
            end = min(start + frames, frames_total)
            out[start:end] += chord[: end - start]
        peak = float(np.max(np.abs(out))) if out.size else 0.0
        if peak > 0:
            out = out / peak * 0.9
        return out.astype(np.float32)

    def _write_pcm_wav(self, output_path: Path, samples: np.ndarray, sample_rate: int) -> None:
        clipped = np.clip(samples, -1.0, 1.0)
        pcm = (clipped * 32767).astype(np.int16)
        with wave.open(str(output_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(pcm.tobytes())
