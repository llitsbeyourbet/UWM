const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const { Op, fn, col, where } = require("sequelize");
const sequelize = require("../database");
const jwt = require("jsonwebtoken");

const { isActivityEnded } = require("../utils/activityTime");
const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const User = require("../models/User");

const {
  analyzeFields,
  getModerationMessage,
  buildModerationResponse,
} = require("../services/moderationService");

// Helper to ensure time is in HH:mm:ss format for reliable comparison
const normalizeTime = (t) => {
  if (!t) return "";

  const value = String(t);
  const parts = value.split(":");

  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
  }

  return value;
};

// ตรวจว่ากิจกรรมถึงเวลาเริ่มแล้วหรือยัง
const isActivityStarted = (activity) => {
  if (!activity?.date || !activity?.time) return false;

  const startDateTime = new Date(
    `${activity.date}T${activity.time}+07:00`
  );

  return new Date() >= startDateTime;
};


// ดึงกิจกรรมทั้งหมด
// ส่ง joinedCount มาพร้อมกัน เพื่อลด N+1 requests จากหน้า Search
router.get("/", async (req, res) => {
  try {
    const activities = await Activity.findAll();

    if (activities.length === 0) {
      return res.json([]);
    }

    const activityIds = activities.map((activity) => activity.id);

    const requests = await JoinRequest.findAll({
      where: {
        activityId: { [Op.in]: activityIds },
        status: { [Op.in]: ["approved", "checked_in"] },
      },
      attributes: ["activityId", "userId"],
      raw: true,
    });

    const userIds = [
      ...new Set(requests.map((request) => request.userId)),
    ];

    const existingUsers = userIds.length
      ? await User.findAll({
        where: {
          id: { [Op.in]: userIds },
        },
        attributes: ["id"],
        raw: true,
      })
      : [];

    const existingUserIds = new Set(
      existingUsers.map((user) => Number(user.id))
    );

    const joinedCountMap = new Map();
    const countedPairs = new Set();

    requests.forEach((request) => {
      const activityId = Number(request.activityId);
      const userId = Number(request.userId);
      const pairKey = `${activityId}:${userId}`;

      if (
        !existingUserIds.has(userId) ||
        countedPairs.has(pairKey)
      ) {
        return;
      }

      countedPairs.add(pairKey);

      joinedCountMap.set(
        activityId,
        (joinedCountMap.get(activityId) || 0) + 1
      );
    });

    return res.json(
      activities.map((activity) => ({
        ...activity.toJSON(),
        joinedCount:
          joinedCountMap.get(Number(activity.id)) || 0,
      }))
    );
  } catch (err) {
    console.error("ACTIVITIES LIST ERROR:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// ดึงกิจกรรมสำหรับหน้า Home
router.get("/home", async (req, res) => {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      30
    );

    const offset = (page - 1) * limit;

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    // เวลาปัจจุบันประเทศไทย
    const bangkokParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .reduce((acc, part) => {
        if (part.type !== "literal") {
          acc[part.type] = part.value;
        }

        return acc;
      }, {});

    const today =
      `${bangkokParts.year}-${bangkokParts.month}-${bangkokParts.day}`;

    const currentTime =
      `${bangkokParts.hour}:${bangkokParts.minute}:${bangkokParts.second}`;

    const conditions = [
      {
        status: "active",
      },
      {
        [Op.or]: [
          // กิจกรรมหลังจากวันนี้
          where(fn("DATE", col("date")), {
            [Op.gt]: today,
          }),

          // กิจกรรมวันนี้ แต่ยังไม่หมดเวลา
          {
            [Op.and]: [
              where(fn("DATE", col("date")), today),
              {
                endTime: {
                  [Op.gt]: currentTime,
                },
              },
            ],
          },
        ],
      },
    ];

    if (category && category !== "ทั้งหมด") {
      conditions.push(
        where(
          fn(
            "JSON_CONTAINS",
            col("category"),
            JSON.stringify(category)
          ),
          1
        )
      );
    }

    // ดึงเกินมา 1 รายการเพื่อเช็ก hasMore
    const rows = await Activity.findAll({
      where: {
        [Op.and]: conditions,
      },
      attributes: [
        "id",
        "activityName",
        "date",
        "time",
        "endTime",
        "location",
        "participantCount",
        "activityType",
        "cover",
        "category",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: limit + 1,
      offset,
    });

    const hasMore = rows.length > limit;

    const pageActivities = hasMore
      ? rows.slice(0, limit)
      : rows;

    if (pageActivities.length === 0) {
      return res.json({
        activities: [],
        page,
        hasMore: false,
      });
    }

    const activityIds = pageActivities.map(
      (activity) => activity.id
    );

    const requests = await JoinRequest.findAll({
      where: {
        activityId: {
          [Op.in]: activityIds,
        },
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
      attributes: ["activityId", "userId"],
      raw: true,
    });

    const userIds = [
      ...new Set(
        requests.map((request) => request.userId)
      ),
    ];

    let existingUserIds = new Set();

    if (userIds.length > 0) {
      const existingUsers = await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
        attributes: ["id"],
        raw: true,
      });

      existingUserIds = new Set(
        existingUsers.map((user) => Number(user.id))
      );
    }

    const joinedCountMap = {};
    const countedPairs = new Set();

    for (const request of requests) {
      const activityId = Number(request.activityId);
      const userId = Number(request.userId);
      const pairKey = `${activityId}:${userId}`;

      if (
        !existingUserIds.has(userId) ||
        countedPairs.has(pairKey)
      ) {
        continue;
      }

      countedPairs.add(pairKey);

      joinedCountMap[activityId] =
        (joinedCountMap[activityId] || 0) + 1;
    }

    const result = pageActivities.map((activity) => ({
      ...activity.toJSON(),
      joinedCount:
        joinedCountMap[activity.id] || 0,
    }));

    return res.json({
      activities: result,
      page,
      hasMore,
    });
  } catch (err) {
    console.error("HOME ACTIVITIES ERROR:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการโหลดกิจกรรม",
    });
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

    return res.json(activities);
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// ดึงกิจกรรมตาม id
router.get("/:id", async (req, res) => {
  try {
    const activity = await Activity.findByPk(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    // นับผู้เข้าร่วมที่ยังมีตัวตนอยู่ในระบบ
    const requests = await JoinRequest.findAll({
      where: {
        activityId: activity.id,
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
      attributes: ["userId"],
      raw: true,
    });

    const userIds = requests.map(
      (request) => request.userId
    );

    const existingUsers = userIds.length
      ? await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
        attributes: ["id"],
        raw: true,
      })
      : [];

    const joinedCount = existingUsers.length;

    const creator = await User.findByPk(
      activity.createdBy,
      {
        attributes: [
          "id",
          "name",
          "username",
          "profileImage",
        ],
      }
    );

    console.log(
      `Activity ${activity.id} joinedCount: ${joinedCount}`
    );

    return res.json({
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

      creatorName:
        creator?.name || null,

      creatorUsername:
        creator?.username || null,
    });
  } catch (err) {
    console.log(
      "Error fetching activity detail:",
      err
    );

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
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
      checkinStart,
      checkinEnd,
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
        message:
          "กรุณากรอกข้อมูลให้ครบทุกช่องและอัปโหลดรูปกิจกรรม",
      });
    }

    const participantCount =
      Number(req.body.participantCount);

    if (
      !Number.isInteger(participantCount) ||
      participantCount < 1
    ) {
      return res.status(400).json({
        message:
          "จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มอย่างน้อย 1 คน",
      });
    }

    if (
      !["public", "private"].includes(activityType)
    ) {
      return res.status(400).json({
        message: "ประเภทกิจกรรมไม่ถูกต้อง",
      });
    }

    if (endTime <= time) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มกิจกรรม",
      });
    }

    if (
      checkinStart &&
      checkinEnd &&
      checkinEnd <= checkinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาปิดเช็คอินต้องอยู่หลังเวลาเปิดเช็คอิน",
      });
    }

    const moderation = analyzeFields({
      activityName,
      detail,
      location,
    });

    if (moderation.status !== "safe") {
      return res.status(422).json({
        message:
          getModerationMessage(moderation),
        ...buildModerationResponse(moderation),
      });
    }

    // ตรวจสอบเวลาคาบเกี่ยว (Conflict Check)
    if (!req.body.confirmConflict) {
      try {
        if (!req.userId) {
          console.error("[Conflict Check] Missing req.userId");
        } else {
          console.log(`[Conflict Check] Checking conflicts for UserId: ${req.userId}, Date: ${date}`);

          const existingActivities = await Activity.findAll({
            where: {
              createdBy: req.userId,
              status: "active",
              date: {
                [Op.between]: [`${date} 00:00:00`, `${date} 23:59:59`],
              },
            },
          });

          console.log(`[Conflict Check] Found ${existingActivities.length} activities on this date`);

          const overlappingActivity = existingActivities.find((act) => {
            const start = normalizeTime(act.time);
            const end = normalizeTime(act.endTime);
            const newStart = normalizeTime(time);
            const newEnd = normalizeTime(endTime);
            const isOverlap = start < newEnd && end > newStart;
            console.log(`[Overlap Logic] Existing: ${start}-${end}, New: ${newStart}-${newEnd}, Overlap: ${isOverlap}`);
            return isOverlap;
          });

          if (overlappingActivity) {
            console.log(`[Conflict Check] Conflict detected with activity ID: ${overlappingActivity.id}`);
            return res.status(409).json({
              message: "ช่วงเวลาของกิจกรรมนี้ทับซ้อนกับกิจกรรมที่คุณสร้างไว้แล้ว",
              conflictActivity: {
                activityName: overlappingActivity.activityName,
                time: String(overlappingActivity.time).slice(0, 5),
                endTime: String(overlappingActivity.endTime).slice(0, 5),
              },
            });
          }
        }
      } catch (conflictErr) {
        console.error("Conflict Check Error:", conflictErr);
      }
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

    return res
      .status(201)
      .json(activity);
  } catch (error) {
    console.error(
      "CREATE ACTIVITY ERROR:",
      error
    );

    console.error(
      "CREATE ACTIVITY BODY:",
      req.body
    );

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
      error: error.message,
    });
  }
});


// แก้ไขกิจกรรม
router.put("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({
        message: "ไม่มีสิทธิ์แก้ไขกิจกรรมนี้",
      });
    }

    if (activity.status !== "active") {
      return res.status(403).json({
        message:
          "กิจกรรมถูกระงับ ไม่สามารถแก้ไขได้",
      });
    }

    // ถึงเวลาเริ่มแล้ว ห้ามแก้ไขกิจกรรม
    if (isActivityStarted(activity)) {
      return res.status(400).json({
        message:
          "กิจกรรมเริ่มแล้ว ไม่สามารถแก้ไขข้อมูลกิจกรรมได้",
      });
    }

    const allowedFields = [
      "activityName",
      "detail",
      "activityType",
      "category",
      "date",
      "time",
      "endTime",
      "location",
      "cover",
      "participantCount",
      "checkinStart",
      "checkinEnd",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        updates[field] = req.body[field];
      }
    }

    if (updates.activityName !== undefined) {
      updates.activityName =
        String(updates.activityName).trim();
    }

    if (updates.detail !== undefined) {
      updates.detail =
        String(updates.detail).trim();
    }

    if (updates.location !== undefined) {
      updates.location =
        String(updates.location).trim();
    }

    if (
      updates.activityType !== undefined &&
      !["public", "private"].includes(
        updates.activityType
      )
    ) {
      return res.status(400).json({
        message: "ประเภทกิจกรรมไม่ถูกต้อง",
      });
    }

    if (
      updates.category !== undefined &&
      (
        !Array.isArray(updates.category) ||
        updates.category.filter(Boolean).length === 0
      )
    ) {
      return res.status(400).json({
        message:
          "กรุณาเลือกหมวดหมู่กิจกรรม",
      });
    }

    if (Array.isArray(updates.category)) {
      updates.category =
        updates.category.filter(Boolean);
    }

    if (
      updates.participantCount !== undefined
    ) {
      const participantCount =
        Number(updates.participantCount);

      if (
        !Number.isInteger(participantCount) ||
        participantCount < 1
      ) {
        return res.status(400).json({
          message:
            "จำนวนผู้เข้าร่วมต้องเป็นจำนวนเต็มอย่างน้อย 1 คน",
        });
      }

      const joinedCount =
        await JoinRequest.count({
          where: {
            activityId: activity.id,
            status: {
              [Op.in]: [
                "approved",
                "checked_in",
              ],
            },
          },
        });

      if (participantCount < joinedCount) {
        return res.status(400).json({
          message:
            "จำนวนผู้เข้าร่วมสูงสุดห้ามน้อยกว่าจำนวนสมาชิกที่เข้าร่วมแล้ว",
        });
      }

      updates.participantCount =
        participantCount;
    }

    const nextTime =
      updates.time ?? activity.time;

    const nextEndTime =
      updates.endTime ?? activity.endTime;

    if (
      nextTime &&
      nextEndTime &&
      nextEndTime <= nextTime
    ) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มกิจกรรม",
      });
    }

    const nextCheckinStart =
      updates.checkinStart ??
      activity.checkinStart;

    const nextCheckinEnd =
      updates.checkinEnd ??
      activity.checkinEnd;

    if (
      nextCheckinStart &&
      nextCheckinEnd &&
      nextCheckinEnd <= nextCheckinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาปิดเช็คอินต้องอยู่หลังเวลาเปิดเช็คอิน",
      });
    }

    if (
      updates.activityName !== undefined ||
      updates.detail !== undefined ||
      updates.location !== undefined
    ) {
      const moderation = analyzeFields({
        activityName:
          updates.activityName !== undefined
            ? updates.activityName
            : activity.activityName,

        detail:
          updates.detail !== undefined
            ? updates.detail
            : activity.detail,

        location:
          updates.location !== undefined
            ? updates.location
            : activity.location,
      });
      if (moderation.status === "danger") {
        return res.status(422).json({
          message:
            getModerationMessage(moderation),

          requiresConfirmation: false,

          ...buildModerationResponse(
            moderation
          ),
        });
      }

      if (
        moderation.status === "warning" &&
        req.body.moderationConfirmed !== true
      ) {
        return res.status(422).json({
          message:
            getModerationMessage(moderation),

          requiresConfirmation: true,

          ...buildModerationResponse(
            moderation
          ),
        });
      }
    }

    // ตรวจสอบเวลาคาบเกี่ยว (Conflict Check)
    if (!req.body.confirmConflict) {
      try {
        if (!req.userId) {
          console.error("[Conflict Check Edit] Missing req.userId");
        } else {
          const rawDate = updates.date ?? activity.date;
          const targetDate = rawDate instanceof Date
            ? rawDate.toISOString().split('T')[0]
            : (typeof rawDate === 'string' ? rawDate.split('T')[0] : rawDate);

          const targetTime = updates.time ?? activity.time;
          const targetEndTime = updates.endTime ?? activity.endTime;

          console.log(`[Conflict Check Edit] Checking conflicts for UserId: ${req.userId}, Date: ${targetDate}`);

          const existingActivities = await Activity.findAll({
            where: {
              createdBy: req.userId,
              status: "active",
              id: { [Op.ne]: activity.id },
              date: {
                [Op.between]: [`${targetDate} 00:00:00`, `${targetDate} 23:59:59`],
              },
            },
          });

          console.log(`[Conflict Check Edit] Found ${existingActivities.length} activities on this date`);

          const overlappingActivity = existingActivities.find((act) => {
            const start = normalizeTime(act.time);
            const end = normalizeTime(act.endTime);
            const newStart = normalizeTime(targetTime);
            const newEnd = normalizeTime(targetEndTime);
            const isOverlap = start < newEnd && end > newStart;
            console.log(`[Overlap Logic Edit] Existing: ${start}-${end}, New: ${newStart}-${newEnd}, Overlap: ${isOverlap}`);
            return isOverlap;
          });

          if (overlappingActivity) {
            console.log(`[Conflict Check Edit] Conflict detected with activity ID: ${overlappingActivity.id}`);
            return res.status(409).json({
              message: "กิจกรรมนี้มีช่วงเวลาซ้อน\nกับกิจกรรมที่คุณสร้างไว้แล้ว",
              conflictActivity: {
                activityName: overlappingActivity.activityName,
                time: String(overlappingActivity.time).slice(0, 5),
                endTime: String(overlappingActivity.endTime).slice(0, 5),
              },
            });
          }
        }
      } catch (conflictErr) {
        console.error("Conflict Check Error (Edit):", conflictErr);
      }
    }

    await activity.update(updates);

    return res.json(activity);
  } catch (err) {
    console.error(
      "UPDATE ACTIVITY ERROR:",
      err
    );

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// ลบกิจกรรม
router.delete("/:id", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({
        message: "ไม่มีสิทธิ์ลบกิจกรรมนี้",
      });
    }

    if (activity.status === "suspended") {
      return res.status(403).json({
        message:
          "กิจกรรมถูกระงับโดยแอดมิน ไม่สามารถลบได้",
      });
    }

    if (isActivityEnded(activity)) {
      return res.status(400).json({
        message:
          "กิจกรรมสิ้นสุดแล้ว ไม่สามารถลบได้",
      });
    }

    const joinedCount =
      await JoinRequest.count({
        where: {
          activityId: activity.id,
          status: {
            [Op.in]: [
              "approved",
              "checked_in",
            ],
          },
        },
      });

    if (joinedCount > 0) {
      return res.status(400).json({
        message:
          "ไม่สามารถลบกิจกรรมที่มีผู้เข้าร่วมแล้วได้",
      });
    }

    await activity.destroy();

    return res.json({
      message: "ลบกิจกรรมสำเร็จ",
    });
  } catch (err) {
    console.error(
      "DELETE ACTIVITY ERROR:",
      err
    );

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// สร้าง QR Token
router.get("/:id/qr", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(
      req.params.id
    );

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    if (activity.createdBy !== req.userId) {
      return res.status(403).json({
        message: "ไม่มีสิทธิ์",
      });
    }

    if (activity.status !== "active") {
      return res.status(403).json({
        message:
          "กิจกรรมถูกระงับ ไม่สามารถสร้าง QR Code ได้",
      });
    }

    if (isActivityEnded(activity)) {
      return res.status(400).json({
        message:
          "กิจกรรมสิ้นสุดแล้ว ไม่สามารถสร้าง QR Code ได้",
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

    return res.json({
      qrToken,
    });
  } catch (err) {
    console.log(err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});


// ดึงข้อมูลสรุปผู้เข้าร่วม
router.get("/:id/summary-participants",
  auth,
  async (req, res) => {
    try {
      const { id } = req.params;

      const activity =
        await Activity.findByPk(id);

      if (!activity) {
        return res.status(404).json({
          message: "ไม่พบกิจกรรม",
        });
      }

      if (activity.createdBy !== req.userId) {
        return res.status(403).json({
          message:
            "ไม่มีสิทธิ์ดูข้อมูลสรุปกิจกรรมนี้",
        });
      }

      const requests =
        await JoinRequest.findAll({
          where: {
            activityId: id,
            status: {
              [Op.in]: [
                "approved",
                "checked_in",
              ],
            },
          },
        });

      const userIds = requests.map(
        (request) => request.userId
      );

      const users = userIds.length
        ? await User.findAll({
          where: {
            id: {
              [Op.in]: userIds,
            },
          },
          attributes: [
            "id",
            "name",
            "username",
            "profileImage",
          ],
        })
        : [];

      const userMap = {};

      users.forEach((user) => {
        userMap[user.id] = user;
      });

      const checkedIn = [];
      const approved = [];

      requests.forEach((request) => {
        const user =
          userMap[request.userId];

        if (!user) return;

        if (request.status === "checked_in") {
          checkedIn.push(user);
        } else {
          approved.push(user);
        }
      });

      return res.json({
        checkedIn,
        approved,
        totalJoined:
          checkedIn.length +
          approved.length,
      });
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        message: "เกิดข้อผิดพลาด",
      });
    }
  }
);


// ดึงรายชื่อผู้ที่เช็คอินแล้ว
router.get("/:id/participants/checked-in",
  async (req, res) => {
    try {
      const { id } = req.params;

      const requests =
        await JoinRequest.findAll({
          where: {
            activityId: id,
            status: "checked_in",
          },
        });

      const userIds = requests.map(
        (request) => request.userId
      );

      const participants = userIds.length
        ? await User.findAll({
          where: {
            id: {
              [Op.in]: userIds,
            },
          },
          attributes: [
            "id",
            "name",
            "username",
            "profileImage",
          ],
        })
        : [];

      return res.json(participants);
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        message: "เกิดข้อผิดพลาด",
      });
    }
  }
);


// ดึงรายชื่อผู้เข้าร่วม
router.get(
  "/:id/participants",
  async (req, res) => {
    try {
      const { id } = req.params;

      const requests =
        await JoinRequest.findAll({
          where: {
            activityId: id,
            status: {
              [Op.in]: [
                "approved",
                "checked_in",
              ],
            },
          },
        });

      const userIds = requests.map(
        (request) => request.userId
      );

      const participants = userIds.length
        ? await User.findAll({
          where: {
            id: {
              [Op.in]: userIds,
            },
          },
          attributes: [
            "id",
            "name",
            "username",
            "profileImage",
          ],
        })
        : [];

      return res.json(participants);
    } catch (err) {
      console.log(err);

      return res.status(500).json({
        message: "เกิดข้อผิดพลาด",
      });
    }
  }
);


module.exports = router;
