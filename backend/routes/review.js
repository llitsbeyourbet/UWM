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
    const { activityRating, hostRating, comment, hostComment } = req.body;

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

    // บันทึก Comment กิจกรรม (ถ้ามี)
    if (comment && comment.trim()) {
      await Comment.create({
        activityId,
        userId: req.userId,
        comment: comment.trim(),
        commentType: 'activity',
      });
    }

    // บันทึก Comment ผู้จัด (ถ้ามี)
    if (hostComment && hostComment.trim()) {
      await Comment.create({
        activityId,
        userId: req.userId,
        comment: hostComment.trim(),
        commentType: 'host',
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
    const activityId = parseInt(req.params.activityId);
    if (isNaN(activityId)) return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });

    const reviews = await ActivityReview.findAll({
      where: { activityId },
    });

    const comments = await Comment.findAll({
      where: { activityId },
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
    const activityId = parseInt(req.params.activityId);
    if (isNaN(activityId)) return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });

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

    res.json(commentsWithUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงคะแนนเฉลี่ยกิจกรรม (ทุกคนเห็นได้)
router.get("/activity/:activityId/rating", async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId);
    if (isNaN(activityId)) return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });

    const reviews = await ActivityReview.findAll({
      where: { activityId },
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
    const activityId = parseInt(req.params.activityId);
    if (isNaN(activityId)) return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });

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

const { Op } = require("sequelize");

router.get("/activity/:activityId/detailed-reviews", async (req, res) => {
  try {
    const activityId = parseInt(req.params.activityId);
    if (isNaN(activityId)) {
      return res.status(400).json({ message: "ID กิจกรรมไม่ถูกต้อง" });
    }

    // 1. ดึงข้อมูลจากทุกตารางพร้อมกัน
    const [activityReviews, hostReviews, comments] = await Promise.all([
      ActivityReview.findAll({ where: { activityId }, raw: true }),
      HostReview.findAll({ where: { activityId }, raw: true }),
      Comment.findAll({ where: { activityId }, raw: true }),
    ]);

    // 2. สร้าง Map สำหรับข้อมูล
    const activityReviewMap = new Map(activityReviews.map(r => [Number(r.reviewerId), r]));
    const hostReviewMap = new Map(hostReviews.map(r => [Number(r.reviewerId), r]));

    // แยก comment ตามประเภท
    const activityCommentMap = new Map();
    const hostCommentMap = new Map();
    comments.forEach(c => {
      if (c.commentType === 'activity') activityCommentMap.set(Number(c.userId), c);
      if (c.commentType === 'host') hostCommentMap.set(Number(c.userId), c);
    });

    // 3. หา User ทั้งหมดที่รีวิว (ไม่ว่าจะเป็นกิจกรรมหรือผู้จัด)
    const allReviewerIds = new Set([
      ...activityReviews.map(r => Number(r.reviewerId)),
      ...hostReviews.map(r => Number(r.reviewerId))
    ]);

    const result = Array.from(allReviewerIds).map(userId => {
      const actRev = activityReviewMap.get(userId);
      const hostRev = hostReviewMap.get(userId);
      const actComm = activityCommentMap.get(userId);
      const hostComm = hostCommentMap.get(userId);

      // ใช้ public status จาก comment ถ้ามี ถ้าไม่มีให้ถือว่า public
      const activityIsPublic = actComm ? actComm.isPublic : true;
      const hostIsPublic = hostComm ? hostComm.isPublic : true;

      return {
        id: userId,
        userId: userId,
        activityRating: actRev ? Number(actRev.rating) : null,
        hostRating: hostRev ? Number(hostRev.rating) : null,
        activityComment: actComm ? actComm.comment : "",
        hostComment: hostComm ? hostComm.comment : "",
        activityCommentId: actComm ? actComm.id : null,
        hostCommentId: hostComm ? hostComm.id : null,
        activityIsPublic: activityIsPublic,
        hostIsPublic: hostIsPublic,
        createdAt: actRev ? actRev.createdAt : (hostRev ? hostRev.createdAt : new Date()),
        reviewerId: userId
      };
    });

    // 4. ดึงข้อมูล User สำหรับทุกคน
    const finalUserIds = result.map(r => r.id);
    const users = await User.findAll({
      where: { id: { [Op.in]: finalUserIds } },
      attributes: ["id", "name", "username", "profileImage"],
      raw: true,
    });
    const userMap = new Map(users.map(u => [Number(u.id), u]));

    // 5. ใส่ข้อมูล User กลับเข้าไป
    const finalResult = result.map(item => ({
      ...item,
      user: userMap.get(item.id)
    }));

    res.json(finalResult);
  } catch (err) {
    console.error("Error in detailed-reviews:", err);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลรีวิว",
    });
  }
});

module.exports = router;