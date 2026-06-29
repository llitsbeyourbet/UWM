const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");
const JoinRequest = require("../models/JoinRequest");

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

// ส่งคำขอเข้าร่วม
router.post("/:activityId", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy === req.userId)
      return res.status(400).json({ message: "ไม่สามารถ join กิจกรรมของตัวเองได้" });

    // เช็คว่าเคยส่งคำขอแล้วไหม
    const existing = await JoinRequest.findOne({
      where: { activityId, userId: req.userId }
    });

    if (existing && existing.status !== "cancelled")
      return res.status(400).json({ message: "ส่งคำขอไปแล้ว" });

    const user = await User.findByPk(req.userId);

    // กิจกรรมสาธารณะ — เข้าร่วมได้เลย
    if (activity.activityType === "public") {
      if (existing) {
        await existing.update({ status: "approved" });
      } else {
        await JoinRequest.create({ activityId, userId: req.userId, status: "approved" });
      }

      // แจ้งเตือนเจ้าของว่ามีคนเข้าร่วม
      await Notification.create({
        type: "join_confirmed",
        fromUserId: req.userId,
        toUserId: activity.createdBy,
        activityId: activity.id,
        activityName: activity.activityName,
        fromUsername: user.username,
        isRead: false,
      });

      return res.status(201).json({ message: "เข้าร่วมกิจกรรมสำเร็จ", status: "approved" });
    }

    // กิจกรรมส่วนตัว — รอเจ้าของอนุมัติ
    if (existing) {
      await existing.update({ status: "pending" });
    } else {
      await JoinRequest.create({ activityId, userId: req.userId, status: "pending" });
    }

    // แจ้งเตือนเจ้าของ
    await Notification.create({
      type: "join_request",
      fromUserId: req.userId,
      toUserId: activity.createdBy,
      activityId: activity.id,
      activityName: activity.activityName,
      fromUsername: user.username,
      isRead: false,
    });

    res.status(201).json({ message: "ส่งคำขอเข้าร่วมสำเร็จ รอการอนุมัติ", status: "pending" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยกเลิกคำขอ
router.put("/:activityId/cancel", auth, async (req, res) => {
  try {
    const { activityId } = req.params;

    const joinRequest = await JoinRequest.findOne({
      where: { activityId, userId: req.userId }
    });

    if (!joinRequest) return res.status(404).json({ message: "ไม่พบคำขอ" });

    await joinRequest.update({ status: "cancelled" });

    res.json({ message: "ยกเลิกคำขอสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// เจ้าของอนุมัติ/ปฏิเสธ
router.put("/:activityId/respond/:userId", auth, async (req, res) => {
  try {
    const { activityId, userId } = req.params;
    const { status } = req.body; // approved หรือ rejected

    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy !== req.userId)
      return res.status(403).json({ message: "ไม่มีสิทธิ์อนุมัติกิจกรรมนี้" });

    const joinRequest = await JoinRequest.findOne({ where: { activityId, userId } });
    if (!joinRequest) return res.status(404).json({ message: "ไม่พบคำขอ" });

    await joinRequest.update({ status });

    const owner = await User.findByPk(req.userId);

    // แจ้งเตือนผู้ขอ
    await Notification.create({
      type: status === "approved" ? "join_confirmed" : "join_rejected",
      fromUserId: req.userId,
      toUserId: userId,
      activityId: activity.id,
      activityName: activity.activityName,
      fromUsername: owner.username,
      isRead: false,
    });

    res.json({ message: status === "approved" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงสถานะคำขอของ user
router.get("/:activityId/status", auth, async (req, res) => {
  try {
    const joinRequest = await JoinRequest.findOne({
      where: { activityId: req.params.activityId, userId: req.userId }
    });
    res.json({ status: joinRequest?.status || null });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรายชื่อคนที่ขอเข้าร่วม (สำหรับเจ้าของ)
router.get("/:activityId/requests", auth, async (req, res) => {
  try {
    const requests = await JoinRequest.findAll({
      where: { activityId: req.params.activityId, status: "pending" },
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// Check-in ด้วย QR Code
router.post("/:activityId/checkin", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { qrToken } = req.body;

    // ตรวจสอบ QR
    try {
      const payload = jwt.verify(
        qrToken,
        process.env.JWT_SECRET
      );

      if (Number(payload.activityId) !== Number(activityId)) {
        return res.status(400).json({
          message: "QR ไม่ถูกต้อง",
        });
      }
    } catch {
      return res.status(400).json({
        message: "QR หมดอายุแล้ว",
      });
    }

    const joinRequest = await JoinRequest.findOne({
      where: {
        activityId,
        userId: req.userId,
      },
    });

    if (!joinRequest) {
      return res.status(404).json({
        message: "ไม่พบคำขอเข้าร่วม",
      });
    }

    // เช็คอินไปแล้ว
    if (joinRequest.status === "checked_in") {
      return res.status(409).json({
        message: "เช็คอินแล้ว",
        status: "checked_in",
      });
    }

    // ยังไม่ได้รับอนุมัติ
    if (joinRequest.status !== "approved") {
      return res.status(400).json({
        message: "ยังไม่ได้รับการอนุมัติ",
      });
    }

    // เช็คช่วงเวลาเช็คอิน
    const activity = await Activity.findByPk(activityId);

    if (activity.checkinStart && activity.checkinEnd) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);

      if (currentTime < activity.checkinStart) {
        return res.status(400).json({
          message: `ยังไม่ถึงเวลาเช็คอิน (เริ่ม ${activity.checkinStart})`,
        });
      }

      if (currentTime > activity.checkinEnd) {
        return res.status(400).json({
          message: `หมดเขตเช็คอินแล้ว (ปิด ${activity.checkinEnd})`,
        });
      }
    }

    const [updated] = await JoinRequest.update(
      { status: "checked_in" },
      {
        where: {
          activityId,
          userId: req.userId,
          status: "approved",
        },
      }
    );

    if (updated === 0) {
      return res.status(409).json({
        message: "เช็คอินแล้ว หรือไม่สามารถเช็คอินได้",
        status: "checked_in",
      });
    }

    res.json({
      message: "ยืนยันการเข้าร่วมสำเร็จ",
      status: "checked_in",
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});

// ดึงกิจกรรมที่ checked_in แล้ว
router.get("/checked-in", auth, async (req, res) => {
  try {
    const requests = await JoinRequest.findAll({
      where: { userId: req.userId, status: "checked_in" },
    });

    const activityIds = requests.map((r) => r.activityId);
    const Activity = require("../models/Activity");
    const activities = await Activity.findAll({
      where: { id: activityIds },
    });

    res.json(activities);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;