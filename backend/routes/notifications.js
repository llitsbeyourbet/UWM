const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { emitCountUpdate } = require("../services/notificationService");


// ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.count({
      where: { toUserId: req.userId, isRead: false },
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// อ่านแจ้งเตือนทั้งหมด
router.put("/read-all", auth, async (req, res) => {
  try {
    await Notification.update({ isRead: true }, { where: { toUserId: req.userId } });
    emitCountUpdate(req.userId);
    res.json({ message: "ทำเครื่องหมายว่าอ่านแล้วทั้งหมด" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ลบการแจ้งเตือนทั้งหมดของผู้ใช้
router.delete("/delete-all", auth, async (req, res) => {
  try {
    await Notification.destroy({
      where: {
        toUserId: req.userId,
      },
    });

    emitCountUpdate(req.userId);

    res.json({
      message: "ลบการแจ้งเตือนทั้งหมดสำเร็จ",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});

// ลบการแจ้งเตือนรายการเดียว
router.delete("/:id", auth, async (req, res) => {
  try {
    const deleted = await Notification.destroy({
      where: {
        id: req.params.id,
        toUserId: req.userId,
      },
    });

    if (!deleted) {
      return res.status(404).json({
        message: "ไม่พบการแจ้งเตือน",
      });
    }

    emitCountUpdate(req.userId);

    res.json({
      message: "ลบการแจ้งเตือนสำเร็จ",
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// ดึงการแจ้งเตือนของ user
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { toUserId: req.userId },
      order: [["createdAt", "DESC"]],
    });

    const result = await Promise.all(
      notifications.map(async (notification) => {
        const n = notification.toJSON();

        let fromUser = null;

        if (n.fromUserId) {
          fromUser = await User.findByPk(n.fromUserId, {
            attributes: ["id", "username", "name", "profileImage"],
          });
        }

        return {
          ...n,
          fromUser: fromUser
            ? {
                id: fromUser.id,
                username: fromUser.username,
                name: fromUser.name,
                profileImage: fromUser.profileImage,
              }
            : null,
        };
      })
    );

    res.json(result);
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

    const notif = await Notification.findOne({
      where: { id: req.params.id, toUserId: req.userId },
    });
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
    const [updated] = await Notification.update(
      { isRead: true },
      { where: { id: req.params.id, toUserId: req.userId } }
    );

    if (!updated) {
      return res.status(404).json({ message: "ไม่พบการแจ้งเตือน" });
    }

    emitCountUpdate(req.userId);
    res.json({ message: "อ่านแล้ว" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;