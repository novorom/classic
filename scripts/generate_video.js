import fs from "fs";
import path from "path";
import process from "process";
import { exec } from "child_process";
import { EdgeTTS } from "node-edge-tts";
import { classicsData } from "../src/data/classicsData.js";

const escapeForShell = (value) => value.replace(/(["`\\$])/g, "\\$1");
const escapeForConcat = (value) => value.replace(/'/g, "'\\''");
const escapeForFfmpeg = (value) => value.replace(/\\/g, "/").replace(/:/g, "\\:");

// Helper to run shell commands (like ffmpeg)
const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const resolvePublicAsset = (assetPath) => {
  if (!assetPath) {
    throw new Error("No se recibió una ruta de asset para renderizar el video.");
  }

  return path.resolve("./public", assetPath.replace(/^\//, ""));
};

// Generate SRT file contents from subtitles
const generateSrt = (subtitles) => {
  return subtitles.map((sub, index) => {
    const formatTime = (seconds) => {
      const date = new Date(0);
      date.setSeconds(seconds);
      const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, "0");
      return date.toISOString().substr(11, 8) + "," + ms;
    };
    
    return `${index + 1}\n${formatTime(sub.start)} --> ${formatTime(sub.end)}\n${sub.text}\n`;
  }).join("\n");
};

const createEdgeTtsClient = () => {
  const voice = process.env.EDGE_TTS_VOICE || "es-ES-AlvaroNeural";
  const rate = process.env.EDGE_TTS_RATE || "-4%";
  const pitch = process.env.EDGE_TTS_PITCH || "+0Hz";
  const volume = process.env.EDGE_TTS_VOLUME || "+0%";

  return new EdgeTTS({
    voice,
    lang: "es-ES",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate,
    pitch,
    volume
  });
};

const synthesizeSpeech = async (ttsClient, text, destPath) => {
  await ttsClient.ttsPromise(text, destPath);
};

const buildAnimatedSegments = async (classic, totalDuration, tempDir) => {
  const sortedSlides = (classic.slides?.length ? [...classic.slides] : [{ time: 0, image: classic.background }])
    .sort((a, b) => a.time - b.time)
    .filter((slide) => slide.time < totalDuration);

  if (sortedSlides[0]?.time !== 0) {
    sortedSlides.unshift({ time: 0, image: classic.background });
  }

  const segmentPaths = [];

  for (let index = 0; index < sortedSlides.length; index++) {
    const slide = sortedSlides[index];
    const nextStart = sortedSlides[index + 1]?.time ?? totalDuration;
    const segmentDuration = Number((nextStart - slide.time).toFixed(3));

    if (segmentDuration <= 0) {
      continue;
    }

    const imagePath = resolvePublicAsset(slide.image || classic.background);
    const segmentPath = path.join(tempDir, `slide_${index}.mp4`);
    const frames = Math.max(1, Math.round(segmentDuration * 30));
    const motionDirection = index % 2 === 0 ? "1" : "-1";
    const zoompanFilter = [
      "scale=1400:2488:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      `zoompan=z='if(lte(on,1),1.0,min(zoom+0.0009,1.12))':x='iw/2-(iw/zoom/2)+${motionDirection}*(iw-iw/zoom)*0.05*sin(on/24)':y='ih/2-(ih/zoom/2)+(ih-ih/zoom)*0.03*cos(on/30)':d=${frames}:s=1080x1920:fps=30`,
      "eq=contrast=1.06:brightness=0.02:saturation=1.1"
    ].join(",");

    const renderSegmentCmd = `ffmpeg -y -loop 1 -i "${escapeForShell(imagePath)}" -vf "${zoompanFilter}" -t ${segmentDuration} -r 30 -pix_fmt yuv420p -an -c:v libx264 "${escapeForShell(segmentPath)}"`;
    await runCommand(renderSegmentCmd);
    segmentPaths.push(segmentPath);
  }

  if (!segmentPaths.length) {
    throw new Error("No se pudieron generar segmentos animados para el video.");
  }

  const concatListPath = path.join(tempDir, "segments.txt");
  const concatList = segmentPaths.map((segmentPath) => `file '${escapeForConcat(segmentPath)}'`).join("\n");
  fs.writeFileSync(concatListPath, concatList);

  const animatedVideoPath = path.join(tempDir, "animated_background.mp4");
  const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${escapeForShell(concatListPath)}" -c copy "${escapeForShell(animatedVideoPath)}"`;
  await runCommand(concatCmd);

  return animatedVideoPath;
};

async function main() {
  const requestedBookId = process.env.BOOK_ID || classicsData[0].id;
  const requestedScriptIndex = Number.parseInt(process.env.SCRIPT_INDEX || "0", 10);
  const classic = classicsData.find((item) => item.id === requestedBookId) || classicsData[0];
  const script = classic.scripts[requestedScriptIndex] || classic.scripts[0];
  const subtitles = script.subtitles;
  const duration = subtitles[subtitles.length - 1].end + 2; // pad duration

  console.log(`🎬 Iniciando generación de video para: ${classic.title} (${classic.author})`);
  console.log(`🗣️ Idioma: Español (Estructura de Shorts)`);
  console.log(`🆔 Obra seleccionada: ${classic.id}`);
  
  const tempDir = path.resolve("./temp_assets");
  const distDir = path.resolve("./dist");
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  const audioFiles = [];
  const srtPath = path.join(tempDir, "subtitles.srt");
  const srtContent = generateSrt(subtitles);
  fs.writeFileSync(srtPath, srtContent);
  console.log(`✍️ Archivo de subtítulos creado en: ${srtPath}`);

  const ttsClient = createEdgeTtsClient();
  console.log("🎙️ Generando locución en español...");
  console.log(`   - Proveedor activo: Edge TTS (${process.env.EDGE_TTS_VOICE || "es-ES-AlvaroNeural"})`);
  for (let i = 0; i < subtitles.length; i++) {
    const destPath = path.join(tempDir, `line_${i}.mp3`);
    
    console.log(`   - Generando línea ${i + 1}/${subtitles.length}`);
    await synthesizeSpeech(ttsClient, subtitles[i].text, destPath);
    console.log("     ✓ Voz generada con Edge TTS");
    audioFiles.push(destPath);
    await new Promise(r => setTimeout(r, 250));
  }

  // Create a silent audio track of the exact duration
  const silentAudio = path.join(tempDir, "silent.mp3");
  console.log(`🔇 Creando pista base de silencio de ${duration} segundos...`);
  await runCommand(`ffmpeg -y -f lavfi -i anullsrc=r=44100 -t ${duration} "${silentAudio}"`);

  // Merge the voice clips at their specific timestamps into one track
  console.log("🎛️ Mezclando voces en la línea de tiempo...");
  let filterComplex = "";
  let inputs = `-i "${silentAudio}" `;
  
  audioFiles.forEach((file, index) => {
    inputs += `-i "${file}" `;
    const startMs = Math.round(subtitles[index].start * 1000);
    // Mix overlay filter
    filterComplex += `[${index + 1}:a]adelay=${startMs}|${startMs}[a${index + 1}];`;
  });

  const mixInputs = audioFiles.map((_, index) => `[a${index + 1}]`).join("");
  filterComplex += `[0:a]${mixInputs}amix=inputs=${audioFiles.length + 1}:duration=first:dropout_transition=2,highpass=f=90,lowpass=f=12500,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=180:makeup=3,dynaudnorm=f=200:g=7,loudnorm=I=-15:LRA=7:TP=-1.5[mixeda]`;

  const voiceCombinedPath = path.join(tempDir, "voice_combined.mp3");
  await runCommand(`ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[mixeda]" "${voiceCombinedPath}"`);
  console.log("🔊 Locución combinada creada.");

  const bgMusicPath = path.join(tempDir, "bg_music.mp3");
  console.log("🎵 Generando base musical ambiental...");
  await runCommand(
    `ffmpeg -y ` +
    `-f lavfi -i "sine=frequency=110:sample_rate=44100:duration=${duration}" ` +
    `-f lavfi -i "sine=frequency=164.81:sample_rate=44100:duration=${duration}" ` +
    `-f lavfi -i "anoisesrc=color=pink:amplitude=0.015:duration=${duration}:sample_rate=44100" ` +
    `-filter_complex "[0:a]volume=0.05[a0];[1:a]volume=0.035[a1];[2:a]lowpass=f=900,highpass=f=120,volume=0.02[a2];[a0][a1][a2]amix=inputs=3:duration=longest,afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, duration - 1.5)}:d=1.5,lowpass=f=2200[aout]" ` +
    `-map "[aout]" "${escapeForShell(bgMusicPath)}"`
  );

  const finalAudioPath = path.join(tempDir, "final_audio.mp3");
  await runCommand(
    `ffmpeg -y -i "${escapeForShell(voiceCombinedPath)}" -i "${escapeForShell(bgMusicPath)}" ` +
    `-filter_complex "[0:a]volume=1.2,highpass=f=90,lowpass=f=12500[a0];[1:a]volume=0.22[a1];[a0][a1]amix=inputs=2:duration=first:weights='1 0.24',dynaudnorm=f=180:g=5,loudnorm=I=-14:LRA=7:TP=-1.5[aout]" ` +
    `-map "[aout]" "${escapeForShell(finalAudioPath)}"`
  );

  const animatedVideoPath = await buildAnimatedSegments(classic, duration, tempDir);
  const outputVideoPath = path.resolve("./dist/clasicos_corto_output.mp4");

  console.log("🎥 Renderizando video final 9:16 con animación de slides y subtítulos quemados...");
  
  const escapedSrtPath = escapeForFfmpeg(srtPath);
  
  const renderCmdWithSubtitles = `ffmpeg -y -i "${escapeForShell(animatedVideoPath)}" -i "${escapeForShell(finalAudioPath)}" ` +
                    `-filter_complex "[0:v]subtitles=filename='${escapedSrtPath}':force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Outline=2'[v]" ` +
                    `-map "[v]" -map 1:a -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p "${escapeForShell(outputVideoPath)}"`;

  const renderCmdNoSubtitles = `ffmpeg -y -i "${escapeForShell(animatedVideoPath)}" -i "${escapeForShell(finalAudioPath)}" ` +
                    `-map 0:v -map 1:a -c:v copy -c:a aac -shortest "${escapeForShell(outputVideoPath)}"`;

  try {
    console.log("   - Intentando renderizar con subtítulos incrustados (requiere FFmpeg con libass)...");
    await runCommand(renderCmdWithSubtitles);
    console.log(`✅ ¡Éxito! El video con subtítulos quemados se ha generado en:\n👉 ${outputVideoPath}`);
  } catch {
    console.warn("⚠️ Advertencia: Tu FFmpeg local no soporta el filtro de subtítulos (falta libass).");
    console.log("   - Intentando renderizar video sin subtítulos incrustados (los subtítulos se exportarán en un archivo .srt aparte)...");
    try {
      await runCommand(renderCmdNoSubtitles);
      const outputSrtPath = outputVideoPath.replace(".mp4", ".srt");
      fs.copyFileSync(srtPath, outputSrtPath);
      console.log(`✅ ¡Éxito! Video renderizado sin subtítulos incrustados en:\n👉 ${outputVideoPath}`);
      console.log(`📄 Archivo de subtítulos separado exportado en:\n👉 ${outputSrtPath}`);
      console.log(`ℹ️ Puedes subir este archivo .srt directamente a YouTube/TikTok junto con el video.`);
    } catch (fallbackErr) {
      console.error("❌ Error grave al renderizar el video:", fallbackErr);
      throw fallbackErr;
    }
  }

  if (!fs.existsSync(outputVideoPath)) {
    throw new Error(`El video final no fue generado en la ruta esperada: ${outputVideoPath}`);
  }

  // Clean up temporary assets
  console.log("🧹 Limpiando archivos temporales...");
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch(console.error);
