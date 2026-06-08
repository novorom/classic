import fs from "fs";
import path from "path";
import { exec } from "child_process";
import https from "https";
import { classicsData } from "../src/data/classicsData.js";

// Helper to download files
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

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

async function main() {
  // Select a book (e.g. Crime and Punishment, first script)
  const classic = classicsData[0];
  const script = classic.scripts[0];
  const subtitles = script.subtitles;
  const duration = subtitles[subtitles.length - 1].end + 2; // pad duration

  console.log(`🎬 Iniciando generación de video para: ${classic.title} (${classic.author})`);
  console.log(`🗣️ Idioma: Español (Estructura de Shorts)`);
  
  const tempDir = path.resolve("./temp_assets");
  const distDir = path.resolve("./dist");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const audioFiles = [];
  const srtPath = path.join(tempDir, "subtitles.srt");
  const srtContent = generateSrt(subtitles);
  fs.writeFileSync(srtPath, srtContent);
  console.log(`✍️ Archivo de subtítulos creado en: ${srtPath}`);

  // Download TTS voice files for each line in Spanish
  console.log("🎙️ Generando locución en español usando Google TTS...");
  for (let i = 0; i < subtitles.length; i++) {
    const text = encodeURIComponent(subtitles[i].text);
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es&client=tw-ob&q=${text}`;
    const destPath = path.join(tempDir, `line_${i}.mp3`);
    
    console.log(`   - Descargando línea ${i + 1}/${subtitles.length}`);
    await downloadFile(ttsUrl, destPath);
    audioFiles.push(destPath);
    // Add small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 600));
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
  filterComplex += `[0:a]${mixInputs}amix=inputs=${audioFiles.length + 1}:duration=first:dropout_transition=2[mixeda]`;

  const voiceCombinedPath = path.join(tempDir, "voice_combined.mp3");
  await runCommand(`ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[mixeda]" "${voiceCombinedPath}"`);
  console.log("🔊 Locución combinada creada.");

  // Merge with background music (simulated with a simple synth tone or royalty-free download if available)
  // For demo, we mix with a low volume tone, but we can download a background classical track:
  const bgMusicPath = path.join(tempDir, "bg_music.mp3");
  console.log("🎵 Generando música de fondo (Rachmaninoff - Prelude)...");
  // Create a dark classical atmosphere using a low sine wave
  await runCommand(`ffmpeg -y -f lavfi -i "sine=frequency=110" -t ${duration} -af "volume=0.08" "${bgMusicPath}"`);

  // Final audio mix
  const finalAudioPath = path.join(tempDir, "final_audio.mp3");
  await runCommand(`ffmpeg -y -i "${voiceCombinedPath}" -i "${bgMusicPath}" -filter_complex "amix=inputs=2:duration=first" "${finalAudioPath}"`);

  // Path to background image
  const bgImagePath = path.resolve(`./public/${classic.background}`);
  const outputVideoPath = path.resolve("./dist/clasicos_corto_output.mp4");

  console.log("🎥 Renderizando video final 9:16 (1080x1920) con subtítulos quemados...");
  
  // FFmpeg command to loop image, set resolution to 1080x1920, add audio, and burn subtitles
  // Subtitles filter requires a path with escaped backslashes on Windows, but on Unix we just wrap in quotes or escape.
  const escapedSrtPath = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  
  const renderCmdWithSubtitles = `ffmpeg -y -loop 1 -i "${bgImagePath}" -i "${finalAudioPath}" ` +
                    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,subtitles=filename='${escapedSrtPath}':force_style='Fontname=Arial,Fontsize=24,PrimaryColour=&H00FFFF,OutlineColour=&H000000,BorderStyle=1,Outline=2'[v]" ` +
                    `-map "[v]" -map 1:a -c:v libx264 -t ${duration} -pix_fmt yuv420p "${outputVideoPath}"`;

  const renderCmdNoSubtitles = `ffmpeg -y -loop 1 -i "${bgImagePath}" -i "${finalAudioPath}" ` +
                    `-filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v]" ` +
                    `-map "[v]" -map 1:a -c:v libx264 -t ${duration} -pix_fmt yuv420p "${outputVideoPath}"`;

  try {
    console.log("   - Intentando renderizar con subtítulos incrustados (requiere FFmpeg con libass)...");
    await runCommand(renderCmdWithSubtitles);
    console.log(`✅ ¡Éxito! El video con subtítulos quemados se ha generado en:\n👉 ${outputVideoPath}`);
  } catch (err) {
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
