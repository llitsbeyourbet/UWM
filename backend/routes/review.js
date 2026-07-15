const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const ActivityReview = require("../models/ActivityReview");
const HostReview = require("../models/HostReview");
const Comment = require("../models/Comment");
const JoinRequest = require("../models/JoinRequest");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");

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

// เช็คว่า checked_in แล้วไหม
const checkCheckedIn = async (userId, activityId) => {
  const joinRequest = await JoinRequest.findOne({
    where: { userId, activityId, status: "checked_in" }
  });
  return !!joinRequest;
};

const attachUsersToComments = async (comments) => {
  return Promise.all(
    comments.map(async (comment) => {
      const user = await User.findByPk(comment.userId, {
        attributes: ["id", "name", "username", "profileImage"],
      });

      return {
        ...comment.toJSON(),
        user,
      };
    })
  );
};

// ส่งรีวิว
router.post("/:activityId", auth, async (req, res) => {
  try {
    const { activityId } = req.params;
    const { activityRating, hostRating, comment } = req.body;

    // เช็คว่า checked_in แล้วไหม
    const checkedIn = await checkCheckedIn(req.userId, activityId);
    if (!checkedIn)
      return res.status(403).json({ message: "ต้องยืนยันการเข้าร่วมก่อนถึงจะรีวิวได้" });

    // เช็คว่ารีวิวซ้ำไหม
    const existingReview = await ActivityReview.findOne({
      where: { activityId, reviewerId: req.userId }
    });
    if (existingReview)
      return res.status(400).json({ message: "คุณรีวิวกิจกรรมนี้ไปแล้ว" });

    // ดึงข้อมูลกิจกรรมเพื่อหา hostId
    const activity = await Activity.findByPk(activityId);
    if (!activity) return res.status(404).json({ message: "ไม่พบกิจกรรม" });

    // บันทึก ActivityReview
    await ActivityReview.create({
      activityId,
      reviewerId: req.userId,
      rating: activityRating,
    });

    // บันทึก HostReview
    await HostReview.create({
      hostId: activity.createdBy,
      reviewerId: req.userId,
      activityId,
      rating: hostRating,
    });

    const user = await User.findByPk(req.userId);

    await notificationService.createNotification(
      activity.createdBy,
      "review",
      activity.id,
      activity.activityName,
      req.userId,
      user.username
    );

    // บันทึก Comment (ถ้ามี)
    if (comment && comment.trim()) {
      await Comment.create({
        activityId,
        userId: req.userId,
        comment: comment.trim(),
      });
    }

    res.status(201).json({ message: "รีวิวสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรีวิวของกิจกรรม
router.get("/activity/:activityId", async (req, res) => {
  try {
    const reviews = await ActivityReview.findAll({
      where: { activityId: req.params.activityId },
    });

    const comments = await Comment.findAll({
      where: { activityId: req.params.activityId },
    });

    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({ reviews, comments, avgRating, totalReviews: reviews.length });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงคะแนน host
router.get("/host/:hostId", async (req, res) => {
  try {
    const reviews = await HostReview.findAll({
      where: { hostId: req.params.hostId },
    });

    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({ avgRating, totalReviews: reviews.length });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// เช็คว่ารีวิวแล้วไหม
router.get("/:activityId/status", auth, async (req, res) => {
  try {
    const review = await ActivityReview.findOne({
      where: { activityId: req.params.activityId, reviewerId: req.userId }
    });
    res.json({ reviewed: !!review });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึง comment สำหรับเจ้าของกิจกรรมเท่านั้น
router.get("/activity/:activityId/comments", auth, async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    if (Number(activity.createdBy) !== Number(req.userId)) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์ดู comment" });
    }

    const comments = await Comment.findAll({
      where: { activityId: req.params.activityId },
      order: [["createdAt", "DESC"]],
    });

    const commentsWithUsers = await attachUsersToComments(comments);

    res.json(commentsWithUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงคะแนนเฉลี่ยกิจกรรม (ทุกคนเห็นได้)
router.get("/activity/:activityId/rating", async (req, res) => {
  try {
    const reviews = await ActivityReview.findAll({
      where: { activityId: req.params.activityId },
    });

    const avgRating = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({ avgRating, totalReviews: reviews.length });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึง comments สาธารณะ (ทุกคนเห็น)
router.get("/activity/:activityId/comments/public", async (req, res) => {
  try {
    const activity = await Activity.findByPk(req.params.activityId);

    if (!activity) {
      return res.status(404).json({ message: "ไม่พบกิจกรรม" });
    }

    const comments = await Comment.findAll({
      where: {
        activityId: req.params.activityId,
        isPublic: true,
      },
      order: [["createdAt", "DESC"]],
    });

    const commentsWithUsers = await attachUsersToComments(comments);

    res.json(commentsWithUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
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

    // เฉพาะเจ้าของกิจกรรมเท่านั้น
    if (Number(activity.createdBy) !== Number(req.userId)) {
      return res.status(403).json({
        message: "ไม่มีสิทธิ์เปลี่ยนการมองเห็นความคิดเห็น",
      });
    }

    await comment.update({ isPublic });

    res.json({
      message: "อัปเดตสถานะสำเร็จ",
      comment,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;