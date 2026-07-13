from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from core.config import ProjectConfig
from core.models.story import Story
from core.providers.base import ImageProvider
from core.utils.image import verify_image


FINAL_ARTIFACTS = [
    ("a burning candle in a brass holder with dripping wax", "on a dark wooden desk in a dim old study"),
    ("an antique kerosene oil lamp with a warm glowing flame", "in a shadowy 19th century Russian library"),
    ("a quill pen resting in a glass inkwell beside a folded letter", "on an aged writing desk near a frosted window"),
    ("a golden pocket watch on a chain", "on a velvet cloth in a candlelit room"),
    ("a small bouquet of dried roses", "on a worn wooden table by a curtained window"),
    ("a stack of yellowed handwritten letters tied with a ribbon", "on a scratched antique desk in warm lamplight"),
    ("a pair of round vintage spectacles", "on an open ledger in a dusty study"),
    ("a tarnished brass hand bell", "on a dark oak shelf among old tomes"),
    ("an hourglass with running sand", "on a stone windowsill at dusk"),
    ("a porcelain teacup with rising steam", "on a lace cloth in a snowy Petersburg parlor"),
]


class ImageEngine:
    def __init__(self, config: ProjectConfig, provider: ImageProvider, logger: logging.Logger):
        self.config = config
        self.provider = provider
        self.logger = logger
        self.image_dir = config.paths.cache / "images"
        self.image_dir.mkdir(parents=True, exist_ok=True)

    def generate_scene_images(self, story: Story) -> list[Path]:
        paths: list[Path] = []
        for scene in story.scenes:
            output = self.image_dir / f"scene_{scene.index:02}.jpg"
            self.logger.info("Generating image %s/%s", scene.index, len(story.scenes))
            path = self.provider.generate_image(scene.image_prompt, output)
            if not verify_image(path, self.config.video.size):
                self.logger.warning("Image had wrong size after generation: %s", path)
            paths.append(path)
        return paths

    def generate_final_book_image(self, story: Story) -> Path:
        work, author = story.book_credits()
        artifact, background = self._final_artifact(story.topic)
        digest = hashlib.md5(story.topic.encode("utf-8")).hexdigest()[:8]
        raw = self.image_dir / f"final_book_{digest}.jpg"
        output = self.image_dir / f"final_book_{digest}_titled.jpg"
        self.logger.info("Generating final book slide for %s", story.topic)
        prompt = (
            "a single beautiful antique hardcover book standing upright and closed, "
            "ornate embossed old leather cover with gold filigree and worn edges, "
            f"19th century Russian book design, next to it {artifact}, {background}, "
            "centered composition, warm candlelight, blank cover without readable letters"
        )
        self.provider.generate_image(prompt, raw)
        if not verify_image(raw, self.config.video.size):
            self.logger.warning("Final book image had wrong size after generation: %s", raw)
        return self._overlay_book_credits(raw, output, work, author)

    def _final_artifact(self, topic: str) -> tuple[str, str]:
        digest = hashlib.md5(topic.encode("utf-8")).digest()
        return FINAL_ARTIFACTS[digest[0] % len(FINAL_ARTIFACTS)]

    def _overlay_book_credits(self, src: Path, dst: Path, work: str, author: str) -> Path:
        image = Image.open(src).convert("RGBA")
        width, height = image.size
        panel_width = int(width * 0.82)
        title_font = self._serif_font(int(width * 0.072))
        author_font = self._serif_font(int(width * 0.05), italic=True)

        title_lines = self._wrap_by_width(work.upper(), title_font, panel_width - 90)
        title_line_height = int(title_font.size * 1.16)
        author_line_height = int(author_font.size * 1.2)
        separator_gap = int(height * 0.018)

        content_height = title_line_height * len(title_lines)
        author_text = f"— {author} —" if author else ""
        if author_text:
            content_height += separator_gap + author_line_height
        pad_y = 46
        panel_height = content_height + pad_y * 2
        panel_left = (width - panel_width) // 2
        panel_top = int(height * 0.30) - panel_height // 2

        overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        panel = (panel_left, panel_top, panel_left + panel_width, panel_top + panel_height)
        draw.rounded_rectangle(panel, radius=26, fill=(18, 12, 8, 205))
        draw.rounded_rectangle(panel, radius=26, outline=(201, 162, 75, 255), width=4)
        inset = (panel[0] + 12, panel[1] + 12, panel[2] - 12, panel[3] - 12)
        draw.rounded_rectangle(inset, radius=18, outline=(201, 162, 75, 140), width=2)
        image = Image.alpha_composite(image, overlay)

        draw = ImageDraw.Draw(image)
        y = panel_top + pad_y
        for line in title_lines:
            draw.text(
                (width // 2, y + title_line_height // 2),
                line,
                font=title_font,
                anchor="mm",
                fill="#F1E4C3",
                stroke_fill="#0B0705",
                stroke_width=4,
            )
            y += title_line_height
        if author_text:
            y += separator_gap
            draw.text(
                (width // 2, y + author_line_height // 2),
                author_text,
                font=author_font,
                anchor="mm",
                fill="#D8BC7C",
                stroke_fill="#0B0705",
                stroke_width=3,
            )

        image.convert("RGB").save(dst, quality=95, optimize=True)
        return dst

    def _wrap_by_width(self, text: str, font, max_width: int) -> list[str]:
        words = text.split()
        lines: list[str] = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if font.getlength(candidate) <= max_width or not current:
                current = candidate
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines or [text]

    def _serif_font(self, size: int, italic: bool = False):
        regular = [
            "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
            "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
            "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
        ]
        italics = [
            "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
            "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf",
        ]
        for candidate in (italics if italic else []) + regular:
            if candidate and Path(candidate).exists():
                try:
                    return ImageFont.truetype(candidate, size)
                except Exception:
                    continue
        return ImageFont.load_default()

    def generate_thumbnail(self, story: Story) -> Path:
        output = self.config.paths.output / "thumbnail.jpg"
        prompt = (
            f"Dramatic cinematic portrait evoking {story.topic}, 19th century Russia, "
            "classic literature, expressive face, candlelight, photorealistic thumbnail, "
            "vertical composition, no text"
        )
        self.provider.generate_image(prompt, output)
        return output
