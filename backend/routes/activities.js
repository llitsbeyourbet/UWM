const express = require("express");
const router = express.Router();

const { auth } = require("../middleware/auth");
const { Op, fn, col, where } = require("sequelize");
const sequelize = require("../database");
const jwt = require("jsonwebtoken");

const {
  getActivityDateString,
  buildBangkokDateTime,
  isActivityEnded,
  isActivityOverlap,
} = require("../utils/activityTime");
const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const User = require("../models/User");
const ActivityReview = require("../models/ActivityReview");

const {
  getModerationMessage,
  buildModerationResponse,
} = require("../services/moderationService");

const {
  hybridAnalyzeFields,
} = require("../services/hybridModerationService");

// ตรวจว่ากิจกรรมถึงเวลาเริ่มแล้วหรือยัง
const isActivityStarted = (activity) => {
  if (!activity?.date || !activity?.time) return false;

  const startDateTime = buildBangkokDateTime(activity.date, activity.time);

  return !startDateTime || new Date() >= startDateTime;
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

    const todayDate = new Date(`${today}T00:00:00+07:00`);

    const yesterdayDate = new Date(
      todayDate.getTime() - 24 * 60 * 60 * 1000
    );

    const yesterday = yesterdayDate.toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    });

    const conditions = [
      { status: "active", },
      {
        [Op.or]: [
          where(fn("DATE", col("date")), {
            [Op.gt]: today,
          }),
          {
            [Op.and]: [
              where(fn("DATE", col("date")), today),
              { endsNextDay: true },
            ],
          },
          {
            [Op.and]: [
              where(fn("DATE", col("date")), today),
              { endsNextDay: false },
              {
                endTime: {
                  [Op.gt]: currentTime,
                },
              },
            ],
          },

          {
            [Op.and]: [
              where(fn("DATE", col("date")), yesterday),
              { endsNextDay: true },
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
        "endsNextDay",
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

// ดึงข้อมูลสรุปกิจกรรมทั้งหมดของผู้ใช้ปัจจุบัน
router.get("/summary/my", auth, async (req, res) => {
  try {
    const activities = await Activity.findAll({
      where: {
        createdBy: req.userId,
      },
      order: [["createdAt", "DESC"]],
    });

    if (activities.length === 0) {
      return res.json([]);
    }

    const activityIds = activities.map((activity) => activity.id);

    const [requests, reviews] = await Promise.all([
      JoinRequest.findAll({
        where: {
          activityId: {
            [Op.in]: activityIds,
          },
          status: {
            [Op.in]: ["approved", "checked_in"],
          },
        },
        attributes: ["activityId", "userId", "status"],
        raw: true,
      }),

      ActivityReview.findAll({
        where: {
          activityId: {
            [Op.in]: activityIds,
          },
        },
        attributes: ["activityId", "reviewerId", "rating"],
        raw: true,
      }),
    ]);

    const userIds = [
      ...new Set([
        ...requests.map((request) => request.userId),
        ...reviews.map((review) => review.reviewerId),
      ]),
    ];

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

    const existingUserIds = new Set(
      existingUsers.map((user) => Number(user.id))
    );

    const result = activities.map((activity) => {
      const activityRequests = requests.filter(
        (request) =>
          Number(request.activityId) === Number(activity.id) &&
          existingUserIds.has(Number(request.userId))
      );

      const activityReviews = reviews.filter(
        (review) =>
          Number(review.activityId) === Number(activity.id) &&
          existingUserIds.has(Number(review.reviewerId))
      );

      const checkedIn = activityRequests.filter(
        (request) => request.status === "checked_in"
      ).length;

      const totalJoined = activityRequests.length;

      const avgRating = activityReviews.length
        ? (
            activityReviews.reduce(
              (sum, review) => sum + Number(review.rating),
              0
            ) / activityReviews.length
          ).toFixed(1)
        : null;

      return {
        id: activity.id,
        activityName: activity.activityName,
        cover: activity.cover,
        date: activity.date,
        review: avgRating || "0.0",
        totalReview: activityReviews.length,
        checkedIn,
        totalJoin: totalJoined,
      };
    });

    return res.json(result);
  } catch (err) {
    console.error("GET ACTIVITY SUMMARY ERROR:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปกิจกรรม",
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
      endsNextDay,
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
    const activityDate = getActivityDateString(date);
    if (!activityDate) {
      return res.status(400).json({ message: "วันที่กิจกรรมไม่ถูกต้อง" });
    }

    const nowBangkok = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const todayBangkok = new Date(nowBangkok.getFullYear(), nowBangkok.getMonth(), nowBangkok.getDate());
    const maxActivityDate = new Date(todayBangkok);
    maxActivityDate.setMonth(maxActivityDate.getMonth() + 1);
    const selectedDate = new Date(`${activityDate}T00:00:00`);

    if (selectedDate < todayBangkok || selectedDate > maxActivityDate) {
      return res.status(400).json({ message: "วันที่จัดกิจกรรมต้องอยู่ภายใน 1 เดือนนับจากวันที่สร้างกิจกรรม" });
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
    if (!endsNextDay && endTime <= time) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม หรือเลือกว่าสิ้นสุดในวันถัดไป",
      });
    }
    if (endsNextDay && endTime === time) {
      return res.status(400).json({
        message: "ระยะเวลากิจกรรมต้องน้อยกว่า 24 ชั่วโมง",
      });
    }

    if (
      checkinStart &&
      checkinEnd &&
      !endsNextDay &&
      checkinEnd <= checkinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดเช็คอินต้องอยู่หลังเวลาเริ่มเช็คอิน",
      });
    }

    if (
      checkinStart &&
      checkinEnd &&
      endsNextDay &&
      checkinEnd === checkinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาเริ่มและสิ้นสุดการเช็คอินต้องไม่ตรงกัน",
      });
    }

    const moderation = await hybridAnalyzeFields({
      activityName,
      detail,
      location,
    });

    if (moderation.decision === "block") {
      return res.status(422).json({
        message: getModerationMessage(moderation),
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

          const targetDate = buildBangkokDateTime(activityDate, "00:00:00");

          const previousDate = new Date(
            targetDate.getTime() - 24 * 60 * 60 * 1000
          );

          const nextDate = new Date(
            targetDate.getTime() + 24 * 60 * 60 * 1000
          );

          const formatDate = (value) =>
            value.toLocaleDateString("en-CA", {
              timeZone: "Asia/Bangkok",
            });

          const existingActivities = await Activity.findAll({
            where: {
              createdBy: req.userId,
              status: "active",
              date: {
                [Op.between]: [
                  new Date(`${formatDate(previousDate)}T00:00:00.000Z`),
                  new Date(`${formatDate(nextDate)}T23:59:59.000Z`),
                ],
              },
            },
          });

          const newActivity = {
            date: activityDate,
            time,
            endTime,
            endsNextDay: Boolean(endsNextDay),
          };

          const overlappingActivity = existingActivities.find((act) =>
            isActivityOverlap(act, newActivity)
          );

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
      date: activityDate,
      time,
      endTime,
      endsNextDay: Boolean(endsNextDay),
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
    if (error.code === "AI_MODERATION_UNAVAILABLE") {
      return res.status(503).json({
        message: "ระบบตรวจสอบข้อความไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง",
      });
    }

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
      "endsNextDay",
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

    if (Object.prototype.hasOwnProperty.call(updates, "date")) {
      const activityDate = getActivityDateString(updates.date);
      if (!activityDate) {
        return res.status(400).json({ message: "วันที่กิจกรรมไม่ถูกต้อง" });
      }
      updates.date = activityDate;
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

    const nextEndsNextDay =
      updates.endsNextDay ?? activity.endsNextDay;

    if (
      nextTime &&
      nextEndTime &&
      !nextEndsNextDay &&
      nextEndTime <= nextTime
    ) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม หรือเลือกว่าสิ้นสุดในวันถัดไป",
      });
    }

    if (
      nextTime &&
      nextEndTime &&
      nextEndsNextDay &&
      nextEndTime === nextTime
    ) {
      return res.status(400).json({
        message:
          "ระยะเวลากิจกรรมต้องน้อยกว่า 24 ชั่วโมง",
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
      !nextEndsNextDay &&
      nextCheckinEnd <= nextCheckinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาสิ้นสุดเช็คอินต้องอยู่หลังเวลาเริ่มเช็คอิน",
      });
    }

    if (
      nextCheckinStart &&
      nextCheckinEnd &&
      nextEndsNextDay &&
      nextCheckinEnd === nextCheckinStart
    ) {
      return res.status(400).json({
        message:
          "เวลาเริ่มและสิ้นสุดการเช็คอินต้องไม่ตรงกัน",
      });
    }
    if (
      updates.activityName !== undefined ||
      updates.detail !== undefined ||
      updates.location !== undefined
    ) {
      const moderation = await hybridAnalyzeFields({
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

      if (moderation.decision === "block") {
        return res.status(422).json({
          message: getModerationMessage(moderation),
          ...buildModerationResponse(moderation),
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
          const targetDate = getActivityDateString(rawDate);

          const targetTime = updates.time ?? activity.time;
          const targetEndTime = updates.endTime ?? activity.endTime;
          const targetEndsNextDay =
            updates.endsNextDay ?? activity.endsNextDay;

          const baseDate = buildBangkokDateTime(targetDate, "00:00:00");

          const previousDate = new Date(
            baseDate.getTime() - 24 * 60 * 60 * 1000
          );

          const nextDate = new Date(
            baseDate.getTime() + 24 * 60 * 60 * 1000
          );

          const formatDate = (value) =>
            value.toLocaleDateString("en-CA", {
              timeZone: "Asia/Bangkok",
            });

          console.log(`[Conflict Check Edit] Checking conflicts for UserId: ${req.userId}, Date: ${targetDate}`);

          const existingActivities = await Activity.findAll({
            where: {
              createdBy: req.userId,
              status: "active",
              id: { [Op.ne]: activity.id },
              date: {
                [Op.between]: [
                  new Date(`${formatDate(previousDate)}T00:00:00.000Z`),
                  new Date(`${formatDate(nextDate)}T23:59:59.000Z`),
                ],
              },
            },
          });

          console.log(`[Conflict Check Edit] Found ${existingActivities.length} activities on this date`);

          const editedActivity = {
            date: targetDate,
            time: targetTime,
            endTime: targetEndTime,
            endsNextDay: Boolean(targetEndsNextDay),
          };

          const overlappingActivity = existingActivities.find((act) =>
            isActivityOverlap(act, editedActivity)
          );

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
    if (err.code === "AI_MODERATION_UNAVAILABLE") {
      return res.status(503).json({
        message: "ระบบตรวจสอบข้อความไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง",
      });
    }

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