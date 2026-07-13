# Clásicos de la Literatura Rusa

Este repositorio contiene dos partes:

1. **Russian Classics Engine** (`core/`, `main.py`) — un pipeline en Python que genera
   automáticamente un Short vertical (9:16) por día sobre un clásico de la literatura rusa
   y lo sube a YouTube. Basado en la arquitectura de `slavic-horror-engine`.
2. **App React + Vite** (`src/`) — herramienta web para previsualizar y editar guiones.

## Russian Classics Engine

El pipeline hace lo siguiente cada día (ver `.github/workflows/daily-classic.yml`):

1. **Historia** — genera un guion en español con Gemini (`GEMINI_API_KEY`). Si no hay clave,
   usa una historia de reserva local.
2. **Imágenes** — genera una imagen por escena con Pollinations (Flux).
3. **Voz** — narración con TTS (gTTS por defecto, o edge-tts).
4. **Sonido** — capas de ambiente/acentos sintetizadas.
5. **Subtítulos** — quemados en el vídeo + archivo `.srt`.
6. **Vídeo** — render 1080x1920 con MoviePy/FFmpeg.
7. **Publicación** — sube el vídeo a YouTube (`youtube_uploader.py`).

### Uso local

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# opcional: export GEMINI_API_KEY=...   export TOPIC="Anna Karénina de Lev Tolstói"
python main.py
```

Los resultados quedan en `output/` (`video.mp4`, `thumbnail.jpg`, `subtitles.srt`,
`youtube.txt`, `metadata.json`).

### Tests

```bash
pip install pytest
pytest
```

### Configuración

Edita `settings.yaml`: lista de obras (`story.topics`), voz, vídeo y subtítulos.

### Secrets de GitHub Actions (canal de YouTube)

- `GEMINI_API_KEY` (o `GEMINI_API_KEYS` separadas por coma)
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`

Para obtener el refresh token de **este** canal, ejecuta una vez en local:

```bash
python youtube_auth.py ruta/al/client_secret.json
```

## App React + Vite

```bash
npm install
npm run dev
```
