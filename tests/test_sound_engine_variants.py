from __future__ import annotations

import logging

from core.config import ProjectConfig
from core.engines.sound_engine import SoundEngine


def test_sound_engine_uses_distinct_themes_per_slide(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    salt = "Almas muertas de Nikolái Gógol"
    # Every non-final slide (hook + 8 scenes) must use a distinct classical theme.
    themes = [engine._theme_for(i, salt, False)[0] for i in range(0, 9)]
    assert len(set(themes)) == len(themes)
    assert len(SoundEngine.MELODIES) >= 10


def test_sound_engine_finale_uses_grand_theme(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    theme = engine._theme_for(9, "Guerra y paz de Lev Tolstói", True)
    assert theme[0] in SoundEngine.FINALE_IDS


def test_sound_engine_theme_order_varies_per_topic(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    a = [engine._theme_for(i, "Topic A", False)[0] for i in range(9)]
    b = [engine._theme_for(i, "Topic B", False)[0] for i in range(9)]
    assert a != b


def test_sound_engine_matches_ukrainian_author_to_ukrainian_music(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    # Ukrainian author: the first slides should lead with Ukrainian-affinity themes.
    themes = [engine._theme_for(i, "Cassandra de Lesia Ukrainka", False) for i in range(4)]
    assert all(t[4] == "ua" for t in themes)
    # Gogol gets Ukrainian themes and Mussorgsky.
    gogol = [engine._theme_for(i, "Almas muertas de Nikolái Gógol", False) for i in range(4)]
    assert all(t[4] == "ua" or t[3] == "musorgski" for t in gogol)


def test_sound_engine_russian_author_uses_russian_music(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    theme = engine._theme_for(0, "Crimen y castigo de Fiódor Dostoyevski", False)
    assert theme[3] in {"rajmaninov", "musorgski"}


def test_sound_engine_can_build_final_stinger(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.cache.mkdir(parents=True, exist_ok=True)
    engine = SoundEngine(config, logging.getLogger("test"))

    stinger = engine.prepare_final_stinger(8, "¿Abrirías la puerta si llama con tu voz?", 4.5)

    assert stinger.exists()
    assert stinger.stat().st_size > 1000
