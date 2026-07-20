const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/User");
const loginLimiter = require("../middleware/loginRateLimiter");

router.post("/register", async (req, res) => {
  try {
    const { username, name, email, password, phone, birthdate } = req.body;
    if (!username || !name || !email || !password)
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email นี้ถูกใช้แล้ว" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, name, email, password: hashed, phone, birthdate });

    res.status(201).json({ message: "สมัครสมาชิกสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: email },
          { phone: email }
        ]
      }
    });

    if (!user)
      return res.status(400).json({ message: "ไม่พบผู้ใช้งาน" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "รหัสผ่านไม่ถูกต้อง" });

    // 👈 เพิ่ม role ใน token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 👈 เพิ่ม role ใน response
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    console.error("ERROR MESSAGE:", err.message);
    console.error("ERROR STACK:", err.stack);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
      error: err.message
    });
  }

});

router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "ไม่มี token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ["password"] }
    });

    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

    res.json(user);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.put("/update", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "ไม่มี token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { username, name, phone, birthdate, bio, profileImage } = req.body;

    const updateData = { username, name, phone, birthdate, bio };
    if (profileImage) updateData.profileImage = profileImage;

    await User.update(updateData, { where: { id: decoded.id } });

    res.json({ message: "อัปเดตสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] }
    });
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;