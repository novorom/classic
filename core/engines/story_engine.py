from __future__ import annotations

import logging
import random

from core.config import ProjectConfig
from core.models.story import Story
from core.providers.base import StoryProvider


class StoryEngine:
    def __init__(self, config: ProjectConfig, provider: StoryProvider, logger: logging.Logger):
        self.config = config
        self.provider = provider
        self.logger = logger

    def generate(self, topic: str | None = None) -> Story:
        topic = topic or random.choice(self.config.story.topics)
        self.logger.info("Generating story about %s", topic)
        story = self.provider.generate_story(topic)
        self.logger.info("Story ready: %s (%s scenes)", story.title, len(story.scenes))
        return story
