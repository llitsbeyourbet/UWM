const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

// ดึงการแจ้งเตือนของ user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { toUserId: req.userId },
      order: [["createdAt", "DESC"]],
    });
    res.json(notifications);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// สร้างการแจ้งเตือน
router.post("/", auth, async (req, res) => {
  try {
    const { type, toUserId, activityId, activityName, fromUsername } = req.body;
    const notif = await Notification.create({
      type,
      fromUserId: req.userId,
      toUserId,
      activityId,
      activityName,
      fromUsername,
    });
    res.status(201).json(notif);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// อัปเดตสถานะ (ยอมรับ/ปฏิเสธ)
router.put("/:id", auth, async (req, res) => {
  try {
    const { type } = req.body;

    const notif = await Notification.findByPk(req.params.id);
    if (!notif) return res.status(404).json({ message: "ไม่พบการแจ้งเตือน" });

    await notif.update({ type, isRead: true });

    const owner = await User.findByPk(req.userId);

    if (type === "join_confirmed") {
      await Notification.create({
        type: "join_confirmed",
        fromUserId: req.userId,
        toUserId: notif.fromUserId,
        activityId: notif.activityId,
        activityName: notif.activityName,
        fromUsername: owner.username,
        isRead: false,
      });
    }

    if (type === "join_rejected") {
      await Notification.create({
        type: "join_rejected",
        fromUserId: req.userId,
        toUserId: notif.fromUserId,
        activityId: notif.activityId,
        activityName: notif.activityName,
        fromUsername: owner.username,
        isRead: false,
      });
    }

    res.json({ message: "อัปเดตสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// อ่านแจ้งเตือนแล้ว
router.put("/:id/read", auth, async (req, res) => {
  try {
    await Notification.update({ isRead: true }, { where: { id: req.params.id } });
    res.json({ message: "อ่านแล้ว" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;