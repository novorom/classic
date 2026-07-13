STORY_SYSTEM_PROMPT = """
You are a professional short-form scriptwriter for a channel about Russian literary classics.
Write only in Spanish.
Every script must make a great Russian novel feel urgent, intriguing and impossible to scroll past.
Mix the plot, the author's real life and a striking idea from the book.
Use short, sharp sentences with strong retention. Be respectful and accurate, never invent fake facts.
Return valid JSON only.
"""

STORY_USER_PROMPT = """
Create one vertical Shorts/TikTok/Reels script about a Russian literary classic.

Work / Topic: {topic}
Language: Spanish
Scene count: {scene_count}

Rules:
- The first line is an IRRESISTIBLE hook that stops scrolling immediately.
- Use curiosity, not clickbait. Example openers: "Este libro casi lo mandan a fusilar",
  "Escribió esta novela para pagar sus deudas de juego", "Nadie entendió el final hasta ahora".
- Address the viewer directly when it helps: "¿Sabías que...?".
- Every scene has 5-14 words.
- Build intrigue every scene: plot, historical context, a bold idea or a real anecdote about the author.
- LAST SCENE — an engaging QUESTION for the audience that invites comments.
- The final line must be a direct question to the viewer, never a statement.
- Image prompts must be in English, photorealistic, cinematic, vertical 9:16, no text, no watermark,
  evoking 19th-century Russia, classic literature, dramatic lighting.

Return this exact JSON shape:
{{
  "title": "Spanish title",
  "topic": "{topic}",
  "hook": "Spanish hook",
  "scenes": [
    {{"index": 1, "text": "Spanish scene text", "image_prompt": "English image prompt"}},
    {{"index": 2, "text": "Spanish scene text", "image_prompt": "English image prompt"}}
  ],
  "ending_question": "Spanish question",
  "social": {{
    "youtube_title": "Clickable Spanish title under 60 chars",
    "youtube_description": "Spanish YouTube description with CTA",
    "instagram_caption": "Spanish Instagram caption with a question",
    "tiktok_caption": "Spanish TikTok caption under 180 chars",
    "hashtags": ["#literaturarusa", "#libros", "#shorts"]
  }}
}}
"""

IMAGE_STYLE_SUFFIX = """
photorealistic cinematic movie still, vertical 9:16, 35mm lens,
19th century Russia, classic literature atmosphere, dramatic lighting,
soft volumetric light, painterly composition, rich detail, natural skin,
oil painting mood, warm candlelight and cold winter tones, snowy Saint Petersburg,
elegant period costumes, high detail, no text, no logo, no watermark,
high contrast, deep shadows, evocative and literary
"""
