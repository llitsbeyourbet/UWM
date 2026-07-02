const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Cloudinary config:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "set" : "not set",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "set" : "not set",
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "uwm",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({ storage });

router.post("/", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.log("Multer error:", err);
      return res.status(500).json({ message: err.message });
    }
    if (!req.file) return res.status(400).json({ message: "ไม่มีไฟล์" });
    console.log("file:", JSON.stringify(req.file));
    res.json({ filename: req.file.path });
  });
});

module.exports = router;