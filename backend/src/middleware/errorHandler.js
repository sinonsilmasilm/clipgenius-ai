class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details || null;
  }
}

// Catches errors thrown in async route handlers without needing try/catch everywhere.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Must be registered last, after all routes.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.name === "MulterError") {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "الملف أكبر من الحد المسموح به."
        : "حدث خطأ أثناء رفع الملف.";
    return res.status(400).json({ error: message, code: err.code });
  }

  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500
      ? "حدث خطأ داخلي في الخادم. حاول مرة أخرى لاحقاً."
      : err.message || "طلب غير صالح.";

  if (statusCode === 500) {
    // Log full detail server-side only; never leak internals to the client.
    console.error("[unhandled-error]", err);
  }

  res.status(statusCode).json({
    error: message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { ApiError, asyncHandler, errorHandler };
