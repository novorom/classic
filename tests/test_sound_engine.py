from __future__ import annotations

import logging

from core.config import ProjectConfig
from core.engines.sound_engine import SoundEngine


def test_sound_engine_writes_only_chord_accent(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    ambient, accent, whisper = engine.prepare_scene_layers(1, "La noche cae sobre el pueblo", 4.0)

    # The horror-era ambient drone and whisper layers are gone; only chords remain.
    assert ambient is None
    assert whisper is None
    assert accent.exists()
    assert accent.stat().st_size > 1000
