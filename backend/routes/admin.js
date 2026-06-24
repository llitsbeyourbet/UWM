const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Report = require("../models/Report");
const JoinRequest = require("../models/JoinRequest");

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "ไม่มี token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.role = decoded.role;
    next();
  } catch {
    res.status(401).json({ message: "token ไม่ถูกต้อง" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.role !== "admin")
    return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึง" });
  next();
};

// Dashboard สถิติ
router.get("/dashboard", auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalActivities = await Activity.count();
    const totalReports = await Report.count();
    const pendingReports = await Report.count({ where: { status: "pending" } });
    const suspendedActivities = await Activity.count({ where: { status: "suspended" } });
    const totalCheckins = await JoinRequest.count({ where: { status: "checked_in" } });

    res.json({
      totalUsers,
      totalActivities,
      totalReports,
      pendingReports,
      suspendedActivities,
      totalCheckins,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึงรายงานทั้งหมด
router.get("/reports", auth, isAdmin, async (req, res) => {
  try {
    const reports = await Report.findAll({
      order: [["createdAt", "DESC"]],
    });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ระงับกิจกรรม
router.put("/suspend/:activityId", auth, isAdmin, async (req, res) => {
  try {
    await Activity.update(
      { status: "suspended" },
      { where: { id: req.params.activityId } }
    );
    await Report.update(
      { status: "reviewed" },
      { where: { activityId: req.params.activityId } }
    );
    res.json({ message: "ระงับกิจกรรมสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยกเลิกการระงับ
router.put("/unsuspend/:activityId", auth, isAdmin, async (req, res) => {
  try {
    await Activity.update(
      { status: "active" },
      { where: { id: req.params.activityId } }
    );
    res.json({ message: "ยกเลิกการระงับสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ดึง user ทั้งหมด
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;