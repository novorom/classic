from __future__ import annotations

import json
import logging
import random
from pathlib import Path

from core.config import ProjectConfig
from core.models.story import Story
from core.providers.base import StoryProvider


class StoryEngine:
    def __init__(self, config: ProjectConfig, provider: StoryProvider, logger: logging.Logger):
        self.config = config
        self.provider = provider
        self.logger = logger

    def generate(self, topic: str | None = None) -> Story:
        if topic:
            self.logger.info("Generating story about %s (explicit topic)", topic)
        else:
            topic = self._next_topic()
            self.logger.info("Generating story about %s (rotation)", topic)
        story = self.provider.generate_story(topic)
        self.logger.info("Story ready: %s (%s scenes)", story.title, len(story.scenes))
        return story

    def _next_topic(self) -> str:
        """Pick the next topic without repeating until every work has been used."""
        topics = list(self.config.story.topics)
        if not topics:
            raise ValueError("story.topics is empty")

        path = Path(self.config.story.rotation_state_path)
        published: list[str] = []
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                published = [t for t in data.get("published", []) if t in topics]
            except (json.JSONDecodeError, OSError) as exc:
                self.logger.warning("Could not read rotation state (%s); starting a new cycle", exc)

        remaining = [t for t in topics if t not in published]
        if not remaining:
            self.logger.info("Rotation cycle complete; starting a new pass over all %s works", len(topics))
            published = []
            remaining = list(topics)

        topic = random.choice(remaining)
        published.append(topic)

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"published": published}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.logger.info("Rotation: %s/%s works used this cycle", len(published), len(topics))
        return topic
