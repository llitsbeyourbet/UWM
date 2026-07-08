const express = require("express");
const router = express.Router();
const Activity = require("../models/Activity");
const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "ไม่มี token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "token ไม่ถูกต้อง" });
  }
};

// ดึงกิจกรรมทั้งหมด
router.get("/", async (req, res) => {
  try {
    const activities = await Activity.findAll();
    res.json(activities);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงกิจกรรมของผู้ใช้
router.get("/user/:id", async (req, res) => {
  try {
    const activities = await Activity.findAll({
      where: {
        createdBy: req.params.id,
      },
      order: [["createdAt", "DESC"]],
    });

    res.json(activities);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});

// ดึงกิจกรรมตาม id
router.get("/:id", async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// สร้างกิจกรรม
router.post("/", auth, async (req, res) => {
  try {
    const activity = await Activity.create({ ...req.body, createdBy: req.userId });
    res.status(201).json(activity);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// แก้ไขกิจกรรม 👈 เพิ่ม
router.put("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy !== req.userId)
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขกิจกรรมนี้" });

    await activity.update(req.body);
    res.json(activity);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ลบกิจกรรม 👈 แก้ให้เช็คเจ้าของด้วย
router.delete("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy !== req.userId)
      return res.status(403).json({ message: "ไม่มีสิทธิ์ลบกิจกรรมนี้" });

    await activity.destroy();
    res.json({ message: "ลบกิจกรรมสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// 👇 สร้าง QR Token
router.get("/:id/qr", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);

    if (!activity)
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });

    // อนุญาตเฉพาะเจ้าของกิจกรรม
    if (activity.createdBy !== req.userId)
      return res.status(403).json({
        message: "ไม่มีสิทธิ์",
      });

    const qrToken = jwt.sign(
      {
        activityId: activity.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "10s",
      }
    );

    res.json({ qrToken });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});

module.exports = router;