const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { auth } = require("../middleware/auth");
const sequelize = require("../database");
const ActivityReview = require("../models/ActivityReview");
const HostReview = require("../models/HostReview");
const Comment = require("../models/Comment");
const JoinRequest = require("../models/JoinRequest");
const Activity = require("../models/Activity");
const User = require("../models/User");
const notificationService = require("../services/notificationService");

const isValidRating = (value) => {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
};

const attachUsersToComments = async (comments) => {
  if (!comments.length) return [];

  const userIds = [...new Set(comments.map((comment) => Number(comment.userId)))];
  const users = await User.findAll({
    where: { id: { [Op.in]: userIds } },
    attributes: ["id", "name", "username", "profileImage"],
    raw: true,
  });
  const userMap = new Map(users.map((user) => [Number(user.id), user]));

  return comments.map((comment) => ({
    ...comment.toJSON(),
    user: userMap.get(Number(comment.userId)) || null,
  }));
};

const getDetailedReviews = async (activityId, includePrivateComments = false) => {
  const [activityReviews, hostReviews, comments] = await Promise.all([
    ActivityReview.findAll({ where: { activityId }, raw: true }),
    HostReview.findAll({ where: { activityId }, raw: true }),
    Comment.findAll({ where: { activityId }, raw: true }),
  ]);

  const activityReviewMap = new Map(
    activityReviews.map((review) => [Number(review.reviewerId), review])
  );
  const hostReviewMap = new Map(
    hostReviews.map((review) => [Number(review.reviewerId), review])
  );

  const activityCommentMap = new Map();
  const hostCommentMap = new Map();

  comments.forEach((comment) => {
    if (comment.commentType === "activity") {
      activityCommentMap.set(Number(comment.userId), comment);
    }
    if (comment.commentType === "host") {
      hostCommentMap.set(Number(comment.userId), comment);
    }
  });

  const reviewerIds = new Set([
    ...activityReviews.map((review) => Number(review.reviewerId)),
    ...hostReviews.map((review) => Number(review.reviewerId)),
  ]);

  if (!reviewerIds.size) return [];

  const users = await User.findAll({
    where: { id: { [Op.in]: [...reviewerIds] } },
    attributes: ["id", "name", "username", "profileImage"],
    raw: true,
  });
  const userMap = new Map(users.map((user) => [Number(user.id), user]));

  return [...reviewerIds]
    .filter((userId) => userMap.has(userId))
    .map((userId) => {
      const activityReview = activityReviewMap.get(userId);
      const hostReview = hostReviewMap.get(userId);
      const activityComment = activityCommentMap.get(userId);
      const hostComment = hostCommentMap.get(userId);

      const activityIsPublic = activityComment
        ? Boolean(activityComment.isPublic)
        : true;
      const hostIsPublic = hostComment ? Boolean(hostComment.isPublic) : true;

      const canSeeActivityComment =
        includePrivateComments || activityIsPublic;
      const canSeeHostComment = includePrivateComments || hostIsPublic;

      return {
        id: userId,
        userId,
        activityRating: activityReview ? Number(activityReview.rating) : null,
        hostRating: hostReview ? Number(hostReview.rating) : null,
        activityComment:
          canSeeActivityComment && activityComment
            ? activityComment.comment
            : "",
        hostComment:
          canSeeHostComment && hostComment ? hostComment.comment : "",
        activityCommentId:
          canSeeActivityComment && activityComment ? activityComment.id : null,
        hostCommentId:
          canSeeHostComment && hostComment ? hostComment.id : null,
        activityIsPublic,
        hostIsPublic,
        createdAt: activityReview
          ? activityReview.createdAt
          : hostReview
            ? hostReview.createdAt
            : null,
        reviewerId: userId,
        user: userMap.get(userId),
      };
    });
};

// ส่งรีวิว
router.post("/:activityId", auth, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const activityId = Number(req.params.activityId);
    const { activityRating, hostRating, comment, hostComment } = req.body;

    if (!Number.isInteger(activityId) || activityId <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    if (!isValidRating(activityRating) || !isValidRating(hostRating)) {
      await transaction.rollback();
      return res.status(400).json({
        message: "คะแนนรีวิวต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 5",
      });
    }

    // lock แถวการเข้าร่วมของ user/activity นี้ไว้ เพื่อกันส่งรีวิวพร้อมกันซ้ำ
    const joinRequest = await JoinRequest.findOne({
      where: {
        userId: req.userId,
        activityId,
        status: "checked_in",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!joinRequest) {
      await transaction.rollback();
      return res.status(403).json({
        message: "ต้องยืนยันการเข้าร่วมก่อนถึงจะรีวิวได้",
      });
    }

    const activity = await Activity.findByPk(activityId, {
      transaction,
      lock: transaction.LOCK.SHARE,
    });

    if (!activity) {
      await transaction.rollback();
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    const existingReview = await ActivityReview.findOne({
      where: { activityId, reviewerId: req.userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingReview) {
      await transaction.rollback();
      return res.status(400).json({ message: "คุณรีวิวกิจกรรมนี้ไปแล้ว" });
    }

    await ActivityReview.create(
      {
        activityId,
        reviewerId: req.userId,
        rating: Number(activityRating),
      },
      { transaction }
    );

    await HostReview.create(
      {
        hostId: activity.createdBy,
        reviewerId: req.userId,
        activityId,
        rating: Number(hostRating),
      },
      { transaction }
    );

    await Comment.create(
      {
        activityId,
        userId: req.userId,
        comment: String(comment || "").trim(),
        commentType: "activity",
      },
      { transaction }
    );

    await Comment.create(
      {
        activityId,
        userId: req.userId,
        comment: String(hostComment || "").trim(),
        commentType: "host",
      },
      { transaction }
    );

    await transaction.commit();

    // notification ไม่ควรทำให้ข้อมูลรีวิวหลัก rollback หาก realtime/email ส่วนนี้ล้ม
    try {
      const user = await User.findByPk(req.userId, {
        attributes: ["id", "username"],
      });

      await notificationService.createNotification(
        activity.createdBy,
        "review",
        activity.id,
        activity.activityName,
        req.userId,
        user ? user.username : ""
      );
    } catch (notificationError) {
      console.error("Review notification error:", notificationError);
    }

    return res.status(201).json({ message: "รีวิวสำเร็จ" });
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Create review error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรีวิวของกิจกรรมแบบ public
router.get("/activity/:activityId", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    const reviews = await ActivityReview.findAll({
      where: { activityId },
    });

    const comments = await Comment.findAll({
      where: { activityId, isPublic: true },
    });

    const reviewerIds = reviews.map((review) => review.reviewerId);
    const existingUsers = reviewerIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: reviewerIds } },
          attributes: ["id"],
          raw: true,
        })
      : [];

    const existingUserIds = new Set(
      existingUsers.map((user) => Number(user.id))
    );
    const filteredReviews = reviews.filter((review) =>
      existingUserIds.has(Number(review.reviewerId))
    );

    const avgRating = filteredReviews.length
      ? (
          filteredReviews.reduce(
            (sum, review) => sum + Number(review.rating),
            0
          ) / filteredReviews.length
        ).toFixed(1)
      : null;

    return res.json({
      reviews: filteredReviews,
      comments,
      avgRating,
      totalReviews: filteredReviews.length,
    });
  } catch (err) {
    console.error("Get activity reviews error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงคะแนน host
router.get("/host/:hostId", async (req, res) => {
  try {
    const hostId = Number(req.params.hostId);
    if (!Number.isInteger(hostId) || hostId <= 0) {
      return res.status(400).json({ message: "ID ผู้จัดไม่ถูกต้อง" });
    }

    const reviews = await HostReview.findAll({
      where: { hostId },
    });

    const reviewerIds = reviews.map((review) => review.reviewerId);
    const existingUsers = reviewerIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: reviewerIds } },
          attributes: ["id"],
          raw: true,
        })
      : [];

    const existingUserIds = new Set(
      existingUsers.map((user) => Number(user.id))
    );
    const filteredReviews = reviews.filter((review) =>
      existingUserIds.has(Number(review.reviewerId))
    );

    const avgRating = filteredReviews.length
      ? (
          filteredReviews.reduce(
            (sum, review) => sum + Number(review.rating),
            0
          ) / filteredReviews.length
        ).toFixed(1)
      : null;

    return res.json({ avgRating, totalReviews: filteredReviews.length });
  } catch (err) {
    console.error("Get host rating error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// เช็คว่ารีวิวแล้วไหม
router.get("/:activityId/status", auth, async (req, res) => {
  try {
    const review = await ActivityReview.findOne({
      where: {
        activityId: req.params.activityId,
        reviewerId: req.userId,
      },
    });
    return res.json({ reviewed: !!review });
  } catch (err) {
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึง comment สำหรับเจ้าของกิจกรรมเท่านั้น
router.get("/activity/:activityId/comments", auth, async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    const activity = await Activity.findByPk(activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    if (Number(activity.createdBy) !== Number(req.userId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ดู comment" });
    }

    const comments = await Comment.findAll({
      where: { activityId },
      order: [["createdAt", "DESC"]],
    });

    const commentsWithUsers = await attachUsersToComments(comments);

    return res.json(commentsWithUsers);
  } catch (err) {
    console.error("Get owner comments error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงคะแนนเฉลี่ยกิจกรรม (ทุกคนเห็นได้)
router.get("/activity/:activityId/rating", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    const reviews = await ActivityReview.findAll({
      where: { activityId },
    });

    const reviewerIds = reviews.map((review) => review.reviewerId);
    const existingUsers = reviewerIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: reviewerIds } },
          attributes: ["id"],
          raw: true,
        })
      : [];

    const existingUserIds = new Set(
      existingUsers.map((user) => Number(user.id))
    );
    const filteredReviews = reviews.filter((review) =>
      existingUserIds.has(Number(review.reviewerId))
    );

    const avgRating = filteredReviews.length
      ? (
          filteredReviews.reduce(
            (sum, review) => sum + Number(review.rating),
            0
          ) / filteredReviews.length
        ).toFixed(1)
      : null;

    return res.json({ avgRating, totalReviews: filteredReviews.length });
  } catch (err) {
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึง comments สาธารณะ (ทุกคนเห็น)
router.get("/activity/:activityId/comments/public", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    const activity = await Activity.findByPk(activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    const comments = await Comment.findAll({
      where: {
        activityId,
        isPublic: true,
      },
      order: [["createdAt", "DESC"]],
    });

    const commentsWithUsers = await attachUsersToComments(comments);

    return res.json(commentsWithUsers);
  } catch (err) {
    console.error("Get public comments error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.put("/comment/:commentId/visibility", auth, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { isPublic } = req.body;

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({
        message: "isPublic ต้องเป็น boolean",
      });
    }

    const comment = await Comment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({
        message: "ไม่พบความคิดเห็น",
      });
    }

    const activity = await Activity.findByPk(comment.activityId);

    if (!activity) {
      return res.status(404).json({
        message: "ไม่พบกิจกรรม",
      });
    }

    if (Number(activity.createdBy) !== Number(req.userId)) {
      return res.status(403).json({
        message: "ไม่มีสิทธิ์เปลี่ยนการมองเห็นความคิดเห็น",
      });
    }

    await comment.update({ isPublic });

    return res.json({
      message: "อัปเดตสถานะสำเร็จ",
      comment,
    });
  } catch (err) {
    console.error("Update comment visibility error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// Public: private comment จะไม่ถูกส่งออก แต่คะแนนยังแสดงได้ตามเดิม
router.get("/activity/:activityId/detailed-reviews", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    const result = await getDetailedReviews(activityId, false);
    return res.json(result);
  } catch (err) {
    console.error("Error in detailed-reviews:", err);
    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว",
    });
  }
});

// Owner-only: หน้าสรุปกิจกรรมของเจ้าของยังเห็น comment ที่ตั้ง private ได้
router.get(
  "/activity/:activityId/detailed-reviews-owner",
  auth,
  async (req, res) => {
    try {
      const activityId = Number(req.params.activityId);
      if (!Number.isInteger(activityId) || activityId <= 0) {
        return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
      }

      const activity = await Activity.findByPk(activityId, {
        attributes: ["id", "createdBy"],
      });

      if (!activity) {
        return res.status(404).json({ message: "ไม่พบกิจกรรม" });
      }

      if (Number(activity.createdBy) !== Number(req.userId)) {
        return res.status(403).json({
          message: "ไม่มีสิทธิ์ดูรีวิวแบบเจ้าของกิจกรรม",
        });
      }

      const result = await getDetailedReviews(activityId, true);
      return res.json(result);
    } catch (err) {
      console.error("Error in owner detailed-reviews:", err);
      return res.status(500).json({
        message: "เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว",
      });
    }
  }
);

module.exports = router;
