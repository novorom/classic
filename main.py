from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from core.config import ProjectConfig
from core.pipeline import ClassicsPipeline
from core.utils.logging import configure_logging


async def async_main() -> int:
    root = Path(__file__).resolve().parent
    config = ProjectConfig.load(root / "settings.yaml")
    logger = configure_logging(config)

    topic = os.getenv("TOPIC", "").strip() or None

    try:
        pipeline = ClassicsPipeline(config, logger)
        result = await pipeline.run(topic)
    except Exception:
        logger.exception("Pipeline failed")
        return 1

    logger.info("Done: %s", result.video_path)
    print()
    print("Russian Classics Engine готов.")
    print(f"Видео: {result.video_path}")
    print(f"Обложка: {result.thumbnail_path}")
    print(f"История: {result.story_path}")
    print(f"Метаданные: {result.metadata_path}")
    print(f"Субтитры: {result.subtitle_path}")
    return 0


def main() -> int:
    return asyncio.run(async_main())


if __name__ == "__main__":
    sys.exit(main())
