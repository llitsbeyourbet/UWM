const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Report = require("../models/Report");
const Activity = require("../models/Activity");
const User = require("../models/User");
const notificationService = require("../services/notificationService");


router.post("/:activityId", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const { activityId } = req.params;

    const existing = await Report.findOne({
      where: { activityId, userId: req.userId }
    });
    if (existing)
      return res.status(400).json({ message: "คุณรายงานกิจกรรมนี้ไปแล้ว" });

    await Report.create({ activityId, userId: req.userId, reason });
    await Activity.increment("reportCount", { where: { id: activityId } });

    // 👈 ดึงข้อมูลกิจกรรมและผู้รายงาน
    const activity = await Activity.findByPk(activityId);
    const reporter = await User.findByPk(req.userId);

    // 👈 ส่งแจ้งเตือนไปหา admin ทุกคน
    const admins = await User.findAll({ where: { role: "admin" } });
    for (const admin of admins) {
      await notificationService.createNotification(
        admin.id,
        "report",
        activity.id,
        activity.activityName,
        req.userId,
        reporter.username
      );
    }

    res.status(201).json({ message: "รายงานสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;