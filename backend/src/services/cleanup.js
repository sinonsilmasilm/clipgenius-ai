const fs = require("fs");
const path = require("path");
const config = require("../config");
const jobStore = require("./jobStore");

function removeIfExists(p) {
  try {
    if (p && fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn(`[cleanup] failed to remove ${p}: ${err.message}`);
  }
}

function cleanupJobFiles(job) {
  if (job.sourcePath) removeIfExists(job.sourcePath);
  const outputDir = path.join(config.storage.outputs, job.id);
  removeIfExists(outputDir);
}

function runCleanupSweep() {
  const cutoffMs = config.cleanupAfterMinutes * 60 * 1000;
  const now = Date.now();
  for (const job of jobStore.listJobs()) {
    const isTerminal = job.status === "done" || job.status === "failed";
    if (!isTerminal) continue;
    const updatedAt = new Date(job.updatedAt || job.createdAt).getTime();
    if (now - updatedAt > cutoffMs && !job.filesCleaned) {
      cleanupJobFiles(job);
      jobStore.updateJob(job.id, { filesCleaned: true });
    }
  }
}

function startCleanupScheduler() {
  // Run every 15 minutes.
  setInterval(runCleanupSweep, 15 * 60 * 1000);
  // Also run once shortly after startup.
  setTimeout(runCleanupSweep, 60 * 1000);
}

module.exports = { startCleanupScheduler, cleanupJobFiles, runCleanupSweep };
