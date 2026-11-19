const Anthropic = require("@anthropic-ai/sdk");
const config = require("../config");
const { ApiError } = require("../middleware/errorHandler");

function getClient() {
  if (!config.anthropicApiKey) {
    throw new ApiError(
      503,
      "خدمة تحليل اللحظات غير مُفعّلة: لم يتم ضبط مفتاح Anthropic API على الخادم."
    );
  }
  return new Anthropic({ apiKey: config.anthropicApiKey });
}

function buildTranscriptBlock(segments) {
  return segments
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`)
    .join("\n");
}

function extractJson(text) {
  // Claude is instructed to return raw JSON, but guard against stray fencing.
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

/**
 * Sends the real transcript to Claude and asks it to select the best
 * highlight moments, each sized within [minClip, maxClip] seconds, with a
 * title, description, and hashtags. Returns real model output — if the
 * call fails or returns unusable data, this throws rather than fabricating
 * a result.
 *
 * @param {Array<{start:number,end:number,text:string}>} segments
 * @param {object} opts { minClip, maxClip, targetClip, language, maxClips }
 */
async function analyzeTranscript(segments, opts) {
  const client = getClient();
  const {
    minClip = config.minClipSeconds,
    maxClip = config.maxClipSeconds,
    targetClip = config.defaultClipSeconds,
    language = "العربية",
    maxClips = 3,
  } = opts || {};

  const totalDuration = segments.length ? segments[segments.length - 1].end : 0;
  const transcriptBlock = buildTranscriptBlock(segments);

  const prompt = `لديك تفريغ صوتي حقيقي لفيديو مدته تقريباً ${totalDuration.toFixed(
    0
  )} ثانية. كل سطر يبدأ بالزمن [بداية-نهاية] بالثواني.

النص المفرّغ:
${transcriptBlock}

المطلوب: اختر حتى ${maxClips} لحظات هي الأكثر إثارة للاهتمام أو قابلية للمشاركة، بحيث تكون مدة كل مقطع بين ${minClip} و ${maxClip} ثانية (الهدف المفضل تقريباً ${targetClip} ثانية)، ويجب أن تتطابق أزمنة البداية والنهاية مع أزمنة موجودة فعلياً ضمن النص أعلاه (لا تخترع أزمنة غير موجودة).

لكل مقطع، اكتب بلغة "${language}":
- عنوان قصير وجذاب (title)
- وصف من جملتين كحد أقصى (description)
- 3 إلى 5 هاشتاغات مناسبة للمحتوى بدون الرمز # (hashtags كمصفوفة نصوص)

أعد الإجابة بصيغة JSON فقط دون أي نص إضافي، بهذا الشكل بالضبط:
{"clips":[{"start":number,"end":number,"title":"string","description":"string","hashtags":["string"]}]}`;

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw new ApiError(502, `فشل تحليل اللحظات عبر Claude: ${err.message}`);
  }

  const textBlock = (response.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    throw new ApiError(502, "لم يُعد نموذج التحليل أي نتيجة نصية قابلة للاستخدام.");
  }

  let parsed;
  try {
    parsed = extractJson(textBlock.text);
  } catch (err) {
    throw new ApiError(502, "تعذّر تفسير نتيجة تحليل اللحظات (صيغة غير صالحة).");
  }

  if (!parsed || !Array.isArray(parsed.clips) || parsed.clips.length === 0) {
    throw new ApiError(
      422,
      "لم يتمكن التحليل من تحديد أي لحظات مناسبة في هذا الفيديو."
    );
  }

  // Validate & clamp against real constraints — never trust the model blindly.
  const valid = parsed.clips
    .filter(
      (c) =>
        typeof c.start === "number" &&
        typeof c.end === "number" &&
        c.end > c.start &&
        c.start >= 0 &&
        c.end <= totalDuration + 1
    )
    .map((c) => ({
      start: c.start,
      end: c.end,
      title: String(c.title || "مقطع بدون عنوان").slice(0, 120),
      description: String(c.description || "").slice(0, 400),
      hashtags: Array.isArray(c.hashtags) ? c.hashtags.slice(0, 6).map(String) : [],
    }))
    .slice(0, maxClips);

  if (valid.length === 0) {
    throw new ApiError(
      422,
      "نتائج التحليل لم تطابق أزمنة حقيقية ضمن الفيديو — تم رفضها بدلاً من استخدام بيانات غير موثوقة."
    );
  }

  return valid;
}

module.exports = { analyzeTranscript };
