const path = require("path");
require("dotenv").config();

const STORAGE_ROOT = path.join(__dirname, "..", "storage");

const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  frontendOrigins: (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",

  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_MB || "500", 10) * 1024 * 1024,

  minClipSeconds: parseInt(process.env.MIN_CLIP_SECONDS || "15", 10),
  maxClipSeconds: parseInt(process.env.MAX_CLIP_SECONDS || "90", 10),
  defaultClipSeconds: parseInt(process.env.DEFAULT_CLIP_SECONDS || "35", 10),

  cleanupAfterMinutes: parseInt(process.env.CLEANUP_AFTER_MINUTES || "120", 10),

  rateLimitWindowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || "15", 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10", 10),

  storage: {
    root: STORAGE_ROOT,
    uploads: path.join(STORAGE_ROOT, "uploads"),
    outputs: path.join(STORAGE_ROOT, "outputs"),
    tmp: path.join(STORAGE_ROOT, "tmp"),
    jobsFile: path.join(STORAGE_ROOT, "jobs.json"),
  },

  allowedMimeTypes: [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
  ],
  allowedExtensions: [".mp4", ".mov", ".webm", ".mkv"],
};

config.hasAiKeysConfigured = Boolean(config.openaiApiKey && config.anthropicApiKey);

module.exports = config;
