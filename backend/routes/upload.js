const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { auth } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uwm",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("รองรับเฉพาะไฟล์ JPG, PNG และ WEBP");
      err.code = "INVALID_FILE_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
});

router.post("/", auth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: "ไฟล์มีขนาดใหญ่เกิน 5 MB",
        });
      }

      if (err.code === "INVALID_FILE_TYPE") {
        return res.status(400).json({ message: err.message });
      }

      console.error("Upload error:", err);
      return res.status(500).json({ message: "อัปโหลดรูปไม่สำเร็จ" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "ไม่มีไฟล์" });
    }

    return res.json({ filename: req.file.path });
  });
});

module.exports = router;
