const rateLimit = require("express-rate-limit");
const config = require("../config");

// Applies to job-creation (the expensive, abusable endpoint).
const createJobLimiter = rateLimit({
  windowMs: config.rateLimitWindowMinutes * 60 * 1000,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "عدد كبير من الطلبات. يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.",
  },
});

// Looser general limiter for read-only endpoints (status polling, downloads).
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { createJobLimiter, generalLimiter };
