const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const { isActivityEnded } = require("../utils/activityTime");
const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const User = require("../models/User")


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

    // นับจำนวนผู้เข้าร่วมที่มีตัวตนอยู่ในระบบเท่านั้น
    const requests = await JoinRequest.findAll({
      where: {
        activityId: activity.id,
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
      attributes: ["userId"],
      raw: true
    });

    const userIds = requests.map(r => r.userId);
    const existingUsers = await require("../models/User").findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id"],
      raw: true
    });

    const joinedCount = existingUsers.length;

    // ดึงข้อมูลผู้สร้างกิจกรรม
    const User = require("../models/User");

    const creator = await User.findByPk(activity.createdBy, {
      attributes: ["id", "name", "username", "profileImage"],
    });

    console.log(`Activity ${activity.id} joinedCount: ${joinedCount}`);

    res.json({
      ...activity.toJSON(),
      joinedCount,

      creator: creator
        ? {
          id: creator.id,
          name: creator.name,
          username: creator.username,
          profileImage: creator.profileImage,
        }
        : null,

      // เผื่อหน้าอื่นในระบบใช้อยู่
      creatorName: creator?.name || null,
      creatorUsername: creator?.username || null,
    });
  } catch (err) {
    console.log("Error fetching activity detail:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// สร้างกิจกรรม
router.post("/", auth, async (req, res) => {
  try {
    const {
      activityName,
      detail,
      activityType,
      category,
      date,
      time,
      endTime,
      location,
      cover,
    } = req.body;

    const categories = Array.isArray(category)
      ? category.filter(Boolean)
      : [category].filter(Boolean);

    if (
      !activityName?.trim() ||
      !detail?.trim() ||
      !activityType ||
      categories.length === 0 ||
      !date ||
      !time ||
      !endTime ||
      !location?.trim() ||
      !cover
    ) {
      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบทุกช่องและอัปโหลดรูปกิจกรรม",
      });
    }

    const participantCount = Number(req.body.participantCount);
    if (!Number.isInteger(participantCount) || participantCount < 1) {
      return res.status(400).json({ message: "จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มอย่างน้อย 1 คน" });
    }

    if (!["public", "private"].includes(activityType)) {
      return res.status(400).json({ message: "ประเภทกิจกรรมไม่ถูกต้อง" });
    }

    if (endTime <= time) {
      return res.status(400).json({ message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มกิจกรรม" });
    }

    const { checkinStart, checkinEnd } = req.body;
    if (checkinStart && checkinEnd && checkinEnd <= checkinStart) {
      return res.status(400).json({ message: "เวลาปิดเช็คอินต้องอยู่หลังเวลาเปิดเช็คอิน" });
    }

    const activity = await Activity.create({
      activityName: activityName.trim(),
      detail: detail.trim(),
      activityType,
      category: categories,
      date,
      time,
      endTime,
      location: location.trim(),
      cover,
      participantCount,
      checkinStart: checkinStart || null,
      checkinEnd: checkinEnd || null,
      createdBy: req.userId,
    });

    return res.status(201).json(activity);
  } catch (error) {
    console.error("CREATE ACTIVITY ERROR:", error);
    console.error("CREATE ACTIVITY BODY:", req.body);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
      error: error.message,
    });
  }
});

// แก้ไขกิจกรรม
router.put("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์แก้ไขกิจกรรมนี้" });
    }

    if (activity.status !== "active") {
      return res.status(403).json({ message: "กิจกรรมถูกระงับ ไม่สามารถแก้ไขได้" });
    }

    if (isActivityEnded(activity)) {
      return res.status(400).json({ message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถแก้ไขได้" });
    }

    const allowedFields = [
      "activityName", "detail", "activityType", "category", "date", "time",
      "endTime", "location", "cover", "participantCount", "checkinStart", "checkinEnd",
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
    }

    if (updates.activityName !== undefined) updates.activityName = String(updates.activityName).trim();
    if (updates.detail !== undefined) updates.detail = String(updates.detail).trim();
    if (updates.location !== undefined) updates.location = String(updates.location).trim();

    if (updates.activityType !== undefined && !["public", "private"].includes(updates.activityType)) {
      return res.status(400).json({ message: "ประเภทกิจกรรมไม่ถูกต้อง" });
    }

    if (updates.category !== undefined && (!Array.isArray(updates.category) || updates.category.filter(Boolean).length === 0)) {
      return res.status(400).json({ message: "กรุณาเลือกหมวดหมู่กิจกรรม" });
    }
    if (Array.isArray(updates.category)) updates.category = updates.category.filter(Boolean);

    if (updates.participantCount !== undefined) {
      const participantCount = Number(updates.participantCount);
      if (!Number.isInteger(participantCount) || participantCount < 1) {
        return res.status(400).json({ message: "จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มอย่างน้อย 1 คน" });
      }
      const joinedCount = await JoinRequest.count({
        where: { activityId: activity.id, status: { [Op.in]: ["approved", "checked_in"] } },
      });
      if (participantCount < joinedCount) {
        return res.status(400).json({ message: "จำนวนผู้เข้าร่วมสูงสุดห้ามน้อยกว่าจำนวนสมาชิกที่เข้าร่วมแล้ว" });
      }
      updates.participantCount = participantCount;
    }

    const nextTime = updates.time ?? activity.time;
    const nextEndTime = updates.endTime ?? activity.endTime;
    if (nextTime && nextEndTime && nextEndTime <= nextTime) {
      return res.status(400).json({ message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มกิจกรรม" });
    }

    const nextCheckinStart = updates.checkinStart ?? activity.checkinStart;
    const nextCheckinEnd = updates.checkinEnd ?? activity.checkinEnd;
    if (nextCheckinStart && nextCheckinEnd && nextCheckinEnd <= nextCheckinStart) {
      return res.status(400).json({ message: "เวลาปิดเช็คอินต้องอยู่หลังเวลาเปิดเช็คอิน" });
    }

    await activity.update(updates);
    return res.json(activity);
  } catch (err) {
    console.error("UPDATE ACTIVITY ERROR:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ลบกิจกรรม 👈 แก้ให้เช็คเจ้าของด้วย
router.delete("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.id);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    if (isActivityEnded(activity)) {
      return res.status(400).json({
        message: "กิจกรรมสิ้นสุดแล้ว ไม่สามารถลบได้",
      });
    }

    if (activity.createdBy !== req.userId)
      return res.status(403).json({ message: "ไม่มีสิทธิ์ลบกิจกรรมนี้" });

    const joinedCount = await JoinRequest.count({
      where: {
        activityId: activity.id,
        status: { [Op.in]: ["approved", "checked_in"] },
      },
    });

    if (joinedCount > 0) {
      return res.status(400).json({
        message: "ไม่สามารถลบกิจกรรมที่มีผู้เข้าร่วมแล้วได้",
      });
    }

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

    if (activity.status !== "active") {
      return res.status(403).json({ message: "กิจกรรมถูกระงับ ไม่สามารถสร้าง QR Code ได้" });
    }

    if (isActivityEnded(activity)) {
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
router.get("/:id/summary-participants", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findByPk(id);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ดูข้อมูลสรุปกิจกรรมนี้" });
    }

    const requests = await JoinRequest.findAll({
      where: {
        activityId: id,
        status: { [Op.in]: ["approved", "checked_in"] },
      },
    });

    const userIds = requests.map((r) => r.userId);

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "name", "username", "profileImage"],
    });

    const userMap = {};
    users.forEach((u) => { userMap[u.id] = u; });

    const checkedIn = [];
    const approved = [];

    requests.forEach((r) => {
      const user = userMap[r.userId];

      if (user) {
        if (r.status === "checked_in") {
          checkedIn.push(user);
        } else {
          approved.push(user);
        }
      }
    });

    return res.json({
      checkedIn,
      approved,
      totalJoined: checkedIn.length + approved.length,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
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
