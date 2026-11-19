const fs = require("fs");
const OpenAI = require("openai");
const config = require("../config");
const { ApiError } = require("../middleware/errorHandler");

function getClient() {
  if (!config.openaiApiKey) {
    throw new ApiError(
      503,
      "خدمة تفريغ الصوت غير مُفعّلة: لم يتم ضبط مفتاح OpenAI API على الخادم."
    );
  }
  return new OpenAI({ apiKey: config.openaiApiKey });
}

/**
 * Transcribes an audio/video file using OpenAI's Whisper API and returns
 * word-free, sentence-level segments with start/end timestamps.
 * This is a real external API call — never returns synthetic data.
 *
 * @param {string} filePath - path to the local video/audio file
 * @returns {Promise<{ text: string, segments: Array<{start:number,end:number,text:string}>, language: string }>}
 */
async function transcribeVideo(filePath) {
  const client = getClient();

  if (!fs.existsSync(filePath)) {
    throw new ApiError(500, "ملف الفيديو غير موجود للتفريغ الصوتي.");
  }

  let response;
  try {
    response = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err.message;
    throw new ApiError(502, `فشل تفريغ الصوت عبر Whisper: ${detail}`);
  }

  const segments = (response.segments || []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
  }));

  if (segments.length === 0) {
    throw new ApiError(
      422,
      "تعذّر استخراج أي كلام من الفيديو. تأكد من أن الفيديو يحتوي على صوت واضح."
    );
  }

  return {
    text: response.text || "",
    segments,
    language: response.language || "unknown",
  };
}

module.exports = { transcribeVideo };
