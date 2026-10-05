const express = require("express");
const router = express.Router();
const { auth, isAdmin } = require("../middleware/auth");
const { Op, fn, col } = require("sequelize");

const Activity = require("../models/Activity");
const User = require("../models/User");
const Report = require("../models/Report");
const JoinRequest = require("../models/JoinRequest");
const ActivityReview = require("../models/ActivityReview");
const HostReview = require("../models/HostReview");
const Comment = require("../models/Comment");
const ModerationFlag = require("../models/ModerationFlag");
const notificationService = require("../services/notificationService");
const InappropriateWord = require("../models/InappropriateWord");
const { setCustomWords } = require("../services/moderationService");
const { getActivityStartDateTime, getActivityEndDateTime } = require("../utils/activityTime");

const validDays = (value) => {
  const days = Number(value || 7);
  return [7, 30, 90, 365].includes(days) ? days : 7;
};

const dateKey = (value) => new Date(value).toISOString().split("T")[0];

const refreshModerationWords = async () => {
  const words = await InappropriateWord.findAll({
    raw: true,
  });

  setCustomWords(words);
};
/* ========================= DASHBOARD ========================= */

router.get("/dashboard", auth, isAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalActivities,
      totalReports,
      pendingReports,
      publishedActivities,
      suspendedActivities,
      totalCheckins,
      totalParticipants,
      totalReviews,
      pendingActivityModerations,
      pendingReviewModerations,
    ] = await Promise.all([
      User.count(),
      Activity.count(),
      Report.count(),
      Report.count({ where: { status: "pending" } }),
      Activity.count({ where: { status: "active" } }),
      Activity.count({ where: { status: "suspended" } }),
      JoinRequest.count({ where: { status: "checked_in" } }),
      JoinRequest.count({
        where: {
          status: {
            [Op.in]: ["approved", "checked_in"],
          },
        },
      }),
      Promise.all([
        ActivityReview.count(),
        HostReview.count(),
      ]).then(([activityReviews, hostReviews]) => {
        return activityReviews + hostReviews;
      }),

      // จำนวน "กิจกรรม" ที่ AI ตรวจพบและยังรอตรวจสอบ
      // 1 กิจกรรมอาจมีหลาย flag แต่ให้นับเป็น 1 รายการ
      ModerationFlag.findAll({
        where: {
          contentType: "activity",
          status: "pending",
        },
        attributes: ["activityId"],
        raw: true,
      }).then((rows) => {
        return new Set(
          rows.map((row) => Number(row.activityId))
        ).size;
      }),

      // จำนวน "รีวิว" ที่ AI ตรวจพบและยังรอตรวจสอบ
      // รีวิวเดียวอาจมีหลาย flag แต่ให้นับเป็น 1 รายการ
      ModerationFlag.findAll({
        where: {
          contentType: "review",
          status: "pending",
        },
        attributes: ["activityId", "userId"],
        raw: true,
      }).then((rows) => {
        return new Set(
          rows.map(
            (row) =>
              `${Number(row.activityId)}:${Number(row.userId)}`
          )
        ).size;
      }),
    ]);

    return res.json({
      totalUsers,
      totalActivities,
      publishedActivities,
      totalReports,
      pendingReports,
      suspendedActivities,
      totalCheckins,
      totalParticipants,
      totalReviews,
      pendingActivityModerations,
      pendingReviewModerations,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลด Dashboard ได้",
    });
  }
});

/* ========================= USERS ========================= */

router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (!users.length) {
      return res.json([]);
    }

    const userIds = users.map((user) => Number(user.id));

    const createdActivities = await Activity.findAll({
      where: {
        createdBy: {
          [Op.in]: userIds,
        },
      },
      attributes: ["id", "createdBy"],
      raw: true,
    });

    const joinedRequests = await JoinRequest.findAll({
      where: {
        userId: {
          [Op.in]: userIds,
        },
        status: {
          [Op.in]: ["approved", "checked_in"],
        },
      },
      attributes: ["id", "userId", "activityId"],
      raw: true,
    });

    const activityCountMap = new Map();
    const joinedCountMap = new Map();

    createdActivities.forEach((activity) => {
      const userId = Number(activity.createdBy);

      activityCountMap.set(
        userId,
        (activityCountMap.get(userId) || 0) + 1
      );
    });

    joinedRequests.forEach((request) => {
      const userId = Number(request.userId);

      joinedCountMap.set(
        userId,
        (joinedCountMap.get(userId) || 0) + 1
      );
    });

    const result = users.map((user) => {
      const userId = Number(user.id);

      return {
        ...user,
        activityCount: activityCountMap.get(userId) || 0,
        joinedActivityCount: joinedCountMap.get(userId) || 0,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Admin users error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดผู้ใช้งานได้",
      error: error.message,
    });
  }
});

/* ========================= REPORTS ========================= */

const enrichReports = async (reports) => {
  if (!reports.length) return [];

  const activityIds = [...new Set(reports.map((r) => r.activityId).filter(Boolean))];
  const userIds = [...new Set(reports.map((r) => r.userId).filter(Boolean))];

  const [activities, users] = await Promise.all([
    Activity.findAll({
      where: { id: { [Op.in]: activityIds } },
      attributes: ["id", "activityName", "cover", "location", "date", "status"],
    }),
    User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "username", "name", "profileImage"],
    }),
  ]);

  const activityMap = new Map(
    activities.map((a) => [Number(a.id), a.toJSON()])
  );
  const userMap = new Map(users.map((u) => [Number(u.id), u.toJSON()]));

  return reports.map((report) => {
    const activity = activityMap.get(Number(report.activityId));
    const reporter = userMap.get(Number(report.userId));

    return {
      ...report.toJSON(),
      activityName: activity?.activityName || "ไม่ระบุชื่อกิจกรรม",
      activityCover: activity?.cover || null,
      activityLocation: activity?.location || null,
      activityDate: activity?.date || null,
      activityStatus: activity?.status || null,
      reporterName: reporter?.name || reporter?.username || "ผู้ใช้",
      reporterUsername: reporter?.username || reporter?.name || "ผู้ใช้",
      reporterProfileImage: reporter?.profileImage || null,
    };
  });
};

router.get("/reports", auth, isAdmin, async (req, res) => {
  try {
    const reports = await Report.findAll({
      order: [["createdAt", "DESC"]],
    });

    const enrichedReports = await enrichReports(reports);

    const groupedReports = Object.values(
      enrichedReports.reduce((groups, report) => {
        const activityId = Number(report.activityId);

        if (!groups[activityId]) {
          groups[activityId] = {
            ...report,

            // เก็บ id ของรายงานล่าสุดไว้เปิดหน้า detail
            id: report.id,

            reportCount: 0,
            reporters: [],
          };
        }

        groups[activityId].reportCount += 1;

        groups[activityId].reporters.push({
          id: report.id,
          userId: report.userId,
          reporterName: report.reporterName,
          reporterUsername: report.reporterUsername,
          reporterProfileImage: report.reporterProfileImage,
          reason: report.reason,
          detail: report.detail || null,
          status: report.status,
          decision: report.decision,
          adminNote: report.adminNote,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        });

        return groups;
      }, {})
    ).map((group) => {
      const statuses = group.reporters.map(
        (reporter) => reporter.status
      );

      let groupedStatus = "pending";

      if (statuses.includes("reviewing")) {
        groupedStatus = "reviewing";
      } else if (statuses.includes("pending")) {
        groupedStatus = "pending";
      } else if (statuses.includes("resolved")) {
        groupedStatus = "resolved";
      } else if (statuses.includes("rejected")) {
        groupedStatus = "rejected";
      }

      return {
        ...group,
        status: groupedStatus,
      };
    });

    return res.json(groupedReports);
  } catch (error) {
    console.error("Admin reports error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดรายงานได้",
      error: error.message,
    });
  }
});

router.get("/latest-reports", auth, isAdmin, async (req, res) => {
  try {
    const reports = await Report.findAll({
      order: [["createdAt", "DESC"]],
    });

    const enrichedReports = await enrichReports(reports);

    const groupedReports = Object.values(
      enrichedReports.reduce((groups, report) => {
        const activityId = Number(report.activityId);

        if (!groups[activityId]) {
          groups[activityId] = {
            ...report,
            id: report.id,
            reportCount: 0,
            reporters: [],
          };
        }

        groups[activityId].reportCount += 1;

        groups[activityId].reporters.push({
          id: report.id,
          userId: report.userId,
          reporterName: report.reporterName,
          reporterUsername: report.reporterUsername,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
        });

        return groups;
      }, {})
    )
      .map((group) => {
        const statuses = group.reporters.map((item) =>
          String(item.status || "pending").toLowerCase()
        );

        let groupedStatus = "pending";

        if (statuses.includes("reviewing")) {
          groupedStatus = "reviewing";
        } else if (statuses.includes("pending")) {
          groupedStatus = "pending";
        } else if (statuses.includes("resolved")) {
          groupedStatus = "resolved";
        } else if (statuses.includes("rejected")) {
          groupedStatus = "rejected";
        }

        return {
          ...group,
          status: groupedStatus,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, 5);

    return res.json(groupedReports);
  } catch (error) {
    console.error("Latest reports error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดรายงานล่าสุดได้",
    });
  }
});

router.put("/suspend/:activityId", auth, isAdmin, async (req, res) => {
  try {
    const activity = await Activity.findByPk(
      req.params.activityId
    );

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    const reviewedAt = new Date();

    await Promise.all([
      activity.update({
        status: "suspended",
      }),

      Report.update(
        {
          status: "resolved",
          decision: "suspend_activity",
          adminNote: "กิจกรรมนี้ถูกระงับโดยผู้ดูแลระบบ",
          reviewedBy: req.userId,
          reviewedAt,
        },
        {
          where: {
            activityId: activity.id,
          },
        }
      ),
    ]);

    /*
      แจ้งเตือนผิดพลาดต้องไม่ทำให้ API
      ตอบว่าระงับกิจกรรมไม่สำเร็จ
    */
    try {
      await notificationService.createNotification(
        activity.createdBy,
        "activity_suspended",
        activity.id,
        activity.activityName,
        req.userId,
        "ผู้ดูแลระบบ",
        {
          deduplicate: true,
        }
      );

      await Promise.resolve(
        notificationService.emitCountUpdate(
          activity.createdBy
        )
      );
    } catch (notificationError) {
      console.error(
        "Create suspension notification error:",
        notificationError
      );
    }

    return res.status(200).json({
      message: "ระงับกิจกรรมสำเร็จ",
    });
  } catch (error) {
    console.error("Suspend activity error:", error);

    return res.status(500).json({
      message: "ไม่สามารถระงับกิจกรรมได้",
      error: error.message,
    });
  }
});

router.put("/unsuspend/:activityId", auth, isAdmin, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    await activity.update({ status: "active" });
    return res.json({ message: "ยกเลิกการระงับสำเร็จ" });
  } catch (error) {
    console.error("Unsuspend activity error:", error);
    return res.status(500).json({ message: "ไม่สามารถยกเลิกการระงับได้" });
  }
});
router.get("/activities", auth, isAdmin, async (req, res) => {
  try {
    const activities = await Activity.findAll({
      paranoid: false,
      order: [["createdAt", "DESC"]],
    });

    if (!activities.length) {
      return res.json([]);
    }

    const creatorIds = [
      ...new Set(
        activities
          .map((activity) => Number(activity.createdBy))
          .filter(Boolean)
      ),
    ];

    const creators = creatorIds.length
      ? await User.findAll({
        where: {
          id: {
            [Op.in]: creatorIds,
          },
        },
        attributes: [
          "id",
          "username",
          "name",
          "profileImage",
        ],
      })
      : [];

    const creatorMap = new Map(
      creators.map((user) => [
        Number(user.id),
        user.toJSON(),
      ])
    );

    const result = activities.map((activity) => {
      const creator = creatorMap.get(
        Number(activity.createdBy)
      );

      return {
        ...activity.toJSON(),

        creator:
          creator?.username ||
          creator?.name ||
          "ไม่ทราบผู้สร้าง",

        creatorUsername:
          creator?.username || null,

        creatorName:
          creator?.name ||
          creator?.username ||
          "ไม่ทราบผู้สร้าง",

        creatorProfileImage:
          creator?.profileImage || null,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Admin activities error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดกิจกรรมทั้งหมดได้",
      error: error.message,
    });
  }
});

/* ========================= LATEST ACTIVITIES ========================= */

router.get("/latest-activities", auth, isAdmin, async (req, res) => {
  try {
    const activities = await Activity.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    if (!activities.length) return res.json([]);

    const creatorIds = [
      ...new Set(activities.map((a) => a.createdBy).filter(Boolean)),
    ];

    const creators = await User.findAll({
      where: { id: { [Op.in]: creatorIds } },
      attributes: ["id", "username", "name", "profileImage"],
    });

    const creatorMap = new Map(
      creators.map((u) => [Number(u.id), u.toJSON()])
    );

    return res.json(
      activities.map((activity) => {
        const creator = creatorMap.get(Number(activity.createdBy));

        return {
          ...activity.toJSON(),
          creator: creator?.username || creator?.name || "ไม่ทราบผู้สร้าง",
          creatorName: creator?.name || creator?.username || "ไม่ทราบผู้สร้าง",
          creatorUsername:
            creator?.username || creator?.name || "ไม่ทราบผู้สร้าง",
          creatorProfileImage: creator?.profileImage || null,
        };
      })
    );
  } catch (error) {
    console.error("Latest activities error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดกิจกรรมล่าสุดได้" });
  }
});

/* ========================= LATEST REVIEWS ========================= */

router.get("/latest-reviews", auth, isAdmin, async (req, res) => {
  try {
    const reviews = await ActivityReview.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    if (!reviews.length) return res.json([]);

    const activityIds = [
      ...new Set(reviews.map((r) => r.activityId).filter(Boolean)),
    ];
    const reviewerIds = [
      ...new Set(reviews.map((r) => r.reviewerId).filter(Boolean)),
    ];

    const [activities, reviewers, comments] = await Promise.all([
      Activity.findAll({
        where: { id: { [Op.in]: activityIds } },
        attributes: ["id", "activityName", "cover"],
      }),
      User.findAll({
        where: { id: { [Op.in]: reviewerIds } },
        attributes: ["id", "username", "name", "profileImage"],
      }),
      Comment.findAll({
        where: {
          activityId: { [Op.in]: activityIds },
          userId: { [Op.in]: reviewerIds },
        },
        order: [["createdAt", "DESC"]],
      }),
    ]);

    const activityMap = new Map(
      activities.map((a) => [Number(a.id), a.toJSON()])
    );
    const reviewerMap = new Map(
      reviewers.map((u) => [Number(u.id), u.toJSON()])
    );
    const commentMap = new Map();

    comments.forEach((comment) => {
      const key = `${Number(comment.activityId)}:${Number(comment.userId)}`;
      if (!commentMap.has(key)) commentMap.set(key, comment.toJSON());
    });

    return res.json(
      reviews.map((review) => {
        const activity = activityMap.get(Number(review.activityId));
        const reviewer = reviewerMap.get(Number(review.reviewerId));
        const comment = commentMap.get(
          `${Number(review.activityId)}:${Number(review.reviewerId)}`
        );

        return {
          ...review.toJSON(),
          rating: Number(review.rating || 0),
          activityName: activity?.activityName || "ไม่ระบุชื่อกิจกรรม",
          activityCover: activity?.cover || null,
          reviewerName: reviewer?.name || reviewer?.username || "ผู้ใช้",
          reviewerUsername:
            reviewer?.username || reviewer?.name || "ผู้ใช้",
          reviewerProfileImage: reviewer?.profileImage || null,
          comment: comment?.comment || "",
          isPublic: comment?.isPublic ?? false,
        };
      })
    );
  } catch (error) {
    console.error("Latest reviews error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดรีวิวล่าสุดได้" });
  }
});

/* ========================= CHART ========================= */

router.get("/chart", auth, isAdmin, async (req, res) => {
  try {
    const days = validDays(req.query.days);
    const startDate = new Date();

    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [activityRows, participantRows] = await Promise.all([
      Activity.findAll({
        attributes: [
          [fn("DATE", col("createdAt")), "day"],
          [fn("COUNT", col("id")), "activities"],
        ],
        where: { createdAt: { [Op.gte]: startDate } },
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
      }),
      JoinRequest.findAll({
        attributes: [
          [fn("DATE", col("createdAt")), "day"],
          [fn("COUNT", col("id")), "participants"],
        ],
        where: {
          createdAt: { [Op.gte]: startDate },
          status: { [Op.in]: ["approved", "checked_in"] },
        },
        group: [fn("DATE", col("createdAt"))],
        order: [[fn("DATE", col("createdAt")), "ASC"]],
        raw: true,
      }),
    ]);

    const activityMap = new Map(
      activityRows.map((row) => [dateKey(row.day), Number(row.activities || 0)])
    );
    const participantMap = new Map(
      participantRows.map((row) => [
        dateKey(row.day),
        Number(row.participants || 0),
      ])
    );

    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = dateKey(date);

      result.push({
        day: key,
        activities: activityMap.get(key) || 0,
        participants: participantMap.get(key) || 0,
      });
    }

    return res.json(result);
  } catch (error) {
    console.error("Admin chart error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดข้อมูลกราฟได้" });
  }
});

/* ========================= CATEGORY CHART ========================= */

router.get("/chart-categories", auth, isAdmin, async (req, res) => {
  try {
    const days = validDays(req.query.days);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const categories = [
      "กีฬา",
      "เกม",
      "ดนตรี",
      "ภาพยนตร์",
      "อาหาร",
      "คาเฟ่",
      "ศิลปะ",
      "ท่องเที่ยว",
      "เรียน",
      "สุขภาพ",
      "จิตอาสา",
    ];

    const activities = await Activity.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate,
        },
      },
      attributes: ["category"],
      raw: true,
    });

    const categoryCount = Object.fromEntries(
      categories.map((category) => [category, 0])
    );

    activities.forEach((activity) => {
      let activityCategories = activity.category;

      if (!activityCategories) return;

      // รองรับกรณี category เป็น JSON string
      if (typeof activityCategories === "string") {
        try {
          const parsed = JSON.parse(activityCategories);

          activityCategories = Array.isArray(parsed)
            ? parsed
            : [activityCategories];
        } catch {
          activityCategories = activityCategories
            .split(",")
            .map((item) => item.trim());
        }
      }

      if (!Array.isArray(activityCategories)) {
        activityCategories = [activityCategories];
      }

      activityCategories.forEach((category) => {
        if (categoryCount[category] !== undefined) {
          categoryCount[category] += 1;
        }
      });
    });

    const result = categories.map((category) => ({
      category,
      count: categoryCount[category],
    }));

    return res.json(result);
  } catch (error) {
    console.error("Admin category chart error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดข้อมูลหมวดหมู่กิจกรรมได้",
    });
  }
});


/* ========================= ACTIVITY STATUS CHART ========================= */

router.get("/chart-status", auth, isAdmin, async (req, res) => {
  try {
    const days = validDays(req.query.days);

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const activities = await Activity.findAll({
      where: {
        createdAt: {
          [Op.gte]: startDate,
        },
      },
      attributes: [
        "id",
        "date",
        "time",
        "endTime",
        "endsNextDay",
        "status",
      ],
      raw: true,
    });

    const counts = {
      upcoming: 0,
      ongoing: 0,
      ended: 0,
      suspended: 0,
    };

    const now = new Date();

    activities.forEach((activity) => {
      // กิจกรรมที่ถูกระงับ ให้นับเป็น "ระงับแล้ว" ก่อน
      if (activity.status === "suspended") {
        counts.suspended += 1;
        return;
      }

      if (!activity.date || !activity.time) {
        return;
      }

      const startDateTime = getActivityStartDateTime(activity);
      const endDateTime = getActivityEndDateTime(activity);
      if (!startDateTime || !endDateTime) return;

      if (now < startDateTime) {
        counts.upcoming += 1;
      } else if (
        now >= startDateTime &&
        now <= endDateTime
      ) {
        counts.ongoing += 1;
      } else {
        counts.ended += 1;
      }
    });

    return res.json([
      {
        status: "upcoming",
        name: "ยังไม่เริ่ม",
        value: counts.upcoming,
      },
      {
        status: "ongoing",
        name: "กำลังดำเนินการ",
        value: counts.ongoing,
      },
      {
        status: "ended",
        name: "สิ้นสุดแล้ว",
        value: counts.ended,
      },
      {
        status: "suspended",
        name: "ระงับแล้ว",
        value: counts.suspended,
      },
    ]);
  } catch (error) {
    console.error(
      "Admin activity status chart error:",
      error
    );

    return res.status(500).json({
      message: "ไม่สามารถโหลดข้อมูลสถานะกิจกรรมได้",
    });
  }
});

router.get("/reviews", auth, isAdmin, async (req, res) => {
  try {
    const [activityReviews, hostReviews] = await Promise.all([
      ActivityReview.findAll({
        order: [["createdAt", "DESC"]],
        raw: true,
      }),

      HostReview.findAll({
        order: [["createdAt", "DESC"]],
        raw: true,
      }),
    ]);

    const activityIds = [
      ...new Set(
        [...activityReviews, ...hostReviews]
          .map((review) => Number(review.activityId))
          .filter(Boolean)
      ),
    ];

    const reviewerIds = [
      ...new Set(
        [...activityReviews, ...hostReviews]
          .map((review) => Number(review.reviewerId))
          .filter(Boolean)
      ),
    ];

    const hostIds = [
      ...new Set(
        hostReviews
          .map((review) => Number(review.hostId))
          .filter(Boolean)
      ),
    ];

    // โหลดข้อมูลกิจกรรมก่อน
    const activities = activityIds.length
      ? await Activity.findAll({
        where: {
          id: {
            [Op.in]: activityIds,
          },
        },
        attributes: [
          "id",
          "activityName",
          "cover",
          "createdBy",
        ],
        raw: true,
      })
      : [];

    // ดึง id ผู้สร้างกิจกรรม
    const creatorIds = [
      ...new Set(
        activities
          .map((activity) => Number(activity.createdBy))
          .filter(Boolean)
      ),
    ];

    // รวม user ทุกคนที่จำเป็นต้องใช้
    const userIds = [
      ...new Set([
        ...reviewerIds,
        ...hostIds,
        ...creatorIds,
      ]),
    ];

    const [users, comments] = await Promise.all([
      userIds.length
        ? User.findAll({
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
          raw: true,
        })
        : [],

      activityIds.length && reviewerIds.length
        ? Comment.findAll({
          where: {
            activityId: {
              [Op.in]: activityIds,
            },
            userId: {
              [Op.in]: reviewerIds,
            },
          },
          order: [["createdAt", "DESC"]],
          raw: true,
        })
        : [],
    ]);

    const activityMap = new Map(
      activities.map((activity) => [
        Number(activity.id),
        activity,
      ])
    );

    const userMap = new Map(
      users.map((user) => [
        Number(user.id),
        user,
      ])
    );

    const commentMap = new Map();

    comments.forEach((comment) => {
      const key = `${Number(comment.activityId)}:${Number(
        comment.userId
      )}`;

      if (!commentMap.has(key)) {
        commentMap.set(key, comment);
      }
    });

    const activityReviewRows = activityReviews.map((review) => {
      const activityId = Number(review.activityId);
      const reviewerId = Number(review.reviewerId);

      const activity = activityMap.get(activityId);
      const reviewer = userMap.get(reviewerId);

      // ผู้สร้างกิจกรรม
      const creator = activity
        ? userMap.get(Number(activity.createdBy))
        : null;

      const comment = commentMap.get(
        `${activityId}:${reviewerId}`
      );

      return {
        id: `activity-${review.id}`,
        originalId: review.id,
        type: "activity",

        activityId,
        reviewerId,

        rating: Number(review.rating || 0),
        comment: comment?.comment || "",
        isPublic: comment?.isPublic ?? false,

        targetName:
          activity?.activityName || "ไม่ระบุชื่อกิจกรรม",

        targetImage: activity?.cover || null,

        // เพิ่มข้อมูลผู้จัดกิจกรรม
        creatorName:
          creator?.name ||
          creator?.username ||
          "ไม่ระบุผู้จัดกิจกรรม",

        creatorUsername:
          creator?.username || "",

        creatorProfileImage:
          creator?.profileImage || null,

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          "ไม่ระบุชื่อ",

        reviewerUsername:
          reviewer?.username || "",

        reviewerProfileImage:
          reviewer?.profileImage || null,

        createdAt: review.createdAt,
      };
    });

    const hostReviewRows = hostReviews.map((review) => {
      const activityId = Number(review.activityId);
      const reviewerId = Number(review.reviewerId);
      const hostId = Number(review.hostId);

      const activity = activityMap.get(activityId);
      const reviewer = userMap.get(reviewerId);
      const host = userMap.get(hostId);

      const creator = activity
        ? userMap.get(Number(activity.createdBy))
        : null;

      const comment = commentMap.get(
        `${activityId}:${reviewerId}`
      );

      return {
        id: `host-${review.id}`,
        originalId: review.id,
        type: "host",

        activityId,
        hostId,
        reviewerId,

        rating: Number(review.rating || 0),
        comment: comment?.comment || "",
        isPublic: comment?.isPublic ?? false,

        targetName:
          host?.name ||
          host?.username ||
          "ไม่ระบุชื่อผู้จัดกิจกรรม",

        targetUsername: host?.username || "",

        targetImage: host?.profileImage || null,

        activityName:
          activity?.activityName || "ไม่ระบุชื่อกิจกรรม",

        // เพิ่มข้อมูลผู้จัดกิจกรรม
        creatorName:
          creator?.name ||
          creator?.username ||
          "ไม่ระบุผู้จัดกิจกรรม",

        creatorUsername:
          creator?.username || "",

        creatorProfileImage:
          creator?.profileImage || null,

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          "ไม่ระบุชื่อ",

        reviewerUsername:
          reviewer?.username || "",

        reviewerProfileImage:
          reviewer?.profileImage || null,

        createdAt: review.createdAt,
      };
    });

    const reviews = [
      ...activityReviewRows,
      ...hostReviewRows,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    );

    return res.json({
      reviews,
      totalReviews: reviews.length,
      activityReviewCount: activityReviewRows.length,
      hostReviewCount: hostReviewRows.length,
    });
  } catch (error) {
    console.error("Get admin reviews error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดข้อมูลรีวิวได้",
      error: error.message,
    });
  }
});

router.put("/reports/:id/view", auth, isAdmin, async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "ไม่พบรายงาน",
      });
    }

    if (report.status === "pending") {
      await report.update({
        status: "reviewing",
      });
    }

    res.json(report);
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});
router.put("/reports/:id/status", auth, isAdmin, async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "ไม่พบรายงาน",
      });
    }
    if (
      report.status === "resolved" ||
      report.status === "rejected"
    ) {
      return res.status(400).json({
        message: "รายงานนี้ได้รับการตรวจสอบเรียบร้อยแล้ว ไม่สามารถเปลี่ยนผลการตรวจสอบได้",
      });
    }

    const {
      status,
      decision,
      adminNote,
    } = req.body;

    const allowedStatuses = [
      "reviewing",
      "resolved",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "สถานะรายงานไม่ถูกต้อง",
      });
    }

    if (!decision) {
      return res.status(400).json({
        message: "กรุณาระบุผลการตรวจสอบ",
      });
    }

    const allowedDecisions = [
      "no_violation",
      "warning",
      "suspend_activity",
      "reject_report",
    ];

    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({
        message: "ผลการตรวจสอบไม่ถูกต้อง",
      });
    }

    if (
      (decision === "reject_report" && status !== "rejected") ||
      (decision !== "reject_report" && status !== "resolved")
    ) {
      return res.status(400).json({
        message: "สถานะและผลการตรวจสอบไม่สอดคล้องกัน",
      });
    }

    const reviewedAt = new Date();
    const note = adminNote?.trim() || null;

    /*ถ้าเป็นผลตรวจสอบสุดท้าย ให้อัปเดตรายงานทั้งหมดของกิจกรรมเดียวกัน*/
    if (status === "resolved" || status === "rejected") {
      await Report.update(
        {
          status,
          decision,
          adminNote: note,
          reviewedBy: req.userId,
          reviewedAt,
        },
        {
          where: {
            activityId: report.activityId,
          },
        }
      );
    } else {
      /*ถ้ายังอยู่ระหว่างตรวจสอบอัปเดตเฉพาะรายงานที่กดเข้ามา*/
      await report.update({
        status,
        decision,
        adminNote: note,
        reviewedBy: req.userId,
        reviewedAt,
      });
    }

    /*แจ้งเตือนผู้สร้างกิจกรรมแต่ยังไม่ระงับกิจกรรม*/
    if (
      status === "resolved" &&
      decision === "warning"
    ) {
      const activity = await Activity.findByPk(
        report.activityId
      );

      if (!activity) {
        return res.status(404).json({
          message: "ไม่พบกิจกรรมที่ถูกรายงาน",
        });
      }

      try {
        await notificationService.createNotification(
          activity.createdBy,
          "activity_warning",
          activity.id,
          activity.activityName,
          req.userId,
          "ผู้ดูแลระบบ",
          {
            deduplicate: true,
            adminNote: note,
          }
        );

        await Promise.resolve(
          notificationService.emitCountUpdate(
            activity.createdBy
          )
        );
      } catch (notificationError) {
        console.error(
          "Create activity warning notification error:",
          notificationError
        );
      }
    }

    if (
      status === "resolved" &&
      decision === "suspend_activity"
    ) {
      const activity = await Activity.findByPk(
        report.activityId
      );

      if (!activity) {
        return res.status(404).json({
          message: "ไม่พบกิจกรรมที่ถูกรายงาน",
        });
      }

      await activity.update({
        status: "suspended",
      });

      /*แจ้งเตือนล้มเหลวต้องไม่ทำให้การบันทึกผลตรวจสอบล้มเหลว*/
      try {
        await notificationService.createNotification(
          activity.createdBy,
          "activity_suspended",
          activity.id,
          activity.activityName,
          req.userId,
          "ผู้ดูแลระบบ",
          {
            deduplicate: true,
            adminNote: note,
          }
        );

        notificationService.emitCountUpdate(
          activity.createdBy
        );
      } catch (notificationError) {
        console.error(
          "Create suspension notification error:",
          notificationError
        );
      }
    }

    /*โหลด report ใหม่ เพราะ Report.update()ไม่ได้แก้ object report เดิมในหน่วยความจำ*/
    const updatedReport = await Report.findByPk(
      req.params.id
    );

    const reviewer = await User.findByPk(req.userId, {
      attributes: [
        "id",
        "username",
        "name",
        "profileImage",
      ],
    });

    return res.json({
      message: "บันทึกผลการตรวจสอบสำเร็จ",

      report: {
        ...updatedReport.toJSON(),

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          "ผู้ดูแลระบบ",

        reviewerUsername:
          reviewer?.username || null,

        reviewerProfileImage:
          reviewer?.profileImage || null,
      },
    });
  } catch (error) {
    console.error(
      "Update report status error:",
      error
    );

    return res.status(500).json({
      message: "บันทึกผลการตรวจสอบไม่สำเร็จ",
      error: error.message,
    });
  }
});

router.get("/reports/:id", auth, isAdmin, async (req, res) => {
  try {
    // หา report ที่แอดมินกดเข้ามาก่อน
    const selectedReport = await Report.findByPk(req.params.id);

    if (!selectedReport) {
      return res.status(404).json({
        message: "ไม่พบรายงาน",
      });
    }
    const reports = await Report.findAll({
      where: {
        activityId: selectedReport.activityId,
      },
      order: [["createdAt", "DESC"]],
    });

    const activity = await Activity.findByPk(selectedReport.activityId, {
      attributes: [
        "id",
        "activityName",
        "detail",
        "activityType",
        "category",
        "cover",
        "location",
        "date",
        "time",
        "endTime",
        "participantCount",
        "status",
        "createdBy",
        "createdAt",
      ],
    });

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรมที่ถูกรายงาน",
      });
    }

    const reporterIds = [
      ...new Set(
        reports
          .map((report) => Number(report.userId))
          .filter(Boolean)
      ),
    ];

    const reviewerIds = [
      ...new Set(
        reports
          .map((report) => Number(report.reviewedBy))
          .filter(Boolean)
      ),
    ];

    const userIds = [
      ...new Set([
        ...reporterIds,
        ...reviewerIds,
        Number(activity.createdBy),
      ]),
    ].filter(Boolean);

    const users = userIds.length
      ? await User.findAll({
        where: {
          id: {
            [Op.in]: userIds,
          },
        },
        attributes: [
          "id",
          "username",
          "name",
          "profileImage",
        ],
      })
      : [];

    const userMap = new Map(
      users.map((user) => [
        Number(user.id),
        user.toJSON(),
      ])
    );

    const creator = userMap.get(Number(activity.createdBy));

    const reportList = reports.map((report) => {
      const reporter = userMap.get(Number(report.userId));
      const reviewer = userMap.get(Number(report.reviewedBy));

      return {
        ...report.toJSON(),

        reporterName:
          reporter?.name ||
          reporter?.username ||
          "ผู้ใช้งาน",

        reporterUsername:
          reporter?.username ||
          reporter?.name ||
          "ผู้ใช้งาน",

        reporterProfileImage:
          reporter?.profileImage || null,

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          null,

        reviewerUsername:
          reviewer?.username || null,

        reviewerProfileImage:
          reviewer?.profileImage || null,
      };
    });

    return res.json({
      ...selectedReport.toJSON(),

      activityId: activity.id,
      activityName:
        activity.activityName ||
        "ไม่ระบุชื่อกิจกรรม",

      activityDetail: activity.detail || "",
      activityType: activity.activityType || "public",
      activityCategory: activity.category || [],
      activityCover: activity.cover || null,
      activityLocation: activity.location || null,
      activityDate: activity.date || null,
      activityTime:
        activity.time && activity.endTime
          ? `${activity.time} - ${activity.endTime}`
          : activity.time || "-",
      activityParticipantCount: Number(activity.participantCount || 0),
      activityStatus: activity.status || null,
      activityCreatedAt: activity.createdAt || null,

      creatorName:
        creator?.name ||
        creator?.username ||
        "ไม่ระบุผู้สร้าง",

      creatorUsername:
        creator?.username ||
        creator?.name ||
        "ไม่ระบุ",

      reportCount: reportList.length,
      reports: reportList,
    });
  } catch (error) {
    console.error("Get activity report detail error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดรายละเอียดรายงานได้",
      error: error.message,
    });
  }
});

/* ========================= AI MODERATION ========================= */

const AI_CATEGORY_LABELS = {
  profanity: "คำหยาบ",
  insult: "คำดูหมิ่นหรือด่าทอ",
  sexual: "เนื้อหาทางเพศที่ไม่เหมาะสม",
  spam: "สแปมหรือเนื้อหาเสี่ยง",
};

const AI_FIELD_LABELS = {
  activityName: "ชื่อกิจกรรม",
  detail: "รายละเอียดกิจกรรม",
  activityComment: "ความคิดเห็นต่อกิจกรรม",
  hostComment: "ความคิดเห็นต่อผู้จัดกิจกรรม",
};

const formatFlag = (flag, comment = null) => ({
  id: flag.id,
  commentId: flag.commentId,
  field: flag.field,
  fieldLabel: AI_FIELD_LABELS[flag.field] || flag.field,
  label: flag.label,
  categoryLabel: AI_CATEGORY_LABELS[flag.label] || flag.label,
  confidence: Number(flag.confidence || 0),
  processingTimeMs:
    flag.processingTimeMs != null
      ? Number(flag.processingTimeMs)
      : null,
  flaggedText: flag.flaggedText || null,
  resolvedText: flag.resolvedText || null,
  status: flag.status,
  reviewedBy: flag.reviewedBy || null,
  reviewedAt: flag.reviewedAt || null,
  comment: comment?.comment || "",
  commentType: comment?.commentType || null,
  isPublic: comment?.isPublic ?? null,
  createdAt: flag.createdAt,
});

/* ---------- ACTIVITIES ---------- */

router.get("/moderation/activities", auth, isAdmin, async (req, res) => {
  try {
    const flags = await ModerationFlag.findAll({
      where: { contentType: "activity" },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (!flags.length) return res.json([]);

    const activityIds = [...new Set(flags.map(f => Number(f.activityId)).filter(Boolean))];

    const activities = await Activity.findAll({
      where: { id: { [Op.in]: activityIds } },
      paranoid: false,
      raw: true,
    });

    const creatorIds = [...new Set(activities.map(a => Number(a.createdBy)).filter(Boolean))];

    const creators = creatorIds.length
      ? await User.findAll({
        where: { id: { [Op.in]: creatorIds } },
        attributes: ["id", "username", "name", "profileImage"],
        raw: true,
      })
      : [];

    const creatorMap = new Map(creators.map(u => [Number(u.id), u]));
    const flagMap = new Map();

    flags.forEach(flag => {
      const id = Number(flag.activityId);
      if (!flagMap.has(id)) flagMap.set(id, []);
      flagMap.get(id).push(formatFlag(flag));
    });

    const result = activities.map(activity => {
      const creator = creatorMap.get(Number(activity.createdBy));
      const moderationFlags = flagMap.get(Number(activity.id)) || [];

      return {
        ...activity,
        creatorName: creator?.name || creator?.username || "ไม่ระบุผู้สร้าง",
        creatorUsername: creator?.username || null,
        creatorProfileImage: creator?.profileImage || null,
        moderationFlags,
        flagCount: moderationFlags.length,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Get activity moderation error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดกิจกรรมที่ต้องตรวจสอบได้" });
  }
});

router.get("/moderation/activities/:activityId", auth, isAdmin, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId, { paranoid: false });
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    const flags = await ModerationFlag.findAll({
      where: { contentType: "activity", activityId: activity.id, },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (!flags.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลการตรวจสอบกิจกรรมนี้",
      });
    }

    const creator = await User.findByPk(activity.createdBy, {
      attributes: ["id", "username", "name", "profileImage"],
      raw: true,
    });

    return res.json({
      ...activity.toJSON(),
      creatorName: creator?.name || creator?.username || "ไม่ระบุผู้สร้าง",
      creatorUsername: creator?.username || null,
      creatorProfileImage: creator?.profileImage || null,
      moderationFlags: flags.map(flag => formatFlag(flag)),
    });
  } catch (error) {
    console.error("Get activity moderation detail error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดรายละเอียดกิจกรรมได้" });
  }
});

router.put("/moderation/activities/:activityId/reviewed", auth, isAdmin, async (req, res) => {
  try {
    const [updated] = await ModerationFlag.update(
      { status: "reviewed", reviewedBy: req.userId, reviewedAt: new Date() },
      { where: { contentType: "activity", activityId: req.params.activityId, status: "pending" } }
    );

    if (!updated) return res.status(404).json({ message: "ไม่พบรายการที่รอตรวจสอบ" });
    return res.json({ message: "ตรวจสอบกิจกรรมเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Review activity moderation error:", error);
    return res.status(500).json({ message: "ไม่สามารถบันทึกผลการตรวจสอบได้" });
  }
});

router.put("/moderation/activities/:activityId/suspend", auth, isAdmin, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId, { paranoid: false });
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    const actionableFlags = await ModerationFlag.count({
      where: {
        contentType: "activity",
        activityId: activity.id,
        status: {
          [Op.in]: ["pending", "reviewed"],
        },
      },
    });

    if (!actionableFlags) {
      return res.status(404).json({
        message: "ไม่พบรายการที่สามารถดำเนินการได้",
      });
    }

    const reviewedAt = new Date();

    await activity.update({ status: "suspended" });
    await ModerationFlag.update(
      {
        status: "actioned",
        reviewedBy: req.userId,
        reviewedAt,
      },
      {
        where: {
          contentType: "activity",
          activityId: activity.id,
          status: {
            [Op.in]: ["pending", "reviewed"],
          },
        },
      }
    );

    try {
      await notificationService.createNotification(
        activity.createdBy,
        "activity_suspended",
        activity.id,
        activity.activityName,
        req.userId,
        "ผู้ดูแลระบบ",
        {
          deduplicate: true,
          adminNote: "กิจกรรมถูกระงับหลังจากผู้ดูแลระบบตรวจสอบข้อความที่ AI ตรวจพบ",
        }
      );
    } catch (error) {
      console.error("Moderation suspension notification error:", error);
    }
    // แจ้งเตือนผู้สร้างกิจกรรมเมื่อผู้ดูแลระบบซ่อนข้อความรีวิว
    try {
      const activity = await Activity.findByPk(activityId, {
        paranoid: false,
      });

      if (activity) {
        await notificationService.createNotification(
          activity.createdBy,
          "review_hidden_by_admin",
          activity.id,
          activity.activityName,
          req.userId,
          "ผู้ดูแลระบบ",
          {
            deduplicate: true,
          }
        );

        await Promise.resolve(
          notificationService.emitCountUpdate(activity.createdBy)
        );
      }
    } catch (notificationError) {
      console.error(
        "Create review hidden notification error:",
        notificationError
      );
    }

    return res.json({ message: "ระงับกิจกรรมเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Suspend moderated activity error:", error);
    return res.status(500).json({ message: "ไม่สามารถระงับกิจกรรมได้" });
  }
});

/* ---------- REVIEWS ---------- */

router.get("/moderation/reviews", auth, isAdmin, async (req, res) => {
  try {
    const flags = await ModerationFlag.findAll({
      where: { contentType: "review" },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (!flags.length) return res.json([]);

    const activityIds = [...new Set(flags.map(f => Number(f.activityId)).filter(Boolean))];
    const userIds = [...new Set(flags.map(f => Number(f.userId)).filter(Boolean))];
    const commentIds = [...new Set(flags.map(f => Number(f.commentId)).filter(Boolean))];

    const [activities, users, comments] = await Promise.all([
      Activity.findAll({
        where: { id: { [Op.in]: activityIds } },
        paranoid: false,
        attributes: ["id", "activityName", "cover"],
        raw: true,
      }),
      User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ["id", "username", "name", "profileImage"],
        raw: true,
      }),
      Comment.findAll({ where: { id: { [Op.in]: commentIds } }, raw: true }),
    ]);

    const activityMap = new Map(activities.map(a => [Number(a.id), a]));
    const userMap = new Map(users.map(u => [Number(u.id), u]));
    const commentMap = new Map(comments.map(c => [Number(c.id), c]));
    const grouped = new Map();

    flags.forEach(flag => {
      const key = `${flag.activityId}:${flag.userId}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          activityId: Number(flag.activityId),
          userId: Number(flag.userId),
          moderationFlags: [],
        });
      }

      grouped.get(key).moderationFlags.push(
        formatFlag(flag, commentMap.get(Number(flag.commentId)))
      );
    });

    const result = [...grouped.values()].map(item => {
      const activity = activityMap.get(item.activityId);
      const reviewer = userMap.get(item.userId);

      return {
        ...item,
        activityName: activity?.activityName || "ไม่ระบุชื่อกิจกรรม",
        activityCover: activity?.cover || null,
        reviewerName: reviewer?.name || reviewer?.username || "ผู้ใช้งาน",
        reviewerUsername: reviewer?.username || null,
        reviewerProfileImage: reviewer?.profileImage || null,
        flagCount: item.moderationFlags.length,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error("Get review moderation error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดรีวิวที่ต้องตรวจสอบได้" });
  }
});

router.get("/moderation/reviews/:activityId/:userId", auth, isAdmin, async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    const userId = Number(req.params.userId);

    const flags = await ModerationFlag.findAll({
      where: {
        contentType: "review",
        activityId,
        userId,
      },
      order: [["createdAt", "DESC"]],
      raw: true,
    });

    if (!flags.length) {
      return res.status(404).json({
        message: "ไม่พบข้อมูลการตรวจสอบรีวิวนี้",
      });
    }

    const commentIds = [...new Set(flags.map(f => Number(f.commentId)).filter(Boolean))];

    const [activity, reviewer, comments, activityReview, hostReview] = await Promise.all([
      Activity.findByPk(activityId, {
        paranoid: false,
        attributes: ["id", "activityName", "cover"],
        raw: true,
      }),
      User.findByPk(userId, {
        attributes: ["id", "username", "name", "profileImage"],
        raw: true,
      }),
      Comment.findAll({ where: { id: { [Op.in]: commentIds } }, raw: true }),
      ActivityReview.findOne({ where: { activityId, reviewerId: userId }, raw: true }),
      HostReview.findOne({ where: { activityId, reviewerId: userId }, raw: true }),
    ]);

    const commentMap = new Map(comments.map(c => [Number(c.id), c]));

    return res.json({
      activityId,
      activityName: activity?.activityName || "ไม่ระบุชื่อกิจกรรม",
      activityCover: activity?.cover || null,
      userId,
      reviewerName: reviewer?.name || reviewer?.username || "ผู้ใช้งาน",
      reviewerUsername: reviewer?.username || null,
      reviewerProfileImage: reviewer?.profileImage || null,
      activityRating: activityReview?.rating != null ? Number(activityReview.rating) : null,
      hostRating: hostReview?.rating != null ? Number(hostReview.rating) : null,
      moderationFlags: flags.map(flag =>
        formatFlag(flag, commentMap.get(Number(flag.commentId)))
      ),
    });
  } catch (error) {
    console.error("Get review moderation detail error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดรายละเอียดรีวิวได้" });
  }
});

router.put("/moderation/reviews/:activityId/:userId/reviewed", auth, isAdmin, async (req, res) => {
  try {
    const { activityId, userId } = req.params;

    const [updated] = await ModerationFlag.update(
      { status: "reviewed", reviewedBy: req.userId, reviewedAt: new Date() },
      { where: { contentType: "review", activityId, userId, status: "pending" } }
    );

    if (!updated) return res.status(404).json({ message: "ไม่พบรายการที่รอตรวจสอบ" });
    return res.json({ message: "ตรวจสอบรีวิวเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Review moderation error:", error);
    return res.status(500).json({ message: "ไม่สามารถบันทึกผลการตรวจสอบได้" });
  }
});

router.put("/moderation/reviews/:activityId/:userId/hide", auth, isAdmin, async (req, res) => {
  try {
    const { activityId, userId } = req.params;

    const flags = await ModerationFlag.findAll({
      where: {
        contentType: "review",
        activityId,
        userId,
        status: {
          [Op.in]: ["pending", "reviewed"],
        },
      },
      raw: true,
    });

    if (!flags.length) {
      return res.status(404).json({
        message: "ไม่พบรายการที่สามารถดำเนินการได้",
      });
    }

    const commentIds = [
      ...new Set(
        flags
          .map((flag) => Number(flag.commentId))
          .filter(Boolean)
      ),
    ];

    if (commentIds.length) {
      await Comment.update(
        { isPublic: false },
        {
          where: {
            id: {
              [Op.in]: commentIds,
            },
          },
        }
      );
    }

    await ModerationFlag.update(
      {
        status: "actioned",
        reviewedBy: req.userId,
        reviewedAt: new Date(),
      },
      {
        where: {
          contentType: "review",
          activityId,
          userId,
          status: {
            [Op.in]: ["pending", "reviewed"],
          },
        },
      }
    );

    return res.json({
      message: "ซ่อนข้อความรีวิวที่ AI ตรวจพบเรียบร้อยแล้ว",
    });
  } catch (error) {
    console.error("Hide moderated review error:", error);

    return res.status(500).json({
      message: "ไม่สามารถซ่อนข้อความรีวิวได้",
    });
  }
});

/* ========================= INAPPROPRIATE WORDS ========================= */

router.get("/inappropriate-words", auth, isAdmin, async (req, res) => {
  try {
    const words = await InappropriateWord.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.json(words);
  } catch (error) {
    console.error("Get inappropriate words error:", error);

    return res.status(500).json({
      message: "ไม่สามารถโหลดรายการคำไม่เหมาะสมได้",
    });
  }
});

router.post("/inappropriate-words", auth, isAdmin, async (req, res) => {
  try {
    const {
      word,
      category,
      level,
    } = req.body;

    const cleanWord = String(word || "").trim();

    if (!cleanWord) {
      return res.status(400).json({
        message: "กรุณากรอกคำที่ต้องการเพิ่ม",
      });
    }

    const allowedCategories = [
      "profanity",
      "insult",
      "threat",
      "sexual",
      "spam",
      "alcohol",
    ];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: "ประเภทคำไม่ถูกต้อง",
      });
    }

    if (!["warning", "danger"].includes(level)) {
      return res.status(400).json({
        message: "ระดับความรุนแรงไม่ถูกต้อง",
      });
    }

    const exists = await InappropriateWord.findOne({
      where: { word: cleanWord },
    });

    if (exists) {
      return res.status(400).json({
        message: "มีคำนี้อยู่ในรายการแล้ว",
      });
    }

    const created = await InappropriateWord.create({
      word: cleanWord,
      category,
      weight: level === "danger" ? 80 : 40,
      match: "contains",
      createdBy: req.userId,
    });

    await refreshModerationWords();

    return res.status(201).json(created);
  } catch (error) {
    console.error("Create inappropriate word error:", error);

    return res.status(500).json({
      message: "ไม่สามารถเพิ่มคำไม่เหมาะสมได้",
    });
  }
});

router.put("/inappropriate-words/:id", auth, isAdmin, async (req, res) => {
  try {
    const item = await InappropriateWord.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "ไม่พบคำที่ต้องการแก้ไข",
      });
    }

    const {
      word,
      category,
      level,
    } = req.body;

    const cleanWord = String(word || "").trim();

    if (!cleanWord) {
      return res.status(400).json({
        message: "กรุณากรอกคำที่ต้องการแก้ไข",
      });
    }

    const allowedCategories = [
      "profanity",
      "insult",
      "threat",
      "sexual",
      "spam",
      "alcohol",
    ];

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: "ประเภทคำไม่ถูกต้อง",
      });
    }

    if (!["warning", "danger"].includes(level)) {
      return res.status(400).json({
        message: "ระดับความรุนแรงไม่ถูกต้อง",
      });
    }

    const duplicate = await InappropriateWord.findOne({
      where: {
        word: cleanWord,
        id: {
          [Op.ne]: item.id,
        },
      },
    });

    if (duplicate) {
      return res.status(400).json({
        message: "มีคำนี้อยู่ในรายการแล้ว",
      });
    }

    await item.update({
      word: cleanWord,
      category,
      weight: level === "danger" ? 80 : 40,
    });

    await refreshModerationWords();

    return res.json(item);
  } catch (error) {
    console.error("Update inappropriate word error:", error);

    return res.status(500).json({
      message: "ไม่สามารถแก้ไขคำไม่เหมาะสมได้",
    });
  }
});

router.delete("/inappropriate-words/:id", auth, isAdmin, async (req, res) => {
  try {
    const item = await InappropriateWord.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "ไม่พบคำที่ต้องการลบ",
      });
    }

    await item.destroy();

    await refreshModerationWords();

    return res.json({
      message: "ลบคำไม่เหมาะสมสำเร็จ",
    });
  } catch (error) {
    console.error("Delete inappropriate word error:", error);

    return res.status(500).json({
      message: "ไม่สามารถลบคำไม่เหมาะสมได้",
    });
  }
});

module.exports = router;
