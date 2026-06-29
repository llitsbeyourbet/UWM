const express = require("express");
const router = express.Router();
const { Resend } = require("resend"); // 👈 เปลี่ยนเป็น Resend
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP");

const resend = new Resend(process.env.RESEND_API_KEY); // 👈 เปลี่ยน

// ส่ง OTP ไปที่อีเมล
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

    // 👈 เปลี่ยนมาใช้ Resend
    const result = await resend.emails.send({
      from: "UWM <onboarding@resend.dev>",
      to: email,
      subject: "Until We Meet — รหัส OTP สำหรับรีเซ็ตรหัสผ่าน",
      html: `
        <div style="font-family:sans-serif;padding:20px;">
          <h2>รีเซ็ตรหัสผ่าน</h2>
          <p>รหัส OTP ของคุณคือ</p>
          <h1 style="color:#4A6FFF;letter-spacing:8px;">${otp}</h1>
          <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
        </div>
      `,
    });
    console.log("Resend result:", JSON.stringify(result)); // 👈 เพิ่มบรรทัดนี้

    res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยืนยัน OTP และรีเซ็ตรหัสผ่าน
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const otpRecord = await OTP.findOne({ where: { email, otp } });
    if (!otpRecord)
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });

    if (new Date() > otpRecord.expiredAt)
      return res.status(400).json({ message: "OTP หมดอายุแล้ว" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.update({ password: hashed }, { where: { email } });

    await OTP.destroy({ where: { email } });

    res.json({ message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;