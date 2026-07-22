const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");
const JoinRequest = require("../models/JoinRequest");
const CheckIn = require("../models/Checkin");
const notificationService = require("../services/notificationService");

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

    const endDateTime = new Date(
      `${activity.date}T${activity.endTime || activity.time}+07:00`
    );

    if (new Date() >= endDateTime) {
      return res.status(400).json({
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถเข้าร่วมได้",
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถเช็คอินได้",
      });
    }

    if (activity.createdBy === req.userId)
      return res.status(400).json({ message: "ไม่สามารถ join กิจกรรมของตัวเองได้" });

    const existing = await JoinRequest.findOne({
      where: { activityId, userId: req.userId }
    });

    if (existing && existing.status !== "cancelled")
      return res.status(400).json({ message: "ส่งคำขอไปแล้ว" });

    const joinedCount = await JoinRequest.count({
      where: {
        activityId,
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
    });

    if (
      activity.activityType === "public" &&
      joinedCount >= activity.participantCount
    ) {
      return res.status(400).json({
        message: "กิจกรรมเต็มแล้ว",
      });
    }

    const user = await User.findByPk(req.userId);

    if (activity.activityType === "public") {
      if (existing) {
        await existing.update({ status: "approved" });
      } else {
        await JoinRequest.create({ activityId, userId: req.userId, status: "approved" });
      }

      await notificationService.createNotification(
        activity.createdBy,
        "member_joined",
        activity.id,
        activity.activityName,
        req.userId,
        user.username
      );

      return res.status(201).json({ message: "เข้าร่วมกิจกรรมสำเร็จ", status: "approved" });
    }

    if (existing) {
      await existing.update({ status: "pending" });
    } else {
      await JoinRequest.create({ activityId, userId: req.userId, status: "pending" });
    }

    await notificationService.createNotification(
      activity.createdBy,
      "join_request",
      activity.id,
      activity.activityName,
      req.userId,
      user.username
    );

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
    const { status } = req.body;

    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    const now = new Date();

    const activityEnd = new Date(activity.date);

    if (activity.endTime) {
      const [hour, minute] = activity.endTime.slice(0, 5).split(":");

      activityEnd.setHours(Number(hour));
      activityEnd.setMinutes(Number(minute));
      activityEnd.setSeconds(0);
      activityEnd.setMilliseconds(0);
    } else {
      activityEnd.setHours(23, 59, 59, 999);
    }

    if (now > activityEnd) {
      return res.status(400).json({
        message: "กิจกรรมนี้สิ้นสุดแล้ว",
      });
    }

    if (activity.createdBy !== req.userId)
      return res.status(403).json({ message: "ไม่มีสิทธิ์อนุมัติกิจกรรมนี้" });

    const joinRequest = await JoinRequest.findOne({ where: { activityId, userId } });
    if (!joinRequest) return res.status(404).json({ message: "ไม่พบคำขอ" });

    if (status === "approved") {
      const joinedCount = await JoinRequest.count({
        where: {
          activityId,
          status: {
            [Op.in]: ["approved", "checked_in"],
          },
        },
      });

      if (joinedCount >= activity.participantCount) {
        return res.status(400).json({
          message: "กิจกรรมเต็มแล้ว ไม่สามารถอนุมัติเพิ่มได้",
        });
      }
    }
    await joinRequest.update({ status });

    // ลบ Notification คำขอเดิมของเจ้าของ
    await Notification.destroy({
      where: {
        activityId,
        fromUserId: userId,
        toUserId: req.userId,
        type: "join_request",
      },
    });

    const owner = await User.findByPk(req.userId);

    if (status === "approved") {

      // ดึงข้อมูลคนที่เข้าร่วม
      const joinedUser = await User.findByPk(userId);

      // แจ้งผู้เข้าร่วมว่าเจ้าของอนุมัติแล้ว
      await notificationService.createNotification(
        userId,
        "join_confirmed",
        activity.id,
        activity.activityName,
        req.userId,
        owner.username
      );

      // เปลี่ยน Notification เดิมของเจ้าของ
      await notificationService.createNotification(
        req.userId,
        "member_joined",
        activity.id,
        activity.activityName,
        userId,
        joinedUser.username
      );


    } else {

      await notificationService.createNotification(
        userId,
        "join_rejected",
        activity.id,
        activity.activityName,
        req.userId,
        owner.username
      );

    }

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

// ดึงรายชื่อคนที่ขอเข้าร่วม
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

// 👈 ดึงจำนวนคนที่เข้าร่วม
router.get("/:activityId/count", async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    let statusFilter;
    if (activity.activityType === "public") {
      // สาธารณะ — นับคนที่กดเข้าร่วมแล้ว
      statusFilter = ["approved", "checked_in"];
    } else {
      // ส่วนตัว — นับแค่คนที่เจ้าของอนุมัติแล้ว
      statusFilter = ["approved", "checked_in"];
    }

    const count = await JoinRequest.count({
      where: {
        activityId: req.params.activityId,
        status: statusFilter,
      }
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// Check-in ด้วย QR Code
// Check-in ด้วย QR Code
router.post("/:activityId/checkin", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { qrToken } = req.body;


    // ตรวจสอบ QR Token
    try {

      const payload = jwt.verify(
        qrToken,
        process.env.JWT_SECRET
      );


      if (Number(payload.activityId) !== Number(activityId)) {
        return res.status(400).json({
          message: "QR ไม่ถูกต้อง"
        });
      }


    } catch (err) {

      return res.status(400).json({
        message: "QR หมดอายุแล้ว"
      });

    }



    // ตรวจสอบว่ามีสิทธิ์เข้าร่วมไหม
    const joinRequest = await JoinRequest.findOne({
      where: {
        activityId,
        userId: req.userId
      }
    });


    if (!joinRequest) {

      return res.status(404).json({
        message: "ไม่พบคำขอเข้าร่วม"
      });

    }

    if (joinRequest.status === "checked_in") {

      return res.status(409).json({
        message: "คุณได้เช็คอินกิจกรรมนี้เรียบร้อยแล้ว ไม่สามารถเช็คอินซ้ำได้อีก",
        status: "checked_in"
      });

    }

    if (joinRequest.status !== "approved") {

      return res.status(400).json({
        message: "ยังไม่ได้รับการอนุมัติ"
      });

    }

    const activity = await Activity.findByPk(activityId);

    if (!activity) {

      return res.status(404).json({
        message: "ไม่พบกิจกรรม"
      });

    }

    // ตรวจสอบเวลา Check-in
    if (activity.checkinStart && activity.checkinEnd) {
      const currentTime =
        new Date().toLocaleTimeString(
          "en-GB",
          {
            timeZone: "Asia/Bangkok",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }
        );

      const start =
        activity.checkinStart.slice(0, 5);

      const end =
        activity.checkinEnd.slice(0, 5);

      if (currentTime < start) {

        return res.status(400).json({
          message: `ยังไม่ถึงเวลาเช็คอิน (เริ่ม ${start})`
        });

      }

      if (currentTime > end) {

        return res.status(400).json({
          message: `หมดเขตเช็คอินแล้ว (ปิด ${end})`
        });

      }

    }

    // เปลี่ยนสถานะเป็น checked_in
    const [updated] = await JoinRequest.update(
      {
        status: "checked_in"
      },
      {
        where: {
          activityId,
          userId: req.userId,
          status: "approved"
        }
      }
    );

    if (updated === 0) {

      return res.status(409).json({
        message: "เช็คอินแล้ว"
      });

    }

    // บันทึก CheckIn
    await CheckIn.create({

      activityId,

      userId: req.userId,

      checkedAt: new Date()

    });

    const user = await User.findByPk(req.userId);

    // แจ้งเจ้าของกิจกรรม
    await notificationService.createNotification(
      activity.createdBy,
      "checkin",
      activity.id,
      activity.activityName,
      req.userId,
      user ? user.username : ""
    );

    // แจ้งเตือนให้รีวิว
    await notificationService.createNotification(
      req.userId,
      "review_request",
      activity.id,
      activity.activityName,
      activity.createdBy,
      ""
    );

    return res.json({

      message: "ยืนยันการเข้าร่วมสำเร็จ",

      status: "checked_in"

    });

  } catch (err) {

    console.log(err);
    return res.status(500).json({
      message: "เกิดข้อผิดพลาด"
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
    const activities = await Activity.findAll({
      where: { id: activityIds },
    });

    res.json(activities);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงกิจกรรมที่ user เข้าร่วม
router.get("/user/:id", async (req, res) => {
  try {
    const requests = await JoinRequest.findAll({
      where: {
        userId: req.params.id,
        status: { [Op.in]: ["approved", "checked_in"] },
      },
    });

    const activityIds = requests.map((r) => r.activityId);
    if (activityIds.length === 0) return res.json([]);

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