from __future__ import annotations

import logging

from core.config import ProjectConfig
from core.engines.sound_engine import SoundEngine


def test_sound_engine_uses_distinct_accent_styles(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    n = len(SoundEngine.REGULAR_PROGRESSIONS)
    assert engine._accent_style(0, "El gancho", False) == "chords_0"
    assert engine._accent_style(1, "La noche cae", False) == "chords_1"
    assert engine._accent_style(2, "El agua tiembla", False) == "chords_2"
    assert engine._accent_style(3, "Alguien grita", False) == "chords_3"
    assert engine._accent_style(9, "El final", True) == "final_cadence"

    # Every non-final slide (hook + 8 scenes) must use a distinct progression.
    styles = [engine._accent_style(i, "x", False) for i in range(0, 9)]
    assert len(set(styles)) == len(styles)
    assert n >= 9


def test_sound_engine_can_build_final_stinger(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    stinger = engine.prepare_final_stinger(8, "¿Abrirías la puerta si llama con tu voz?", 4.5)

    assert stinger.exists()
    assert stinger.stat().st_size > 1000
