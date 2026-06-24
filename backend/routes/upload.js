const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads")); // 👈 ชี้ไปโฟลเดอร์นอก backend
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

router.post("/", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "ไม่มีไฟล์" });
  res.json({ filename: req.file.filename }); // 👈 ส่งแค่ชื่อไฟล์
});

module.exports = router;