import fs from "fs";
import https from "https";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function sendTelegramVideo(videoPath, caption) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("ERROR: Telegram bot token or chat ID not set");
      reject(new Error("Missing credentials"));
      return;
    }

    if (!fs.existsSync(videoPath)) {
      console.error(`ERROR: Video file not found: ${videoPath}`);
      reject(new Error("Video file not found"));
      return;
    }

    const boundary = "----WebKitFormBoundary" + Date.now();
    const videoData = fs.readFileSync(videoPath);

    // Build multipart form data with proper line endings
    const preVideo = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="chat_id"`,
      "",
      TELEGRAM_CHAT_ID,
      `--${boundary}`,
      `Content-Disposition: form-data; name="caption"`,
      "",
      caption,
      `--${boundary}`,
      `Content-Disposition: form-data; name="parse_mode"`,
      "",
      "HTML",
      `--${boundary}`,
      `Content-Disposition: form-data; name="video"; filename="classic_video.mp4"`,
      `Content-Type: video/mp4`,
      ""
    ].join("\r\n");

    const postVideo = `\r\n--${boundary}--`;

    const totalLength = Buffer.byteLength(preVideo) + videoData.length + Buffer.byteLength(postVideo);

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": totalLength
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          if (response.ok) {
            resolve(response);
          } else {
            reject(new Error(response.description));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    
    // Write data in chunks to avoid memory issues
    req.write(preVideo);
    req.write(videoData);
    req.write(postVideo);
    req.end();
  });
}

async function main() {
  const videoPath = "./output/video.mp4";
  const topic = process.env.TOPIC || "random classic literature";

  console.log("Starting Telegram notification...");
  console.log(`Video path: ${videoPath}`);
  console.log(`Topic: ${topic}`);

  if (!fs.existsSync(videoPath)) {
    console.error(`ERROR: Video file not found: ${videoPath}`);
    process.exit(1);
  }

  console.log("Video file exists, checking size...");
  const videoStats = fs.statSync(videoPath);
  console.log(`Video size: ${videoStats.size} bytes`);

  // Read social media descriptions
  let tiktokCaption = "No TikTok description available";
  let instagramCaption = "No Instagram description available";
  let hashtags = "";

  console.log("Reading social media files...");
  try {
    if (fs.existsSync("./output/tiktok.txt")) {
      tiktokCaption = fs.readFileSync("./output/tiktok.txt", "utf-8").trim();
      console.log(`TikTok caption loaded (${tiktokCaption.length} chars)`);
    } else {
      console.log("TikTok file not found");
    }
    if (fs.existsSync("./output/instagram.txt")) {
      instagramCaption = fs.readFileSync("./output/instagram.txt", "utf-8").trim();
      console.log(`Instagram caption loaded (${instagramCaption.length} chars)`);
    } else {
      console.log("Instagram file not found");
    }
    if (fs.existsSync("./output/hashtags.txt")) {
      hashtags = fs.readFileSync("./output/hashtags.txt", "utf-8").trim();
      console.log(`Hashtags loaded (${hashtags.length} chars)`);
    } else {
      console.log("Hashtags file not found");
    }
  } catch (error) {
    console.warn("Warning: Could not read social media files:", error.message);
  }

  const caption = `<b>🎬 New Russian Classics Video</b>\n\n<b>Topic:</b> ${topic}\n\n<b>TikTok:</b>\n${tiktokCaption}\n\n<b>Instagram:</b>\n${instagramCaption}\n\n<b>Hashtags:</b>\n${hashtags}`;

  console.log("Sending video to Telegram...");
  console.log(`Caption length: ${caption.length} chars`);
  try {
    await sendTelegramVideo(videoPath, caption);
    console.log("✅ Video sent successfully!");
  } catch (error) {
    console.error("❌ Failed to send video:", error.message);
    console.error("Error details:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
