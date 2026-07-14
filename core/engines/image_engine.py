from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

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
        
        # Generate hook image first
        hook_output = self.image_dir / f"scene_hook.jpg"
        hook_prompt = (
            f"Dramatic opening scene evoking {story.topic}, "
            "mysterious atmosphere, 19th century Russia, "
            "cinematic lighting, vertical 9:16, photorealistic, "
            "no text, no watermark, high contrast"
        )
        self.logger.info("Generating hook image")
        hook_path = self.provider.generate_image(hook_prompt, hook_output)
        if not verify_image(hook_path, self.config.video.size):
            self.logger.warning("Hook image had wrong size after generation: %s", hook_path)
        paths.append(hook_path)
        
        # Generate scene images
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
            "a single large antique book with its ornate embossed leather cover facing the camera, "
            "the closed cover fills most of the vertical frame, only slightly tilted, "
            "empty blank central panel framed by an ornate gold filigree border, "
            "aged worn leather, 19th century Russian book design, "
            f"{artifact} resting in a lower corner, {background}, warm candlelight, "
            "centered symmetrical composition, no readable letters on the cover"
        )
        self.provider.generate_image(prompt, raw)
        if not verify_image(raw, self.config.video.size):
            self.logger.warning("Final book image had wrong size after generation: %s", raw)
        return self._overlay_book_credits(raw, output, work, author)

    def _final_artifact(self, topic: str) -> tuple[str, str]:
        digest = hashlib.md5(topic.encode("utf-8")).digest()
        return FINAL_ARTIFACTS[digest[0] % len(FINAL_ARTIFACTS)]

    def _overlay_book_credits(self, src: Path, dst: Path, work: str, author: str) -> Path:
        # Stamp the title/author directly onto the book cover as embossed gold
        # lettering, centred where the cover fills the frame.
        image = Image.open(src).convert("RGBA")
        width, height = image.size
        max_text_width = int(width * 0.66)
        title_font = self._serif_font(int(width * 0.082))
        author_font = self._serif_font(int(width * 0.05), italic=True)

        title_lines = self._wrap_by_width(work.upper(), title_font, max_text_width)
        title_line_height = int(title_font.size * 1.14)
        author_line_height = int(author_font.size * 1.2)
        gap = int(height * 0.02)

        block_height = title_line_height * len(title_lines)
        if author:
            block_height += gap * 2 + author_line_height
        center_y = int(height * 0.40)
        top = center_y - block_height // 2

        # Soft dark halo so gold text stays legible on any leather tone.
        halo = Image.new("RGBA", image.size, (0, 0, 0, 0))
        halo_draw = ImageDraw.Draw(halo)
        pad = int(width * 0.07)
        halo_draw.ellipse(
            [
                width // 2 - max_text_width // 2 - pad,
                top - pad,
                width // 2 + max_text_width // 2 + pad,
                top + block_height + pad,
            ],
            fill=(0, 0, 0, 120),
        )
        halo = halo.filter(ImageFilter.GaussianBlur(46))
        image = Image.alpha_composite(image, halo)

        draw = ImageDraw.Draw(image)
        y = top
        for line in title_lines:
            self._emboss_text(draw, width // 2, y + title_line_height // 2, line, title_font)
            y += title_line_height
        if author:
            y += gap
            rule_half = int(max_text_width * 0.26)
            draw.line(
                [(width // 2 - rule_half, y), (width // 2 + rule_half, y)],
                fill=(214, 180, 112, 230),
                width=3,
            )
            y += gap
            self._emboss_text(draw, width // 2, y + author_line_height // 2, author, author_font)

        image.convert("RGB").save(dst, quality=95, optimize=True)
        return dst

    def _emboss_text(self, draw: ImageDraw.ImageDraw, cx: int, cy: int, text: str, font) -> None:
        draw.text((cx + 3, cy + 4), text, font=font, anchor="mm", fill=(0, 0, 0, 190))
        draw.text(
            (cx, cy),
            text,
            font=font,
            anchor="mm",
            fill="#E9CB77",
            stroke_fill="#3A2A12",
            stroke_width=2,
        )

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
