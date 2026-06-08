import fs from "fs";
import path from "path";
import https from "https";
import { exec } from "child_process";
import { classicsData } from "../src/data/classicsData.js";

// Helper to run shell commands
const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Helper to make HTTPS requests
const makeRequest = (url, options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

// Upload video to a temporary public URL (required for Instagram Graph API fallback)
const uploadToTempStorage = async (filePath) => {
  console.log("📤 Subiendo video a almacenamiento temporal público (tmpfiles.org)...");
  return new Promise((resolve, reject) => {
    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const postData = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`),
      fileData,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const options = {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": postData.length
      }
    };

    const req = https.request("https://tmpfiles.org/api/v1/upload", options, (res) => {
      let responseBody = "";
      res.on("data", (chunk) => { responseBody += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(responseBody);
          if (json.status === "success" && json.data && json.data.url) {
            const downloadUrl = json.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
            resolve(downloadUrl);
          } else {
            reject(new Error("Upload failed: " + responseBody));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
};

// Publish video to Instagram Reels (Fallback Mode)
const publishToInstagram = async (videoUrl, caption) => {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    console.log("ℹ️ Saltando Instagram (Faltan variables INSTAGRAM_ACCESS_TOKEN o INSTAGRAM_ACCOUNT_ID)");
    return;
  }

  console.log("📸 [Directo] Publicando en Instagram Reels...");
  const containerUrl = `https://graph.facebook.com/v19.0/${accountId}/media?media_type=REELS&video_url=${encodeURIComponent(videoUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`;
  const response = await makeRequest(containerUrl, { method: "POST" });
  
  if (response.statusCode !== 200 || !response.body.id) {
    console.error("❌ Error al crear contenedor de Instagram:", response.body);
    return;
  }

  const containerId = response.body.id;
  console.log(`   - Contenedor creado con ID: ${containerId}. Esperando procesamiento...`);

  let isReady = false;
  let attempts = 0;
  while (!isReady && attempts < 10) {
    await new Promise(r => setTimeout(r, 15000));
    attempts++;
    
    const statusUrl = `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${accessToken}`;
    const statusRes = await makeRequest(statusUrl, { method: "GET" });
    
    console.log(`   - Intento ${attempts}: Estado del video -> ${statusRes.body.status_code}`);
    if (statusRes.body.status_code === "FINISHED") {
      isReady = true;
    } else if (statusRes.body.status_code === "ERROR") {
      console.error("❌ Meta no pudo procesar el video:", statusRes.body);
      return;
    }
  }

  if (!isReady) {
    console.error("❌ Tiempo de espera agotado en Instagram.");
    return;
  }

  const publishUrl = `https://graph.facebook.com/v19.0/${accountId}/media_publish?creation_id=${containerId}&access_token=${accessToken}`;
  const publishRes = await makeRequest(publishUrl, { method: "POST" });

  if (publishRes.statusCode === 200) {
    console.log("✅ ¡Publicado en Instagram Reels! ID:", publishRes.body.id);
  } else {
    console.error("❌ Error al publicar en Instagram:", publishRes.body);
  }
};

// Publish video to YouTube Shorts (Fallback Mode)
const publishToYouTube = async (filePath, title, description) => {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.log("ℹ️ Saltando YouTube Shorts (Faltan variables YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET o YOUTUBE_REFRESH_TOKEN)");
    return;
  }

  console.log("🎥 [Directo] Publicando en YouTube Shorts...");
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const postData = `client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`;
  const tokenRes = await makeRequest(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  }, postData);

  if (!tokenRes.body.access_token) {
    console.error("❌ Error al refrescar token de YouTube:", tokenRes.body);
    return;
  }

  const accessToken = tokenRes.body.access_token;
  const metadata = {
    snippet: {
      title: title.substring(0, 100),
      description: description,
      categoryId: "22",
      tags: ["shorts", "literatura", "libros"]
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false
    }
  };

  const metadataStr = JSON.stringify(metadata);
  const uploadInitUrl = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
  
  const uploadUrl = await new Promise((resolve, reject) => {
    const req = https.request(uploadInitUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": fs.statSync(filePath).size,
        "X-Upload-Content-Type": "video/mp4"
      }
    }, (res) => {
      if (res.headers.location) {
        resolve(res.headers.location);
      } else {
        reject(new Error("Missing Location header for YouTube upload: " + res.statusCode));
      }
    });
    req.on("error", reject);
    req.write(metadataStr);
    req.end();
  });

  const videoBuffer = fs.readFileSync(filePath);
  const uploadFileRes = await makeRequest(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": videoBuffer.length,
      "Content-Type": "video/mp4"
    }
  }, videoBuffer);

  if (uploadFileRes.statusCode === 200 || uploadFileRes.statusCode === 201) {
    console.log("✅ ¡Publicado en YouTube Shorts! ID:", uploadFileRes.body.id);
  } else {
    console.error("❌ Error al subir archivo a YouTube:", uploadFileRes.body);
  }
};

async function main() {
  const filePath = path.resolve("./dist/clasicos_corto_output.mp4");
  if (!fs.existsSync(filePath)) {
    console.error(`❌ El archivo de video no existe en: ${filePath}`);
    process.exit(1);
  }

  const classic = classicsData[0];
  const title = `${classic.title} - ${classic.author}`;
  const description = `¿Conocías este gran clásico de la literatura rusa? Escribe tu opinión en comentarios. 👇\n\n${classic.hashtags}`;

  const simplifiedKey = process.env.SIMPLIFIED_API_KEY;
  const simplifiedAccounts = process.env.SIMPLIFIED_ACCOUNT_IDS; // comma-separated account IDs for TikTok, Reels, Shorts

  if (simplifiedKey && simplifiedAccounts) {
    console.log("🚀 [UNIFICADO] Publicando a través de Simplified CLI (TikTok + Instagram + YouTube)...");
    try {
      // Step 1: Import video file as workspace asset
      console.log("   - Importando video en la nube de Simplified...");
      const importRes = await runCommand(`simplified assets:import --path "${filePath}"`);
      const asset = JSON.parse(importRes);
      const assetId = asset.id || (asset.data && asset.data.id);
      
      if (!assetId) {
        throw new Error("No se pudo obtener el ID del recurso importado: " + importRes);
      }
      console.log(`   - Recurso importado con éxito. ID: ${assetId}`);

      // Step 2: Create post on all connected platforms
      console.log("   - Creando la publicación multiplataforma...");
      const escapedDesc = description.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const postCmd = `simplified posts:create -c "${escapedDesc}" -a "${simplifiedAccounts}" --asset-id "${assetId}" --action publish`;
      const postRes = await runCommand(postCmd);
      console.log("✅ ¡Éxito! Publicado simultáneamente en todos los canales:", postRes);
    } catch (err) {
      console.error("❌ Error al publicar a través de Simplified CLI:", err.message);
    }
  } else {
    console.log("ℹ️ No se detectó SIMPLIFIED_API_KEY. Iniciando publicaciones directas individuales...");
    
    // 1. YouTube Shorts (Direct)
    try {
      await publishToYouTube(filePath, title, description);
    } catch (e) {
      console.error("❌ Error en YouTube:", e);
    }

    // 2. Instagram Reels (Direct)
    try {
      const tempUrl = await uploadToTempStorage(filePath);
      await publishToInstagram(tempUrl, description);
    } catch (e) {
      console.error("❌ Error en Instagram:", e);
    }
  }
  
  console.log("🏁 Proceso de publicación terminado.");
}

main().catch(console.error);
