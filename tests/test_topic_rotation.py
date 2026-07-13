import logging

from core.config import ProjectConfig
from core.engines.story_engine import StoryEngine
from core.models.story import Story
from core.providers.base import StoryProvider


class _RecordingProvider(StoryProvider):
    def generate_story(self, topic: str | None = None) -> Story:
        return Story(
            title=str(topic),
            topic=str(topic),
            hook="hook",
            scenes=[],
            ending_question="¿?",
            social={
                "youtube_title": "t",
                "youtube_description": "d",
                "instagram_caption": "i",
                "tiktok_caption": "tk",
            },
        )


def test_rotation_visits_all_before_repeating(tmp_path) -> None:
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.story.topics = ["A de Autor", "B de Autor", "C de Autor"]
    config.story.rotation_state_path = str(tmp_path / "rotation.json")
    engine = StoryEngine(config, _RecordingProvider(), logging.getLogger("test"))

    first_cycle = [engine.generate().topic for _ in range(3)]
    assert sorted(first_cycle) == ["A de Autor", "B de Autor", "C de Autor"]

    second_cycle = [engine.generate().topic for _ in range(3)]
    assert sorted(second_cycle) == ["A de Autor", "B de Autor", "C de Autor"]


def test_rotation_ignored_for_explicit_topic(tmp_path) -> None:
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.story.topics = ["A de Autor", "B de Autor"]
    config.story.rotation_state_path = str(tmp_path / "rotation.json")
    engine = StoryEngine(config, _RecordingProvider(), logging.getLogger("test"))

    story = engine.generate("Explícito de Autor")
    assert story.topic == "Explícito de Autor"
    assert not (tmp_path / "rotation.json").exists()
