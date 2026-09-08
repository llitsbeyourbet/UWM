const express = require("express");
const router = express.Router();
const Mailjet = require("node-mailjet");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const sequelize = require("../database");
const User = require("../models/User");
const OTP = require("../models/OTP");
const UserSession = require("../models/UserSession");

const mailjet = Mailjet.connect(
  process.env.MJ_APIKEY_PUBLIC,
  process.env.MJ_APIKEY_PRIVATE
);

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_PREFIX = "reset:";
const REGISTER_OTP_PREFIX = "register:";
const REGISTER_TOKEN_PREFIX = "register-token:";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const sendOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "ส่ง OTP บ่อยเกินไป กรุณาลองใหม่ภายหลัง",
  },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "ยืนยัน OTP หลายครั้งเกินไป กรุณาลองใหม่ภายหลัง",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "มีการพยายามรีเซ็ตรหัสผ่านหลายครั้ง กรุณาลองใหม่ภายหลัง",
  },
});

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
router.post("/send-otp", sendOtpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: "กรุณากรอกอีเมล" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "ไม่พบอีเมลนี้ในระบบ" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + OTP_TTL_MS);

    await OTP.destroy({ where: { email } });
    await OTP.create({ email, otp, expiredAt });

    await sendOTPEmail(email, otp, "Until We Meet — รหัส OTP สำหรับรีเซ็ตรหัสผ่าน");

    return res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.error("Forgot password send OTP error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ส่ง OTP สำหรับสมัครสมาชิก
router.post("/send-otp-register", sendOtpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: "กรุณากรอกอีเมล" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "อีเมลนี้ถูกใช้แล้ว" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + OTP_TTL_MS);

    await OTP.destroy({ where: { email } });
    await OTP.create({ email, otp: `${REGISTER_OTP_PREFIX}${otp}`, expiredAt });

    await sendOTPEmail(email, otp, "Until We Meet — รหัส OTP สำหรับสมัครสมาชิก");

    return res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.error("Register send OTP error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยืนยัน OTP สำหรับสมัครสมาชิก
// เมื่อผ่านแล้ว OTP จะถูก consume และเปลี่ยนเป็น registration token แบบใช้ครั้งเดียว
router.post("/verify-otp-register", verifyOtpLimiter, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      await transaction.rollback();
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    }

    const otpRecord = await OTP.findOne({
      where: { email, otp: `${REGISTER_OTP_PREFIX}${otp}` },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!otpRecord) {
      await transaction.rollback();
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    }

    if (new Date() > new Date(otpRecord.expiredAt)) {
      await otpRecord.destroy({ transaction });
      await transaction.commit();
      return res.status(400).json({ message: "OTP หมดอายุแล้ว" });
    }

    const registrationToken = crypto.randomBytes(32).toString("hex");
    const registrationTokenHash = hashResetToken(registrationToken);

    await otpRecord.update(
      {
        otp: `${REGISTER_TOKEN_PREFIX}${registrationTokenHash}`,
        expiredAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
      { transaction }
    );

    await transaction.commit();

    return res.json({
      message: "OTP ถูกต้อง",
      registrationToken,
    });
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Register verify OTP error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// ยืนยัน OTP สำหรับลืมรหัสผ่าน
// เมื่อผ่านแล้ว OTP จะถูก consume และเปลี่ยนเป็น reset token แบบใช้ครั้งเดียว
router.post("/verify-otp", verifyOtpLimiter, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !/^\d{6}$/.test(otp)) {
      await transaction.rollback();
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    }

    const otpRecord = await OTP.findOne({
      where: { email, otp },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!otpRecord) {
      await transaction.rollback();
      return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    }

    if (new Date() > new Date(otpRecord.expiredAt)) {
      await otpRecord.destroy({ transaction });
      await transaction.commit();
      return res.status(400).json({ message: "OTP หมดอายุแล้ว" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = hashResetToken(resetToken);

    await otpRecord.update(
      {
        otp: `${RESET_TOKEN_PREFIX}${resetTokenHash}`,
        expiredAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
      { transaction }
    );

    await transaction.commit();

    return res.json({
      message: "OTP ถูกต้อง",
      resetToken,
    });
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Forgot password verify OTP error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// รีเซ็ตรหัสผ่าน ต้องใช้ reset token ที่ได้จากการยืนยัน OTP เท่านั้น
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const email = normalizeEmail(req.body.email);
    const resetToken = String(req.body.resetToken || "");
    const newPassword = String(req.body.newPassword || "");
    const confirmPassword = String(req.body.confirmPassword || "");

    if (!email || !resetToken) {
      await transaction.rollback();
      return res.status(401).json({
        message: "การยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง กรุณาขอ OTP ใหม่",
      });
    }

    if (newPassword.length < 6) {
      await transaction.rollback();
      return res.status(400).json({
        message: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
    }

    if (newPassword !== confirmPassword) {
      await transaction.rollback();
      return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
    }

    const resetTokenHash = hashResetToken(resetToken);
    const otpRecord = await OTP.findOne({
      where: {
        email,
        otp: `${RESET_TOKEN_PREFIX}${resetTokenHash}`,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!otpRecord || new Date() > new Date(otpRecord.expiredAt)) {
      if (otpRecord) {
        await otpRecord.destroy({ transaction });
        await transaction.commit();
      } else {
        await transaction.rollback();
      }

      return res.status(401).json({
        message: "การยืนยันตัวตนหมดอายุหรือไม่ถูกต้อง กรุณาขอ OTP ใหม่",
      });
    }

    const user = await User.findOne({
      where: { email },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!user) {
      await otpRecord.destroy({ transaction });
      await transaction.commit();
      return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await user.update({ password: hashed }, { transaction });

    // หลัง reset password ให้ session เก่าทั้งหมดใช้ต่อไม่ได้ทันที
    await UserSession.destroy({
      where: { userId: user.id },
      transaction,
    });

    // reset token ใช้ได้ครั้งเดียว
    await otpRecord.destroy({ transaction });

    await transaction.commit();

    return res.json({ message: "รีเซ็ตรหัสผ่านสำเร็จ" });
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error("Forgot password reset error:", err);
    return res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

module.exports = router;
