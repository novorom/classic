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

    const formData = [
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
      "Content-Type: video/mp4",
      "",
      videoData.toString("base64"),
      `--${boundary}--`
    ].join("\r\n");

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendVideo`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": Buffer.byteLength(formData)
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
    req.write(formData);
    req.end();
  });
}

async function main() {
  const videoPath = "./output/video.mp4";
  const topic = process.env.TOPIC || "random classic literature";

  if (!fs.existsSync(videoPath)) {
    console.error(`ERROR: Video file not found: ${videoPath}`);
    process.exit(1);
  }

  const caption = `<b>🎬 New Russian Classics Video</b>\n\n<b>Topic:</b> ${topic}\n\n<b>Video ready for manual posting to TikTok, Instagram Reels, and YouTube Shorts!</b>`;

  console.log("Sending video to Telegram...");
  try {
    await sendTelegramVideo(videoPath, caption);
    console.log("✅ Video sent successfully!");
  } catch (error) {
    console.error("❌ Failed to send video:", error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
