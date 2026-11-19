const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { ApiError } = require("../middleware/errorHandler");

/**
 * Downloads a video from a DIRECT file URL (one that resolves straight to a
 * video file the user has rights to use) into local storage.
 * This deliberately does NOT scrape YouTube/TikTok/Instagram/etc — those
 * require official, authorized APIs and are out of scope here.
 */
async function fetchDirectVideoUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError(400, "الرابط غير صالح.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ApiError(400, "يُسمح فقط بروابط http أو https.");
  }

  let response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (err) {
    throw new ApiError(400, `تعذّر الوصول إلى الرابط: ${err.message}`);
  }

  if (!response.ok) {
    throw new ApiError(400, `الرابط أعاد خطأ (${response.status}). تأكد من صلاحية الوصول إليه.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const isVideoType = config.allowedMimeTypes.some((t) => contentType.includes(t.split("/")[1]));
  if (!contentType.startsWith("video/") && !isVideoType) {
    throw new ApiError(
      400,
      "الرابط لا يشير مباشرة إلى ملف فيديو مدعوم (MP4/MOV/WEBM/MKV)."
    );
  }

  const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
  if (contentLength && contentLength > config.maxUploadBytes) {
    throw new ApiError(400, "حجم الفيديو عبر الرابط أكبر من الحد المسموح به.");
  }

  const ext = contentType.includes("webm")
    ? ".webm"
    : contentType.includes("quicktime")
    ? ".mov"
    : contentType.includes("matroska")
    ? ".mkv"
    : ".mp4";
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const destPath = path.join(config.storage.uploads, filename);

  const fileStream = fs.createWriteStream(destPath);
  let bytesWritten = 0;

  await new Promise((resolve, reject) => {
    const reader = response.body.getReader();
    function pump() {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            fileStream.end(resolve);
            return;
          }
          bytesWritten += value.length;
          if (bytesWritten > config.maxUploadBytes) {
            fileStream.destroy();
            fs.unlink(destPath, () => {});
            reject(new ApiError(400, "حجم الفيديو تجاوز الحد المسموح به أثناء التنزيل."));
            return;
          }
          fileStream.write(Buffer.from(value), () => pump());
        })
        .catch(reject);
    }
    pump();
  });

  return destPath;
}

module.exports = { fetchDirectVideoUrl };
