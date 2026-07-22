const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
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

    const joinedCount = await JoinRequest.count({
      where: {
        activityId: activity.id,
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
    });

    console.log(`Activity ${activity.id} joinedCount: ${joinedCount}`);

    res.json({
      ...activity.toJSON(),
      joinedCount,
    });
  } catch (err) {
    console.log("Error fetching activity detail:", err);
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

    const endDateTime = new Date(
      `${activity.date}T${activity.endTime || activity.time}`
    );

    if (new Date() >= endDateTime) {
      return res.status(400).json({
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถแก้ไขได้",
      });
    }

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

    const endDateTime = new Date(
      `${activity.date}T${activity.endTime || activity.time}`
    );

    if (new Date() >= endDateTime) {
      return res.status(400).json({
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถลบได้",
      });
    }

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

    const endDateTime = new Date(
      `${activity.date}T${activity.endTime || activity.time}+07:00`
    );

    if (new Date() >= endDateTime) {
      return res.status(400).json({
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถสร้าง QR Code ได้",
      });
    }

    const qrToken = jwt.sign(
      {
        activityId: activity.id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15s",
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

// ดึงข้อมูลสรุปผู้เข้าร่วม (แยกกลุ่มเช็คอินและยังไม่เช็คอิน)
router.get("/:id/summary-participants", async (req, res) => {
  try {
    const { id } = req.params;
    const JoinRequest = require("../models/JoinRequest");
    const User = require("../models/User");

    const requests = await JoinRequest.findAll({
      where: {
        activityId: id,
        status: { [require("sequelize").Op.in]: ["approved", "checked_in"] },
      },
    });

    const userIds = requests.map((r) => r.userId);
    const users = await User.findAll({
      where: { id: { [require("sequelize").Op.in]: userIds } },
      attributes: ["id", "name", "username", "profileImage"],
    });

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u });

    const checkedIn = [];
    const approved = [];

    requests.forEach(r => {
      const user = userMap[r.userId];
      if (user) {
        if (r.status === "checked_in") {
          checkedIn.push(user);
        } else if (r.status === "approved") {
          approved.push(user);
        }
      }
    });

    res.json({
      checkedIn,
      approved,
      totalJoined: requests.length
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรายชื่อผู้ที่เช็คอินแล้ว
router.get("/:id/participants/checked-in", async (req, res) => {
  try {
    const { id } = req.params;
    const JoinRequest = require("../models/JoinRequest");
    const User = require("../models/User");

    const requests = await JoinRequest.findAll({
      where: { activityId: id, status: "checked_in" },
    });

    const userIds = requests.map((r) => r.userId);
    const participants = await User.findAll({
      where: {
        id: {
          [require("sequelize").Op.in]: userIds,
        },
      },
      attributes: ["id", "name", "username", "profileImage"],
    });

    res.json(participants);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรายชื่อผู้เข้าร่วม
router.get("/:id/participants", async (req, res) => {
  try {
    const { id } = req.params;
    const JoinRequest = require("../models/JoinRequest");
    const User = require("../models/User");

    const requests = await JoinRequest.findAll({
      where: {
        activityId: id,
        status: {
          [require("sequelize").Op.in]: ["approved", "checked_in"],
        },
      },
    });

    const userIds = requests.map((r) => r.userId);
    const participants = await User.findAll({
      where: {
        id: {
          [require("sequelize").Op.in]: userIds,
        },
      },
      attributes: ["id", "name", "username", "profileImage"],
    });

    res.json(participants);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;
