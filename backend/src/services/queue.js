const fs = require("fs");
const path = require("path");
const config = require("../config");
const jobStore = require("./jobStore");
const { transcribeVideo } = require("./transcription");
const { analyzeTranscript } = require("./analysis");
const { probeDuration, extractVerticalClip } = require("./videoProcessor");

// Single-process, single-concurrency queue: processes one job at a time.
// This is intentionally simple (no Redis) for easy single-instance deployment.
// If you need parallel processing later, swap this for BullMQ + Redis without
// changing the HTTP layer.

const pending = [];
let processing = false;

function enqueue(jobId) {
  pending.push(jobId);
  tick();
}

async function tick() {
  if (processing) return;
  const jobId = pending.shift();
  if (!jobId) return;

  processing = true;
  try {
    await processJob(jobId);
  } catch (err) {
    console.error(`[queue] job ${jobId} crashed unexpectedly:`, err);
    jobStore.updateJob(jobId, {
      status: "failed",
      error: "حدث خطأ غير متوقع أثناء المعالجة.",
    });
  } finally {
    processing = false;
    setImmediate(tick);
  }
}

async function processJob(jobId) {
  const job = jobStore.getJob(jobId);
  if (!job) return;

  try {
    jobStore.updateJob(jobId, { status: "transcribing", progress: 20 });
    const transcript = await transcribeVideo(job.sourcePath);

    jobStore.updateJob(jobId, {
      status: "analyzing",
      progress: 45,
      transcriptLanguage: transcript.language,
    });

    const moments = await analyzeTranscript(transcript.segments, {
      minClip: job.minClip,
      maxClip: job.maxClip,
      targetClip: job.targetClip,
      language: job.language,
      maxClips: job.maxClips,
    });

    jobStore.updateJob(jobId, { status: "processing", progress: 60 });

    const outputDir = path.join(config.storage.outputs, jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    const clips = [];
    for (let i = 0; i < moments.length; i++) {
      const m = moments[i];
      const filename = `clip_${i + 1}.mp4`;
      const outputPath = path.join(outputDir, filename);

      const { subtitlesBurned } = await extractVerticalClip({
        sourcePath: job.sourcePath,
        outputPath,
        start: m.start,
        end: m.end,
        segments: transcript.segments,
        tmpDir: config.storage.tmp,
      });

      clips.push({
        id: `${jobId}-clip-${i + 1}`,
        title: m.title,
        description: m.description,
        hashtags: m.hashtags,
        start: m.start,
        end: m.end,
        durationSeconds: Math.round(m.end - m.start),
        subtitlesBurned,
        downloadUrl: `/api/jobs/${jobId}/download/${filename}`,
      });

      jobStore.updateJob(jobId, {
        progress: 60 + Math.round(((i + 1) / moments.length) * 35),
      });
    }

    jobStore.updateJob(jobId, {
      status: "done",
      progress: 100,
      clips,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    jobStore.updateJob(jobId, {
      status: "failed",
      progress: jobStore.getJob(jobId)?.progress || 0,
      error: err.message || "فشلت المعالجة لسبب غير معروف.",
    });
  }
}

module.exports = { enqueue };
