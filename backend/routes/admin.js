const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { Op, fn, col } = require("sequelize");

const Activity = require("../models/Activity");
const User = require("../models/User");
const Report = require("../models/Report");
const JoinRequest = require("../models/JoinRequest");
const ActivityReview = require("../models/ActivityReview");
const HostReview = require("../models/HostReview");
const Comment = require("../models/Comment");
const notificationService = require("../services/notificationService");

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "ไม่มี token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch {
    return res.status(401).json({ message: "token ไม่ถูกต้อง" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
  }

  next();
};

const validDays = (value) => {
  const days = Number(value || 7);
  return [7, 30, 90, 365].includes(days) ? days : 7;
};

const dateKey = (value) => new Date(value).toISOString().split("T")[0];

/* ========================= DASHBOARD ========================= */

router.get("/dashboard", auth, isAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalActivities,
      totalReports,
      pendingReports,
      suspendedActivities,
      totalCheckins,
      totalParticipants,
      totalReviews,
    ] = await Promise.all([
      User.count(),
      Activity.count(),
      Report.count(),
      Report.count({ where: { status: "pending" } }),
      Activity.count({ where: { status: "suspended" } }),
      JoinRequest.count({ where: { status: "checked_in" } }),
      JoinRequest.count({
        where: {
          status: {
            [Op.in]: ["approved", "checked_in"],
          },
        },
      }),
      ActivityReview.count(),
    ]);

    return res.json({
      totalUsers,
      totalActivities,
      totalReports,
      pendingReports,
      suspendedActivities,
      totalCheckins,
      totalParticipants,
      totalReviews,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลด Dashboard ได้" });
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
      where: { status: "pending" },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    return res.json(await enrichReports(reports));
  } catch (error) {
    console.error("Latest reports error:", error);
    return res.status(500).json({ message: "ไม่สามารถโหลดรายงานล่าสุดได้" });
  }
});

router.put("/suspend/:activityId", auth, isAdmin, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    await Promise.all([
      activity.update({ status: "suspended" }),
      Report.update(
        {
          status: "resolved",
          decision: "suspend_activity",
          reviewedAt: new Date(),
        },
        { where: { activityId: req.params.activityId } }
      ),
    ]);

    await notificationService.createNotification(
      activity.createdBy,
      "activity_suspended",
      activity.id,
      activity.activityName,
      req.userId,
      "ผู้ดูแลระบบ",
      { deduplicate: true }
    );

    notificationService.emitCountUpdate(activity.createdBy);

    return res.json({ message: "ระงับกิจกรรมสำเร็จ" });
  } catch (error) {
    console.error("Suspend activity error:", error);
    return res.status(500).json({ message: "ไม่สามารถระงับกิจกรรมได้" });
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

    const userIds = [
      ...new Set([...reviewerIds, ...hostIds]),
    ];

    const [activities, users, comments] = await Promise.all([
      activityIds.length
        ? Activity.findAll({
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
        : [],

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

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          "ไม่ระบุชื่อ",

        reviewerUsername: reviewer?.username || "",

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

        reviewerName:
          reviewer?.name ||
          reviewer?.username ||
          "ไม่ระบุชื่อ",

        reviewerUsername: reviewer?.username || "",

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

    await report.update({
      status,
      decision,
      adminNote: adminNote?.trim() || null,
      reviewedBy: req.userId,
      reviewedAt: new Date(),
    });

    if (status === "resolved" && decision === "suspend_activity") {
      const activity = await Activity.findByPk(report.activityId);

      if (!activity) {
        return res.status(404).json({
          message: "ไม่พบกิจกรรมที่ถูกรายงาน",
        });
      }

      await activity.update({
        status: "suspended",
      });

      await notificationService.createNotification(
        activity.createdBy,
        "activity_suspended",
        activity.id,
        activity.activityName,
        req.userId,
        "ผู้ดูแลระบบ",
        { deduplicate: true }
      );

      notificationService.emitCountUpdate(activity.createdBy);

    }

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
        ...report.toJSON(),

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
    console.error("Update report status error:", error);

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
        "cover",
        "location",
        "date",
        "time",
        "endTime",
        "status",
        "createdBy",
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

      activityCover: activity.cover || null,
      activityLocation: activity.location || null,
      activityDate: activity.date || null,
      activityTime:
        activity.time && activity.endTime
          ? `${activity.time} - ${activity.endTime}`
          : activity.time || "-",

      activityStatus: activity.status || null,

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

module.exports = router;
