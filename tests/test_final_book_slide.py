from __future__ import annotations

import logging

from PIL import Image

from core.config import ProjectConfig
from core.engines.image_engine import ImageEngine
from core.models.story import SocialMetadata, Story, StoryScene
from core.providers.base import ImageProvider


class _StubImageProvider(ImageProvider):
    def generate_image(self, prompt, output_path):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (1080, 1920), (20, 16, 12)).save(output_path)
        return output_path


def _story(topic: str, book_title: str = "", author: str = "") -> Story:
    return Story(
        title="titulo",
        topic=topic,
        book_title=book_title,
        author=author,
        hook="hook",
        scenes=[StoryScene(index=1, text="uno", image_prompt="p")],
        ending_question="¿Lo leerías?",
        social=SocialMetadata(
            youtube_title="t",
            youtube_description="d",
            instagram_caption="i",
            tiktok_caption="tt",
            hashtags=["#x"],
        ),
    )


def test_book_credits_prefers_explicit_fields():
    story = _story("Crimen y castigo de Fiódor Dostoyevski", "Crimen y castigo", "Fiódor Dostoyevski")
    assert story.book_credits() == ("Crimen y castigo", "Fiódor Dostoyevski")


def test_book_credits_falls_back_to_topic_parsing():
    story = _story("La muerte de Iván Ilich de Lev Tolstói")
    assert story.book_credits() == ("La muerte de Iván Ilich", "Lev Tolstói")


def test_final_book_image_is_generated_with_overlay(tmp_path):
    config = ProjectConfig.load("settings.yaml", load_env=False)
    config.root = tmp_path
    config.paths.cache = tmp_path / "cache"
    config.paths.output = tmp_path / "output"
    config.ensure_directories()

    engine = ImageEngine(config, _StubImageProvider(), logging.getLogger("test"))
    story = _story("Oblómov de Iván Goncharov")

    path = engine.generate_final_book_image(story)

    assert path.exists()
    with Image.open(path) as img:
        assert img.size == tuple(config.video.size)
