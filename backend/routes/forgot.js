const express = require("express");
const router = express.Router();
const Mailjet = require("node-mailjet");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP");

const mailjet = Mailjet.connect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

const sendOTPEmail = async (email, otp, subject) => {
  await mailjet.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: {
          Email: process.env.MJ_SENDER_EMAIL,
          Name: "Until We Meet",
        },
        To: [{ Email: email }],
        Subject: subject,
        HTMLPart: `
          <div style="font-family:sans-serif;padding:20px;">
            <h2>Until We Meet</h2>
            <p>รหัส OTP ของคุณคือ</p>
            <h1 style="color:#4A6FFF;letter-spacing:8px;">${otp}</h1>
            <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
          </div>
        `,
      },
    ],
  });
};

// ส่ง OTP สำหรับลืมรหัสผ่าน
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(404).json({ message: "ไม่พบอีเมลนี้ในระบบ" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.destroy({ where: { email } });
    await OTP.create({ email, otp, expiredAt });

    await sendOTPEmail(email, otp, "Until We Meet — รหัส OTP สำหรับรีเซ็ตรหัสผ่าน");

    res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ส่ง OTP สำหรับสมัครสมาชิก
router.post("/send-otp-register", async (req, res) => {
  try {
    const { email } = req.body;

    // เช็คว่าอีเมลถูกใช้แล้วไหม
    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "อีเมลนี้ถูกใช้แล้ว" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.destroy({ where: { email } });
    await OTP.create({ email, otp, expiredAt });

    await sendOTPEmail(email, otp, "Until We Meet — รหัส OTP สำหรับสมัครสมาชิก");

    res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยืนยัน OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await OTP.findOne({ where: { email, otp } });
    if (!otpRecord)
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });

    if (new Date() > otpRecord.expiredAt)
      return res.status(400).json({ message: "OTP หมดอายุแล้ว" });

    res.json({ message: "OTP ถูกต้อง" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// รีเซ็ตรหัสผ่าน
router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashed }, { where: { email } });

    res.json({ message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;