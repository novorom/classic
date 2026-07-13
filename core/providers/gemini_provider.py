from __future__ import annotations

import hashlib
import json
import logging
import random
import time
from typing import Any

from pydantic import ValidationError

from core.config import ProjectConfig
from core.models.story import SocialMetadata, Story, StoryScene
from core.prompts.story import STORY_SYSTEM_PROMPT, STORY_USER_PROMPT
from core.providers.base import StoryProvider


class GeminiStoryProvider(StoryProvider):
    def __init__(self, config: ProjectConfig, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.types = None
        self.genai = None
        try:
            from google import genai
            from google.genai import types

            self.genai = genai
            self.types = types
        except Exception as exc:
            self.logger.warning("google-genai is unavailable. Using fallback story: %s", exc)

    def generate_story(self, topic: str | None = None) -> Story:
        topic = topic or random.choice(self.config.story.topics)
        api_keys = self.config.gemini_api_keys
        if not self.genai or not api_keys:
            self.logger.warning("GEMINI_API_KEY is missing. Using local fallback story.")
            return self._fallback_story(topic)

        prompt = STORY_USER_PROMPT.format(
            topic=topic,
            scene_count=self.config.story.scene_count,
        )
        last_error: Exception | None = None
        for key_index, api_key in enumerate(api_keys, start=1):
            try:
                client = self.genai.Client(api_key=api_key)
            except Exception as exc:
                last_error = exc
                self.logger.warning("Gemini client init failed for key %s: %s", key_index, exc)
                continue

            for attempt in range(1, self.config.gemini.max_retries + 1):
                try:
                    response = client.models.generate_content(
                        model=self.config.gemini.model,
                        contents=prompt,
                        config=self.types.GenerateContentConfig(
                            system_instruction=STORY_SYSTEM_PROMPT,
                            temperature=self.config.gemini.temperature,
                            response_mime_type="application/json",
                        ),
                    )
                    payload = self._json_from_text(response.text or "")
                    return self._coerce_story(payload, topic)
                except Exception as exc:
                    last_error = exc
                    self.logger.warning(
                        "Gemini key %s attempt %s failed: %s",
                        key_index,
                        attempt,
                        exc,
                    )
                    time.sleep(1.5 * attempt)

        self.logger.error("Gemini failed after retries: %s", last_error)
        return self._fallback_story(topic)

    def _json_from_text(self, text: str) -> dict[str, Any]:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1:
                raise
            return json.loads(text[start : end + 1])

    def _coerce_story(self, payload: dict[str, Any], topic: str) -> Story:
        payload.setdefault("topic", topic)
        payload.setdefault("title", topic)
        payload.setdefault("hook", "Este clásico ruso esconde un secreto que pocos conocen.")
        work, author = self._split_topic(topic)
        payload["book_title"] = str(payload.get("book_title") or "").strip() or work
        payload["author"] = str(payload.get("author") or "").strip() or author
        payload["ending_question"] = self._normalize_ending_question(
            str(payload.get("ending_question") or ""),
            topic,
        )
        payload.setdefault("social", {})
        payload["social"] = self._social_defaults(payload["social"], payload["title"])

        scenes = payload.get("scenes") or []
        fixed_scenes = []
        for index, scene in enumerate(scenes[: self.config.story.scene_count], start=1):
            fixed_scenes.append(
                {
                    "index": index,
                    "text": str(scene.get("text") or scene.get("text_es") or "").strip(),
                    "image_prompt": str(scene.get("image_prompt") or "").strip(),
                }
            )
        payload["scenes"] = [scene for scene in fixed_scenes if scene["text"]]

        try:
            story = Story.model_validate(payload)
        except ValidationError as exc:
            self.logger.warning("Gemini story validation failed: %s", exc)
            return self._fallback_story(topic)

        if len(story.scenes) < 4:
            return self._fallback_story(topic)
        return story

    def _split_topic(self, topic: str) -> tuple[str, str]:
        work, _, author = topic.strip().rpartition(" de ")
        if work:
            return work.strip(), author.strip()
        return topic.strip(), ""

    def _normalize_ending_question(self, text: str, topic: str) -> str:
        candidate = text.strip()
        if candidate.endswith("?"):
            return candidate
        return self._viral_question(topic)

    def _viral_question(self, topic: str) -> str:
        templates = [
            "¿Ya lo habías leído? Cuéntamelo en los comentarios.",
            "¿Crees que el fin justifica los medios?",
            "¿Qué clásico ruso quieres que cuente después?",
            "¿Te atreverías a leerlo entero?",
        ]
        digest = hashlib.sha256(topic.encode("utf-8")).digest()
        return templates[digest[0] % len(templates)]

    def _social_defaults(self, social: dict[str, Any], title: str) -> dict[str, Any]:
        # Enhanced YouTube description with structure and CTA
        youtube_description = social.get("youtube_description") or f"""
📚 {title}

En este video descubrirás los secretos de este clásico de la literatura rusa.

🎯 Lo que encontrarás:
✅ La trama principal
✅ Curiosidades sobre el autor
✅ Por qué este libro es un clásico

📖 Si te gusta la literatura rusa, suscríbete al canal:
@ClasicosEnCorto

🔔 Activa la campanita para no perderte ningún video

📱 Sígueme en redes:
Instagram: @ClasicosEnCorto
Twitter: @ClasicosEnCorto

📚 Más videos de literatura rusa:
#literaturarusa #clasicos #libros #educacion #cultura

---
Este video es para fines educativos. Todos los derechos reservados a sus respectivos autores.
"""

        return {
            "youtube_title": social.get("youtube_title") or title[:58],
            "youtube_description": youtube_description.strip(),
            "instagram_caption": social.get("instagram_caption")
            or f"{title}. ¿Qué opinas tú? 📚\n\n🔗 @ClasicosEnCorto",
            "tiktok_caption": social.get("tiktok_caption")
            or f"{title}. ¿Lo leerías? 📖\n\n🔗 @ClasicosEnCorto",
            "hashtags": social.get("hashtags")
            or [
                "#literaturarusa",
                "#dostoyevski",
                "#tolstoi",
                "#bulgakov",
                "#clasicosliterarios",
                "#resumendelibros",
                "#analisisliterario",
                "#librosrusos",
                "#literaturaclasica",
                "#educacion",
                "#culturarusa",
                "#historiadelaliteratura",
                "#psicologiaenliteratura",
                "#filosofiarusa",
                "#booktok",
                "#lectura",
                "#shorts",
                "#reels",
                "#tiktok",
            ],
        }

    def _fallback_story(self, topic: str) -> Story:
        scenes = [
            ("Petersburgo, calles frías y una idea prohibida.", "cold streets of 19th century Saint Petersburg at dusk, lonely student"),
            ("Un estudiante cree que hay hombres extraordinarios.", "pensive young man in a shabby room, candlelight, oil painting mood"),
            ("Decide cometer un crimen para probar su teoría.", "dark staircase in an old Russian building, tense atmosphere"),
            ("Pero la culpa lo persigue día y noche.", "haunted man walking through a snowy street, dramatic shadows"),
            ("El autor casi es fusilado años antes de escribirlo.", "firing squad scene in imperial Russia, dramatic historical painting"),
            ("Escribía a contrarreloj para pagar sus deudas.", "writer at a wooden desk with ink and papers, night, candle"),
            ("El verdadero castigo no fue la cárcel.", "prisoner looking through a small window, cold light, melancholy"),
            ("Fue su propia conciencia la que no lo dejó dormir.", "close-up of a tormented face, chiaroscuro lighting, classic portrait"),
        ]
        social = SocialMetadata(
            youtube_title=f"El oscuro secreto detrás de {topic}"[:58],
            youtube_description=f"""📚 {topic}

En este video descubrirás los secretos de este clásico de la literatura rusa.

🎯 Lo que encontrarás:
✅ La trama principal
✅ Curiosidades sobre el autor
✅ Por qué este libro es un clásico

📖 Si te gusta la literatura rusa, suscríbete al canal:
@ClasicosEnCorto

🔔 Activa la campanita para no perderte ningún video

📱 Sígueme en redes:
Instagram: @ClasicosEnCorto
Twitter: @ClasicosEnCorto

📚 Más videos de literatura rusa:
#literaturarusa #clasicos #libros #educacion #cultura

---
Este video es para fines educativos. Todos los derechos reservados a sus respectivos autores.""",
            instagram_caption=f"{topic}. ¿El fin justifica los medios? 📚\n\n🔗 @ClasicosEnCorto",
            tiktok_caption=f"{topic}. La historia detrás del clásico. ¿Lo leerías? 📖\n\n🔗 @ClasicosEnCorto",
            hashtags=[
                "#literaturarusa",
                "#dostoyevski",
                "#tolstoi",
                "#bulgakov",
                "#clasicosliterarios",
                "#resumendelibros",
                "#analisisliterario",
                "#librosrusos",
                "#literaturaclasica",
                "#educacion",
                "#culturarusa",
                "#historiadelaliteratura",
                "#psicologiaenliteratura",
                "#filosofiarusa",
                "#booktok",
                "#lectura",
                "#shorts",
                "#reels",
            ],
        )
        work, author = self._split_topic(topic)
        return Story(
            title=topic,
            topic=topic,
            book_title=work,
            author=author,
            hook="Este clásico ruso esconde un secreto que pocos conocen.",
            scenes=[
                StoryScene(index=i, text=text, image_prompt=f"{prompt}, vertical 9:16, no text")
                for i, (text, prompt) in enumerate(scenes[: self.config.story.scene_count], start=1)
            ],
            ending_question="¿Crees que el fin justifica los medios?",
            social=social,
        )
