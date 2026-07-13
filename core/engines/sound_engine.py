from __future__ import annotations

import hashlib
import logging
import math
import json
import random
import wave
from pathlib import Path

import numpy as np

from core.config import ProjectConfig

_PITCH = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def _note_to_midi(name: str) -> int:
    letter = name[0].upper()
    value = _PITCH[letter]
    i = 1
    while i < len(name) and name[i] in "#b":
        value += 1 if name[i] == "#" else -1
        i += 1
    octave = int(name[i:])
    return 12 * (octave + 1) + value


def _parse_motif(spec: str) -> list[tuple[int | None, float]]:
    """Parse 'B4:1 F#4:.5 r:.5' into [(midi, beats), (None, beats)]."""
    notes: list[tuple[int | None, float]] = []
    for token in spec.split():
        name, _, beats = token.partition(":")
        dur = float(beats) if beats else 1.0
        midi = None if name == "r" else _note_to_midi(name)
        notes.append((midi, dur))
    return notes


class SoundEngine:
    # Short, recognizable motifs of Russian & Ukrainian classical works, all in the
    # public domain (composers deceased for well over 70 years). They are synthesized
    # on a piano voice — no external recordings are used, so there are no recording rights.
    MELODIES = [
        ("swan_lake", "El lago de los cisnes (Chaikovski)", "B4:1 F#4:1 B4:.5 C#5:.5 D5:1 C#5:.5 B4:.5 A#4:1"),
        ("sugar_plum", "El hada de azúcar (Chaikovski)", "E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1"),
        ("nutcracker_march", "Marcha de El cascanueces (Chaikovski)", "G4:.5 E4:.5 G4:.5 E4:.5 G4:.5 E4:.5 C5:1"),
        ("flowers_waltz", "Vals de las flores (Chaikovski)", "A4:1 D5:2 F#5:1 A5:1 G5:1"),
        ("promenade", "Cuadros de una exposición (Músorgski)", "G4:1 F4:1 Bb4:1 C5:1 F5:1 D5:.5 C5:.5 Bb4:1"),
        ("bald_mountain", "Una noche en el Monte Pelado (Músorgski)", "D5:.5 C5:.5 Bb4:.5 A4:.5 G4:.5 F4:.5 E4:.5 D4:.5"),
        ("bumblebee", "El vuelo del moscardón (Rimski-Kórsakov)", "A4:.25 G#4:.25 G4:.25 F#4:.25 F4:.25 E4:.25 D#4:.25 D4:.25 C#4:.25 C4:.25"),
        ("scheherazade", "Scheherazade (Rimski-Kórsakov)", "E5:1 F#5:1 G5:.5 F#5:.5 E5:1 D5:1 B4:1"),
        ("polovtsian", "Danzas polovtsianas (Borodín)", "F4:1 Ab4:1 Bb4:1 Db5:1.5 C5:.5 Bb4:1"),
        ("rach_prelude", "Preludio en do sostenido menor (Rajmáninov)", "A3:1 G#3:1 C#4:2 r:.5 A3:1 G#3:1 C#4:2"),
        ("rach_concerto2", "Concierto para piano n.º 2 (Rajmáninov)", "C4:1 F4:1 Ab4:1 C5:1 Db5:2"),
        ("knights", "Danza de los caballeros (Prokófiev)", "E4:1 E4:.5 E4:.5 G4:1 F#4:1 E4:1 B4:1"),
        ("peter_wolf", "Pedro y el lobo (Prokófiev)", "C5:.5 D5:.5 E5:.5 G5:.5 E5:.5 D5:.5 C5:1"),
        ("ruslan", "Ruslán y Liudmila (Glinka)", "D5:.5 E5:.5 F#5:.5 G5:.5 A5:.5 B5:.5 A5:.5 G5:.5"),
        ("schedryk", "Schedryk / Campanas (Leontóvych)", "A4:.5 G4:.5 A4:.5 F4:.5 A4:.5 G4:.5 A4:.5 F4:.5"),
        ("lysenko", "Melodía ucraniana (Lysenko)", "A4:1 B4:1 C5:1 B4:.5 A4:.5 G4:1 A4:1"),
    ]
    # Grander motifs reserved for the closing book slide.
    FINALE_IDS = ["rach_concerto2", "knights", "polovtsian", "promenade", "swan_lake"]

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
        salt: str = "",
    ) -> tuple[Path | None, Path, Path | None]:
        # Only the classical-music accent is produced; the horror-era ambient
        # drone and whisper layers have been removed.
        accent_path = self.sound_dir / f"accent_{scene_index:02}.wav"
        theme = self._theme_for(scene_index, salt, is_final_scene)
        accent_style = theme[0]
        accent_fingerprint = self._fingerprint("accent", scene_index, text, duration, is_final_scene, f"{salt}|{accent_style}")
        self._ensure_sound_file(
            accent_path,
            accent_fingerprint,
            lambda path: self._write_accent_fx(path, scene_index, theme, is_final_scene),
        )
        return None, accent_path, None

    def prepare_final_stinger(self, scene_index: int, text: str, duration: float, *, salt: str = "") -> Path:
        stinger_path = self.sound_dir / f"stinger_{scene_index:02}.wav"
        stinger_fingerprint = self._fingerprint("stinger", scene_index, text, duration, True, f"{salt}|final_chord")
        self._ensure_sound_file(
            stinger_path,
            stinger_fingerprint,
            lambda path: self._write_stinger_fx(path),
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
                str(self.config.audio.final_accent_multiplier),
                str(self.config.audio.accent_tail_seconds),
                str(self.config.audio.final_accent_tail_seconds),
                str(self.config.audio.final_stinger_tail_seconds),
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

    def _theme_order(self, salt: str) -> list[int]:
        order = list(range(len(self.MELODIES)))
        seed = int(hashlib.sha256(f"order|{salt}".encode("utf-8")).hexdigest(), 16)
        random.Random(seed).shuffle(order)
        return order

    def _theme_for(self, scene_index: int, salt: str, is_final_scene: bool) -> tuple[str, str, str]:
        by_id = {m[0]: m for m in self.MELODIES}
        if is_final_scene:
            seed = int(hashlib.sha256(f"finale|{salt}".encode("utf-8")).hexdigest(), 16)
            finale_id = self.FINALE_IDS[seed % len(self.FINALE_IDS)]
            return by_id[finale_id]
        order = self._theme_order(salt)
        return self.MELODIES[order[scene_index % len(order)]]

    def _write_accent_fx(self, output_path: Path, scene_index: int, theme: tuple[str, str, str], is_final_scene: bool) -> None:
        sample_rate = 44_100
        total = (
            self.config.audio.final_accent_tail_seconds
            if is_final_scene
            else self.config.audio.accent_tail_seconds
        )
        motif = _parse_motif(theme[2])
        samples = self._render_melody(motif, total, sample_rate)
        volume = self.config.audio.accent_volume * (
            self.config.audio.final_accent_multiplier if is_final_scene else 1.0
        )
        samples = samples * volume
        self._write_pcm_wav(output_path, samples, sample_rate)

    def _write_stinger_fx(self, output_path: Path) -> None:
        sample_rate = 44_100
        dur = self.config.audio.final_stinger_tail_seconds
        # Warm resolving chord that closes the piece on the tonic (A minor).
        samples = self._render_chord_sequence([(57, "min")], dur, sample_rate)
        samples = samples * self.config.audio.final_stinger_volume
        self._write_pcm_wav(output_path, samples, sample_rate)

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

    def _render_melody(self, motif: list[tuple[int | None, float]], total_dur: float, sample_rate: int) -> np.ndarray:
        frames_total = max(int(sample_rate * total_dur), sample_rate // 2)
        out = np.zeros(frames_total, dtype=np.float64)
        total_beats = sum(beats for _, beats in motif) or 1.0
        beat_seconds = total_dur / total_beats
        pos = 0.0
        first_midi: int | None = None
        for midi, beats in motif:
            note_seconds = beats * beat_seconds
            start = int(pos * sample_rate)
            if midi is not None:
                if first_midi is None:
                    first_midi = midi
                ring = min(note_seconds * 2.1, total_dur - pos)
                ring = max(ring, 0.12)
                frames = max(int(ring * sample_rate), 1)
                t = np.linspace(0.0, ring, frames, endpoint=False)
                wave_note = self._piano_note(self._note_freq(midi), t)
                end = min(start + frames, frames_total)
                out[start:end] += wave_note[: end - start]
            pos += note_seconds

        # Soft sustained bass an octave below the first note for warmth.
        if first_midi is not None:
            t = np.linspace(0.0, total_dur, frames_total, endpoint=False)
            bass = 0.28 * self._piano_note(self._note_freq(first_midi - 12), t)
            out += bass

        peak = float(np.max(np.abs(out))) if out.size else 0.0
        if peak > 0:
            out = out / peak * 0.9
        return out.astype(np.float32)

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
