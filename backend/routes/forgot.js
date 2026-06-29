const express = require("express");
const router = express.Router();
const SibApiV3Sdk = require("sib-api-v3-sdk");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP");

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

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

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = "Until We Meet — รหัส OTP สำหรับรีเซ็ตรหัสผ่าน";
    sendSmtpEmail.htmlContent = `
      <div style="font-family:sans-serif;padding:20px;">
        <h2>รีเซ็ตรหัสผ่าน</h2>
        <p>รหัส OTP ของคุณคือ</p>
        <h1 style="color:#4A6FFF;letter-spacing:8px;">${otp}</h1>
        <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
      </div>
    `;
    sendSmtpEmail.sender = { name: "Until We Meet", email: process.env.BREVO_EMAIL };
    sendSmtpEmail.to = [{ email: email }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

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