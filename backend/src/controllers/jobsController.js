const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const jobStore = require("../services/jobStore");
const queue = require("../services/queue");
const { fetchDirectVideoUrl } = require("../services/videoFetcher");
const { probeDuration } = require("../services/videoProcessor");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const createJob = asyncHandler(async (req, res) => {
  if (!config.hasAiKeysConfigured) {
    throw new ApiError(
      503,
      "الخادم غير مُهيّأ بعد: مفاتيح واجهات الذكاء الاصطناعي (Whisper / Claude) غير مضبوطة. لا يمكن إنشاء مهمة حقيقية بدونها."
    );
  }

  const { url, language } = req.body;
  const file = req.file;

  if (!file && !url) {
    throw new ApiError(400, "يجب رفع ملف فيديو أو إدخال رابط مباشر للفيديو.");
  }
  if (file && url) {
    throw new ApiError(400, "اختر مصدراً واحداً فقط: إما رفع ملف أو رابط مباشر.");
  }

  let sourcePath;
  if (file) {
    sourcePath = file.path;
  } else {
    sourcePath = await fetchDirectVideoUrl(url);
  }

  let durationSeconds;
  try {
    durationSeconds = await probeDuration(sourcePath);
  } catch (err) {
    fs.unlink(sourcePath, () => {});
    throw err;
  }

  if (!durationSeconds || durationSeconds < 3) {
    fs.unlink(sourcePath, () => {});
    throw new ApiError(400, "الفيديو قصير جداً أو تالف. تأكد من صلاحية الملف.");
  }

  const minClip = clampInt(req.body.minClip, 5, 600, config.minClipSeconds);
  const maxClip = clampInt(req.body.maxClip, minClip, 600, config.maxClipSeconds);
  const targetClip = clampInt(req.body.targetClip, minClip, maxClip, config.defaultClipSeconds);
  const maxClips = clampInt(req.body.maxClips, 1, 6, 3);

  const jobId = uuidv4();
  const job = {
    id: jobId,
    status: "queued",
    progress: 5,
    sourcePath,
    sourceDurationSeconds: durationSeconds,
    language: language || "العربية",
    minClip,
    maxClip,
    targetClip,
    maxClips,
    clips: [],
    error: null,
    filesCleaned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobStore.createJob(job);
  queue.enqueue(jobId);

  res.status(202).json({
    jobId,
    status: job.status,
    message: "تم استلام الفيديو، وبدأت المعالجة.",
  });
});

const getJobStatus = asyncHandler(async (req, res) => {
  const job = jobStore.getJob(req.params.id);
  if (!job) throw new ApiError(404, "المهمة غير موجودة.");

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});

const getJobResults = asyncHandler(async (req, res) => {
  const job = jobStore.getJob(req.params.id);
  if (!job) throw new ApiError(404, "المهمة غير موجودة.");

  if (job.status !== "done") {
    throw new ApiError(409, "المهمة لم تكتمل بعد.", { status: job.status, progress: job.progress });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    language: job.language,
    sourceDurationSeconds: job.sourceDurationSeconds,
    clips: job.clips,
  });
});

const downloadClip = asyncHandler(async (req, res) => {
  const job = jobStore.getJob(req.params.id);
  if (!job) throw new ApiError(404, "المهمة غير موجودة.");

  const filename = path.basename(req.params.filename); // prevent path traversal
  const filePath = path.join(config.storage.outputs, job.id, filename);

  if (!fs.existsSync(filePath)) {
    throw new ApiError(404, "الملف غير موجود أو تم حذفه بعد انتهاء مدة الاحتفاظ به.");
  }

  res.download(filePath, filename);
});

module.exports = { createJob, getJobStatus, getJobResults, downloadClip };
