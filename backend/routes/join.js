const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const sequelize = require("../database");
const { getActivityDateString, buildBangkokDateTime, isActivityEnded } = require("../utils/activityTime");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");
const JoinRequest = require("../models/JoinRequest");
const CheckIn = require("../models/Checkin");
const notificationService = require("../services/notificationService");


// ส่งคำขอเข้าร่วม
router.post("/:activityId", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    let activity;
    let user;
    let resultStatus;

    await sequelize.transaction(async (transaction) => {
      activity = await Activity.findByPk(activityId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!activity) {
        const error = new Error("ไม่พบกิจกรรม");
        error.statusCode = 404;
        throw error;
      }

      if (activity.status !== "active") {
        const error = new Error("กิจกรรมถูกระงับ ไม่สามารถเข้าร่วมได้");
        error.statusCode = 403;
        throw error;
      }

      if (isActivityEnded(activity)) {
        const error = new Error("กิจกรรมสิ้นสุดแล้ว ไม่สามารถเข้าร่วมได้");
        error.statusCode = 400;
        throw error;
      }

      if (activity.createdBy === req.userId) {
        const error = new Error("ไม่สามารถ join กิจกรรมของตัวเองได้");
        error.statusCode = 400;
        throw error;
      }

      const existing = await JoinRequest.findOne({
        where: { activityId, userId: req.userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existing && existing.status !== "cancelled") {
        const error = new Error("ส่งคำขอไปแล้ว");
        error.statusCode = 400;
        throw error;
      }

      if (activity.activityType === "public") {
        const joinedCount = await JoinRequest.count({
          where: {
            activityId,
            status: { [Op.in]: ["approved", "checked_in"] },
          },
          transaction,
        });

        if (joinedCount >= activity.participantCount) {
          const error = new Error("กิจกรรมเต็มแล้ว");
          error.statusCode = 400;
          throw error;
        }
      }

      user = await User.findByPk(req.userId, { transaction });
      if (!user) {
        const error = new Error("ไม่พบผู้ใช้");
        error.statusCode = 404;
        throw error;
      }

      resultStatus = activity.activityType === "public" ? "approved" : "pending";
      if (existing) {
        await existing.update({ status: resultStatus }, { transaction });
      } else {
        await JoinRequest.create(
          { activityId, userId: req.userId, status: resultStatus },
          { transaction }
        );
      }
    });

    await notificationService.createNotification(
      activity.createdBy,
      resultStatus === "approved" ? "member_joined" : "join_request",
      activity.id,
      activity.activityName,
      req.userId,
      user.username
    );

    if (resultStatus === "approved") {
      return res.status(201).json({ message: "เข้าร่วมกิจกรรมสำเร็จ", status: "approved" });
    }

    return res.status(201).json({
      message: "ส่งคำขอเข้าร่วมสำเร็จ รอการอนุมัติ",
      status: "pending",
    });
  } catch (err) {
    console.error("JOIN ACTIVITY ERROR:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "เกิดข้อผิดพลาด",
    });
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

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "สถานะคำขอไม่ถูกต้อง" });
    }

    let activity;
    let owner;
    let joinedUser;

    await sequelize.transaction(async (transaction) => {
      activity = await Activity.findByPk(activityId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!activity) {
        const error = new Error("ไม่พบกิจกรรม");
        error.statusCode = 404;
        throw error;
      }

      if (activity.createdBy !== req.userId) {
        const error = new Error("ไม่มีสิทธิ์อนุมัติกิจกรรมนี้");
        error.statusCode = 403;
        throw error;
      }

      if (activity.status !== "active") {
        const error = new Error("กิจกรรมถูกระงับ ไม่สามารถจัดการคำขอเข้าร่วมได้");
        error.statusCode = 403;
        throw error;
      }

      if (isActivityEnded(activity)) {
        const error = new Error("กิจกรรมนี้สิ้นสุดแล้ว");
        error.statusCode = 400;
        throw error;
      }

      const joinRequest = await JoinRequest.findOne({
        where: { activityId, userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!joinRequest) {
        const error = new Error("ไม่พบคำขอ");
        error.statusCode = 404;
        throw error;
      }

      if (joinRequest.status !== "pending") {
        const error = new Error("คำขอนี้ถูกจัดการแล้ว");
        error.statusCode = 409;
        throw error;
      }

      if (status === "approved") {
        const joinedCount = await JoinRequest.count({
          where: {
            activityId,
            status: { [Op.in]: ["approved", "checked_in"] },
          },
          transaction,
        });

        if (joinedCount >= activity.participantCount) {
          const error = new Error("กิจกรรมเต็มแล้ว ไม่สามารถอนุมัติเพิ่มได้");
          error.statusCode = 400;
          throw error;
        }
      }

      await joinRequest.update({ status }, { transaction });

      await Notification.destroy({
        where: {
          activityId,
          fromUserId: userId,
          toUserId: req.userId,
          type: "join_request",
        },
        transaction,
      });

      owner = await User.findByPk(req.userId, { transaction });
      joinedUser = await User.findByPk(userId, { transaction });
    });

    if (status === "approved") {
      await notificationService.createNotification(
        userId,
        "join_confirmed",
        activity.id,
        activity.activityName,
        req.userId,
        owner?.username || ""
      );

      await notificationService.createNotification(
        req.userId,
        "member_joined",
        activity.id,
        activity.activityName,
        userId,
        joinedUser?.username || ""
      );
    } else {
      await notificationService.createNotification(
        userId,
        "join_rejected",
        activity.id,
        activity.activityName,
        req.userId,
        owner?.username || ""
      );
    }

    return res.json({ message: status === "approved" ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ" });
  } catch (err) {
    console.error("RESPOND JOIN ERROR:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "เกิดข้อผิดพลาด",
    });
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

// ดึงรายชื่อคนที่ขอเข้าร่วม (เฉพาะเจ้าของกิจกรรม)
router.get("/:activityId/requests", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ดูคำขอเข้าร่วมกิจกรรมนี้" });
    }

    const requests = await JoinRequest.findAll({
      where: { activityId: req.params.activityId, status: "pending" },
    });
    return res.json(requests);
  } catch (err) {
    console.error("GET JOIN REQUESTS ERROR:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// 👈 ดึงจำนวนคนที่เข้าร่วม
router.get("/:activityId/count", async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    const statusFilter = ["approved", "checked_in"];

    const requests = await JoinRequest.findAll({
      where: {
        activityId: req.params.activityId,
        status: statusFilter,
      },
      attributes: ["userId"]
    });

    const userIds = requests.map(r => r.userId);
    const existingUsers = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id"],
      raw: true
    });

    res.json({ count: existingUsers.length });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// Check-in ด้วย QR Code
router.post("/:activityId/checkin", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { qrToken } = req.body;

    if (!qrToken) {
      return res.status(400).json({ message: "ไม่พบ QR Token" });
    }

    try {
      const payload = jwt.verify(qrToken, process.env.JWT_SECRET);
      if (Number(payload.activityId) !== Number(activityId)) {
        return res.status(400).json({ message: "QR ไม่ถูกต้อง" });
      }
    } catch (err) {
      return res.status(400).json({ message: "QR ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    let activity;
    let user;

    await sequelize.transaction(async (transaction) => {
      activity = await Activity.findByPk(activityId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!activity) {
        const error = new Error("ไม่พบกิจกรรม");
        error.statusCode = 404;
        throw error;
      }

      if (activity.status !== "active") {
        const error = new Error("กิจกรรมถูกระงับ ไม่สามารถเช็คอินได้");
        error.statusCode = 403;
        throw error;
      }

      if (isActivityEnded(activity)) {
        const error = new Error("กิจกรรมสิ้นสุดแล้ว ไม่สามารถเช็คอินได้");
        error.statusCode = 400;
        throw error;
      }

      const joinRequest = await JoinRequest.findOne({
        where: { activityId, userId: req.userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!joinRequest) {
        const error = new Error("ไม่พบคำขอเข้าร่วม");
        error.statusCode = 404;
        throw error;
      }

      if (joinRequest.status === "checked_in") {
        const error = new Error("คุณได้เช็คอินกิจกรรมนี้เรียบร้อยแล้ว ไม่สามารถเช็คอินซ้ำได้อีก");
        error.statusCode = 409;
        error.responseStatus = "checked_in";
        throw error;
      }

      if (joinRequest.status !== "approved") {
        const error = new Error("ยังไม่ได้รับการอนุมัติ");
        error.statusCode = 400;
        throw error;
      }

      const now = new Date();
      const activityDateStr = getActivityDateString(activity.date);
      if (!activityDateStr) {
        const error = new Error("วันที่กิจกรรมไม่ถูกต้อง");
        error.statusCode = 500;
        throw error;
      }

      const activityDateStart = new Date(`${activityDateStr}T00:00:00+07:00`);
      const activityDateEnd = new Date(`${activityDateStr}T23:59:59.999+07:00`);
      if (now < activityDateStart || now > activityDateEnd) {
        const error = new Error("ไม่อยู่ในวันที่สามารถเช็คอินได้");
        error.statusCode = 400;
        throw error;
      }

      if (activity.checkinStart) {
        const startDateTime = buildBangkokDateTime(activity.date, activity.checkinStart);
        if (!startDateTime || now < startDateTime) {
          const error = new Error(`ยังไม่ถึงเวลาเช็คอิน (เริ่ม ${String(activity.checkinStart).slice(0, 5)})`);
          error.statusCode = 400;
          throw error;
        }
      }

      if (activity.checkinEnd) {
        const endDateTime = buildBangkokDateTime(activity.date, activity.checkinEnd);
        if (!endDateTime || now > endDateTime) {
          const error = new Error(`หมดเขตเช็คอินแล้ว (ปิด ${String(activity.checkinEnd).slice(0, 5)})`);
          error.statusCode = 400;
          throw error;
        }
      }

      await joinRequest.update({ status: "checked_in" }, { transaction });
      await CheckIn.create(
        { activityId, userId: req.userId, checkedAt: now },
        { transaction }
      );

      user = await User.findByPk(req.userId, { transaction });
    });

    await notificationService.createNotification(
      activity.createdBy,
      "checkin",
      activity.id,
      activity.activityName,
      req.userId,
      user?.username || ""
    );

    await notificationService.createNotification(
      req.userId,
      "review_request",
      activity.id,
      activity.activityName,
      activity.createdBy,
      ""
    );

    return res.json({ message: "ยืนยันการเข้าร่วมสำเร็จ", status: "checked_in" });
  } catch (err) {
    console.error("CHECKIN ERROR:", err);
    const body = { message: err.statusCode ? err.message : "เกิดข้อผิดพลาด" };
    if (err.responseStatus) body.status = err.responseStatus;
    return res.status(err.statusCode || 500).json(body);
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

// ประวัติการเช็คอินล่าสุดของผู้ใช้
router.get("/checkin-history", auth, async (req, res) => {
  try {

    const checkins = await CheckIn.findAll({
      where: {
        userId: req.userId,
      },
      order: [
        ["checkedAt", "DESC"],
      ],
      limit: 10,
      raw: true,
    });

    if (checkins.length === 0) {
      return res.json([]);
    }

    const activityIds = [
      ...new Set(
        checkins.map((item) => item.activityId)
      ),
    ];

    const activities = await Activity.findAll({
      where: {
        id: {
          [Op.in]: activityIds,
        },
      },
      raw: true,
    });

    const activityMap = {};

    activities.forEach((activity) => {
      activityMap[activity.id] = activity;
    });

    const result = checkins
      .map((checkin) => {

        const activity =
          activityMap[checkin.activityId];

        if (!activity) {
          return null;
        }

        return {
          id: checkin.id,

          activityId:
            checkin.activityId,

          activityName:
            activity.activityName,

          cover:
            activity.cover || null,

          date:
            activity.date,

          time:
            activity.time,

          endTime:
            activity.endTime,

          location:
            activity.location,

          checkedAt:
            checkin.checkedAt,
        };
      })
      .filter(Boolean);

    return res.json(result);

  } catch (err) {

    console.log(
      "checkin history error:",
      err
    );

    return res.status(500).json({
      message:
        "ไม่สามารถโหลดประวัติการเช็คอินได้",
    });
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