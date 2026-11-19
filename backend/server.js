const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require("fs");

const config = require("./src/config");
const jobsRouter = require("./src/routes/jobs");
const { errorHandler, ApiError } = require("./src/middleware/errorHandler");
const { startCleanupScheduler } = require("./src/services/cleanup");

// Ensure storage directories exist (useful on a fresh deploy with an empty volume).
for (const dir of [config.storage.uploads, config.storage.outputs, config.storage.tmp]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools (no origin header) and any configured origin.
    if (!origin || config.frontendOrigins.length === 0 || config.frontendOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new ApiError(403, "الأصل غير مسموح به (CORS)."));
  },
};
app.use(cors(corsOptions));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    aiConfigured: config.hasAiKeysConfigured,
    time: new Date().toISOString(),
  });
});

app.use("/api/jobs", jobsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "المسار غير موجود." });
});

app.use(errorHandler);

if (!config.hasAiKeysConfigured) {
  console.warn(
    "[startup] WARNING: OPENAI_API_KEY و/أو ANTHROPIC_API_KEY غير مضبوطة. " +
      "إنشاء مهام جديدة سيُرفض حتى يتم ضبط المفاتيح — لن يتم إرجاع نتائج وهمية."
  );
}

startCleanupScheduler();

app.listen(config.port, () => {
  console.log(`ClipGenius AI backend listening on port ${config.port}`);
});
