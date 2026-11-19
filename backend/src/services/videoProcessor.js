const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const bundledFfmpegPath = require("ffmpeg-static");
const ffmpegPath = process.env.FFMPEG_PATH || bundledFfmpegPath || "ffmpeg";
const { buildSrtForClip } = require("../utils/srt");
const { ApiError } = require("../middleware/errorHandler");

ffmpeg.setFfmpegPath(ffmpegPath);

function probeDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(new ApiError(500, `فشل تحليل ملف الفيديو: ${err.message}`));
      resolve(data.format.duration || 0);
    });
  });
}

/**
 * Cuts [start, end] out of sourcePath, crops/scales it to vertical 9:16,
 * and writes the result to outputPath. If segments are provided, attempts
 * to burn in subtitles; on subtitle failure it falls back to a clip WITHOUT
 * subtitles rather than failing the whole job, and reports that via the
 * returned { subtitlesBurned } flag — never silently fakes success.
 */
async function extractVerticalClip({ sourcePath, outputPath, start, end, segments, tmpDir }) {
  const duration = Math.max(0.5, end - start);
  const srtContent = segments ? buildSrtForClip(segments, start, end) : null;

  const vfBase = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";

  async function run(withSubtitles) {
    let srtPath = null;
    if (withSubtitles && srtContent) {
      srtPath = path.join(tmpDir, `${path.basename(outputPath, ".mp4")}.srt`);
      fs.writeFileSync(srtPath, srtContent, "utf-8");
    }

    const vf = withSubtitles && srtPath
      ? `${vfBase},subtitles=${srtPath.replace(/\\/g, "/").replace(/:/g, "\\:")}:force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3'`
      : vfBase;

    return new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .setStartTime(start)
        .setDuration(duration)
        .videoFilters(vf)
        .outputOptions(["-c:v libx264", "-preset veryfast", "-crf 23", "-c:a aac", "-b:a 128k", "-movflags +faststart"])
        .on("error", (err) => reject(err))
        .on("end", () => resolve())
        .save(outputPath);
    });
  }

  if (srtContent) {
    try {
      await run(true);
      return { subtitlesBurned: true };
    } catch (err) {
      console.warn(`[videoProcessor] subtitle burn-in failed, retrying without subtitles: ${err.message}`);
    }
  }

  try {
    await run(false);
    return { subtitlesBurned: false };
  } catch (err) {
    throw new ApiError(500, `فشل استخراج المقطع عبر FFmpeg: ${err.message}`);
  }
}

module.exports = { probeDuration, extractVerticalClip };
