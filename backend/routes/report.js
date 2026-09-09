const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Report = require("../models/Report");
const Activity = require("../models/Activity");
const User = require("../models/User");
const notificationService = require("../services/notificationService");
const sequelize = require("../database");
const { isActivityEnded } = require("../utils/activityTime");


router.post("/:activityId", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const { activityId } = req.params;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "กรุณาระบุเหตุผลในการรายงาน" });
    }

    let activity;
    let reporter;

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
        const error = new Error("กิจกรรมนี้ไม่สามารถรายงานได้");
        error.statusCode = 400;
        throw error;
      }

      if (isActivityEnded(activity)) {
        const error = new Error("กิจกรรมสิ้นสุดแล้ว ไม่สามารถรายงานได้");
        error.statusCode = 400;
        throw error;
      }

      if (activity.createdBy === req.userId) {
        const error = new Error("ไม่สามารถรายงานกิจกรรมของตัวเองได้");
        error.statusCode = 400;
        throw error;
      }

      const existing = await Report.findOne({
        where: { activityId, userId: req.userId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        const error = new Error("คุณรายงานกิจกรรมนี้ไปแล้ว");
        error.statusCode = 409;
        throw error;
      }

      await Report.create(
        { activityId, userId: req.userId, reason: String(reason).trim() },
        { transaction }
      );

      await activity.increment("reportCount", { by: 1, transaction });
      reporter = await User.findByPk(req.userId, { transaction });
    });

    try {
      const admins = await User.findAll({ where: { role: "admin" } });

      for (const admin of admins) {
        await notificationService.createNotification(
          admin.id,
          "report",
          activity.id,
          activity.activityName,
          req.userId,
          reporter?.username || ""
        );
      }
    } catch (notificationError) {
      console.error(
        "Create report notification error:",
        notificationError
      );
    }

    return res.status(201).json({ message: "รายงานสำเร็จ" });
  } catch (err) {
    console.error("REPORT ACTIVITY ERROR:", err);
    return res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "เกิดข้อผิดพลาด",
    });
  }
});

module.exports = router;