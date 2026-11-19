const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const config = require("../config");
const { ApiError } = require("./errorHandler");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.uploads);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = config.allowedExtensions.includes(ext) ? ext : ".mp4";
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimeOk = config.allowedMimeTypes.includes(file.mimetype);
  const extOk = config.allowedExtensions.includes(ext);

  if (!mimeOk || !extOk) {
    return cb(
      new ApiError(
        400,
        "نوع الملف غير مدعوم. الأنواع المسموحة: MP4, MOV, WEBM, MKV."
      )
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
  },
});

module.exports = upload;
