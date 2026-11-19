const fs = require("fs");
const config = require("../config");

// Simple in-memory map, periodically/immediately flushed to a JSON file so
// job history survives a restart. This is intentionally NOT a database —
// it's sized for a single-instance, low-volume deployment. If you outgrow
// this, swap it for Postgres/SQLite without changing the controller code
// (everything goes through the functions below).

let jobs = new Map();

function loadFromDisk() {
  try {
    if (fs.existsSync(config.storage.jobsFile)) {
      const raw = fs.readFileSync(config.storage.jobsFile, "utf-8");
      const parsed = JSON.parse(raw);
      jobs = new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error("[jobStore] failed to load jobs.json, starting fresh:", err.message);
    jobs = new Map();
  }
}

let writeQueued = false;
function persist() {
  if (writeQueued) return;
  writeQueued = true;
  setImmediate(() => {
    writeQueued = false;
    try {
      const obj = Object.fromEntries(jobs);
      fs.writeFileSync(config.storage.jobsFile, JSON.stringify(obj, null, 2));
    } catch (err) {
      console.error("[jobStore] failed to persist jobs.json:", err.message);
    }
  });
}

function createJob(job) {
  jobs.set(job.id, job);
  persist();
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, patch) {
  const existing = jobs.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(id, updated);
  persist();
  return updated;
}

function listJobs() {
  return Array.from(jobs.values());
}

function deleteJob(id) {
  const existed = jobs.delete(id);
  if (existed) persist();
  return existed;
}

loadFromDisk();

module.exports = { createJob, getJob, updateJob, listJobs, deleteJob };
