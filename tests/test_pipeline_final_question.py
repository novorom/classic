from __future__ import annotations

import logging
from pathlib import Path

from core.config import ProjectConfig
from core.engines.sound_engine import SoundEngine
from core.engines.subtitle_engine import SubtitleEngine
from core.engines.video_engine import VideoEngine
from core.models.story import SocialMetadata, Story, StoryScene
from core.pipeline import ClassicsPipeline


def test_pipeline_adds_final_question_clip(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.assets = tmp_path / "assets"
    config.paths.cache = tmp_path / "cache"
    config.paths.output = tmp_path / "output"
    config.paths.logs = tmp_path / "logs"
    config.ensure_directories()

    pipeline = ClassicsPipeline(config, logging.getLogger("test"))

    story = Story(
        title="Crimen y castigo",
        topic="Crimen y castigo de Fiódor Dostoyevski",
        hook="Este clásico ruso esconde un secreto que pocos conocen.",
        scenes=[
            StoryScene(index=1, text="Un estudiante planea un crimen perfecto.", image_prompt="prompt 1"),
            StoryScene(index=2, text="La culpa empieza a perseguirlo.", image_prompt="prompt 2"),
        ],
        ending_question="¿Crees que el fin justifica los medios?",
        social=SocialMetadata(
            youtube_title="titulo",
            youtube_description="desc",
            instagram_caption="ig",
            tiktok_caption="tt",
            hashtags=["#literaturarusa"],
        ),
    )

    image_paths = [tmp_path / "scene_01.jpg", tmp_path / "scene_02.jpg"]
    audio_paths = [tmp_path / "scene_01.mp3", tmp_path / "scene_02.mp3", tmp_path / "scene_03.mp3"]

    pipeline.video_engine = VideoEngine(config, pipeline.video_engine.camera, pipeline.logger)
    pipeline.subtitle_engine = SubtitleEngine(config, pipeline.logger)
    pipeline.sound_engine = SoundEngine(config, pipeline.logger)

    pipeline.video_engine.audio_duration = lambda path: 2.5  # type: ignore[method-assign]
    pipeline.sound_engine.prepare_scene_layers = lambda *args, **kwargs: (Path("ambient.wav"), Path("accent.wav"), Path("whisper.wav"))  # type: ignore[method-assign]
    pipeline.subtitle_engine.burn = lambda image_path, text, index: tmp_path / f"subtitle_{index:02}.jpg"  # type: ignore[method-assign]

    assets, durations = pipeline._build_scene_assets(story, image_paths, audio_paths)

    assert len(assets) == 3
    assert len(durations) == 3
    assert assets[-1].text == story.ending_question
    assert assets[-1].index == 9
    assert assets[-1].stinger_path is not None
