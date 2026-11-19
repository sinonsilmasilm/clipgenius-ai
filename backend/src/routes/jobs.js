const express = require("express");
const upload = require("../middleware/upload");
const { createJobLimiter, generalLimiter } = require("../middleware/rateLimiter");
const controller = require("../controllers/jobsController");

const router = express.Router();

// Create a new clipping job (upload OR direct URL — validated in controller).
router.post("/", createJobLimiter, upload.single("video"), controller.createJob);

// Poll job status/progress.
router.get("/:id", generalLimiter, controller.getJobStatus);

// Fetch final results once status === "done".
router.get("/:id/results", generalLimiter, controller.getJobResults);

// Download a specific generated clip.
router.get("/:id/download/:filename", generalLimiter, controller.downloadClip);

module.exports = router;
