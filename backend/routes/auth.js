const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const sequelize = require("../database");
const User = require("../models/User");
const OTP = require("../models/OTP");
const UserSession = require("../models/UserSession");
const Activity = require("../models/Activity");
const JoinRequest = require("../models/JoinRequest");
const HostReview = require("../models/HostReview");
const crypto = require("crypto");
const loginLimiter = require("../middleware/loginRateLimiter");
const Mailjet = require("node-mailjet");
const REGISTER_TOKEN_PREFIX = "register-token:";
const { wakeUpAI } = require("../services/aiModerationService");

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const hashRegistrationToken = (token) =>
  crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
const { auth } = require("../middleware/auth");

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
            <p>รหัส OTP สำหรับเปลี่ยนรหัสผ่านของคุณคือ</p>
            <h1 style="color:#4A6FFF;letter-spacing:8px;">${otp}</h1>
            <p>รหัสนี้จะหมดอายุใน 10 นาที</p>
          </div>
        `,
      },
    ],
  });
};

// เปลี่ยนรหัสผ่าน: ส่ง OTP (ต้อง Login)
router.post("/change-password/otp", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.destroy({ where: { email: user.email } });
    await OTP.create({ email: user.email, otp, expiredAt });

    await sendOTPEmail(user.email, otp, "Until We Meet — รหัส OTP สำหรับเปลี่ยนรหัสผ่าน");

    res.json({ message: "ส่ง OTP สำเร็จ กรุณาเช็คอีเมล" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// เปลี่ยนรหัสผ่าน: ยืนยัน OTP (ต้อง Login)
router.post("/change-password/verify-otp", auth, async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

    const otpRecord = await OTP.findOne({ where: { email: user.email, otp } });
    if (!otpRecord) return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    if (new Date() > otpRecord.expiredAt) return res.status(400).json({ message: "OTP หมดอายุแล้ว" });

    res.json({ verified: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

// เปลี่ยนรหัสผ่าน: อัปเดตรหัสผ่าน (ต้อง Login)
router.post("/change-password/update", auth, async (req, res) => {
  try {
    const { otp, newPassword, confirmPassword } = req.body;
    const user = await User.findByPk(req.userId);

    if (!user) return res.status(404).json({ message: "ไม่พบผู้ใช้งาน" });

    const otpRecord = await OTP.findOne({ where: { email: user.email, otp } });
    if (!otpRecord) return res.status(400).json({ message: "OTP ไม่ถูกต้อง" });
    if (new Date() > otpRecord.expiredAt) return res.status(400).json({ message: "OTP หมดอายุแล้ว" });

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "รหัสผ่านไม่ตรงกัน" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.update(
      { password: hashed, tokenVersion: (user.tokenVersion || 0) + 1 },
      { where: { id: user.id } }
    );
    await OTP.destroy({ where: { email: user.email } });

    res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

router.post("/check-register", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").replace(/\D/g, "");

    if (!username || !email || !phone) {
      return res.status(400).json({
        message: "กรุณากรอกชื่อผู้ใช้ อีเมล และเบอร์โทรศัพท์ให้ครบ",
      });
    }

    const [usernameExists, emailExists, phoneExists] = await Promise.all([
      User.findOne({ where: { username } }),
      User.findOne({ where: { email } }),
      User.findOne({ where: { phone } }),
    ]);

    if (usernameExists) {
      return res.status(409).json({
        field: "username",
        message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
      });
    }

    if (emailExists) {
      return res.status(409).json({
        field: "email",
        message: "อีเมลนี้ถูกใช้งานแล้ว",
      });
    }

    if (phoneExists) {
      return res.status(409).json({
        field: "phone",
        message: "เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว",
      });
    }

    return res.json({
      available: true,
      message: "ข้อมูลสามารถใช้งานได้",
    });
  } catch (error) {
    console.error("Check register error:", error);

    return res.status(500).json({
      message: "ไม่สามารถตรวจสอบข้อมูลได้",
    });
  }
});

router.post("/register", async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      username,
      name,
      email,
      password,
      phone,
      registrationToken,
    } = req.body;

    if (
      !username ||
      !name ||
      !email ||
      !phone ||
      !password
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: "กรุณากรอกข้อมูลให้ครบ",
      });
    }

    if (!registrationToken) {
      await transaction.rollback();

      return res.status(401).json({
        message:
          "กรุณายืนยัน OTP ก่อนสมัครสมาชิก",
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPhone =
      String(phone).replace(/\D/g, "");

    const usernameRegex =
      /^[A-Za-z0-9_]{3,20}$/;

    if (!usernameRegex.test(cleanUsername)) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "ชื่อผู้ใช้ต้องมี 3-20 ตัว และใช้ได้เฉพาะตัวอักษร ตัวเลข หรือ _",
      });
    }

    if (!/^0\d{9}$/.test(cleanPhone)) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก",
      });
    }

    if (password.length < 6) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
      });
    }

    // ตรวจ registration token ที่ได้จาก OTP
    const registrationTokenHash =
      hashRegistrationToken(
        String(registrationToken)
      );

    const otpRecord = await OTP.findOne({
      where: {
        email: cleanEmail,
        otp:
          `${REGISTER_TOKEN_PREFIX}${registrationTokenHash}`,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !otpRecord ||
      new Date() >
        new Date(otpRecord.expiredAt)
    ) {
      if (otpRecord) {
        await otpRecord.destroy({
          transaction,
        });

        await transaction.commit();
      } else {
        await transaction.rollback();
      }

      return res.status(401).json({
        message:
          "การยืนยัน OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอ OTP ใหม่",
      });
    }

    // เช็กข้อมูลซ้ำอีกครั้งก่อนสร้างจริง
    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { username: cleanUsername },
          { email: cleanEmail },
          { phone: cleanPhone },
        ],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existing) {
      await transaction.rollback();

      if (
        existing.username?.toLowerCase() ===
        cleanUsername.toLowerCase()
      ) {
        return res.status(400).json({
          message:
            "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
        });
      }

      if (
        existing.email?.toLowerCase() ===
        cleanEmail
      ) {
        return res.status(400).json({
          message:
            "อีเมลนี้ถูกใช้งานแล้ว",
        });
      }

      if (existing.phone === cleanPhone) {
        return res.status(400).json({
          message:
            "เบอร์โทรนี้ถูกใช้งานแล้ว",
        });
      }
    }

    const hashed = await bcrypt.hash(
      password,
      10
    );

    await User.create(
      {
        username: cleanUsername,
        name: name.trim(),
        email: cleanEmail,
        password: hashed,
        phone: cleanPhone,
      },
      {
        transaction,
      }
    );

    // registration token ใช้ได้ครั้งเดียว
    await otpRecord.destroy({
      transaction,
    });

    await transaction.commit();

    return res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
    });
  } catch (err) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    console.error("Register error:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    const MAX_LOGIN_ATTEMPTS = 5;
    const LOGIN_LOCK_MS = 30 * 1000;

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: email },
          { phone: email }
        ]
      }
    });

    if (!user) {
      return res.status(400).json({
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const now = new Date();

    // ถ้าบัญชียังถูกล็อกอยู่
    if (user.lockUntil && new Date(user.lockUntil) > now) {
      const remainingSeconds = Math.ceil(
        (new Date(user.lockUntil).getTime() - now.getTime()) / 1000
      );

      return res.status(429).json({
        message: `บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่อีกครั้งใน ${remainingSeconds} วินาที`,
        locked: true,
        retryAfter: remainingSeconds,
      });
    }

    // ถ้าครบเวลาล็อกแล้ว ให้เริ่มนับใหม่
    if (user.lockUntil && new Date(user.lockUntil) <= now) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    // กรอกรหัสผ่านผิด
    if (!isMatch) {
      const failedAttempts =
        (user.failedLoginAttempts || 0) + 1;

      // ผิดครบ 5 ครั้ง ล็อกบัญชี 30 วินาที
      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.failedLoginAttempts = 0;
        user.lockUntil = new Date(
          Date.now() + LOGIN_LOCK_MS
        );

        await user.save();

        return res.status(429).json({
          message:
            "กรอกรหัสผ่านผิดครบ 5 ครั้ง บัญชีถูกล็อกเป็นเวลา 30 วินาที",
          locked: true,
          retryAfter: 30,
        });
      }

      user.failedLoginAttempts = failedAttempts;
      await user.save();

      return res.status(400).json({
        message: `รหัสผ่านไม่ถูกต้อง เหลืออีก ${
          MAX_LOGIN_ATTEMPTS - failedAttempts
        } ครั้ง`,
      });
    }

    // ถ้า Login สำเร็จ รีเซ็ตจำนวนครั้งที่เคยกรอกรหัสผิด
    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // ถ้ามี session เดิม ให้เปลี่ยน sessionId ใหม่
    // เพื่อให้เครื่องเก่าหมดสิทธิ์ทันที
    const existingSession = await UserSession.findOne({
      where: {
        userId: user.id,
      },
    });

    const sessionId = crypto.randomUUID();

    const expiresAt = new Date(
      now.getTime() + 8 * 60 * 60 * 1000
    );

    if (existingSession) {
      await existingSession.update({
        sessionId,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
      });
    } else {
      await UserSession.create({
        userId: user.id,
        sessionId,
        lastSeenAt: now,
        expiresAt,
        revokedAt: null,
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        sessionId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    wakeUpAI();

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

router.post("/heartbeat", auth, async (req, res) => {
  try {
    const now = new Date();

    await req.session.update({
      lastSeenAt: now,
    });

    return res.json({ active: true, });
  } catch (error) {
    console.error("Session heartbeat error:", error);

    return res.status(500).json({
      message:
        "ไม่สามารถ update session ได้",
    });
  }
}
);

router.post("/logout", auth, async (req, res) => {
  try {
    await req.session.destroy();

    return res.json({ message: "ออกจากระบบสำเร็จ", });
  } catch (error) {
    console.error(
      "Logout session error:",
      error
    );

    return res.status(500).json({
      message:
        "ไม่สามารถออกจากระบบได้",
    });
  }
}
);
// ดึงข้อมูลหน้าโปรไฟล์ทั้งหมดใน request เดียว
router.get("/profile", auth, async (req, res) => {
  try {
    const userId = Number(req.userId);

    const [user, createdActivities, checkedInRequests, hostReviews] =
      await Promise.all([
        User.findByPk(userId, {
          attributes: { exclude: ["password"] },
          raw: true,
        }),

        Activity.findAll({
          where: { createdBy: userId },
          order: [["createdAt", "DESC"]],
          raw: true,
        }),

        JoinRequest.findAll({
          where: {
            userId,
            status: "checked_in",
          },
          attributes: ["activityId"],
          raw: true,
        }),

        HostReview.findAll({
          where: { hostId: userId },
          attributes: ["reviewerId", "rating"],
          raw: true,
        }),
      ]);

    if (!user) {
      return res.status(404).json({
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const activityIds = [
      ...new Set(
        checkedInRequests.map((request) => Number(request.activityId))
      ),
    ];

    const reviewerIds = [
      ...new Set(
        hostReviews.map((review) => Number(review.reviewerId))
      ),
    ];

    const [joinedActivities, existingReviewers] = await Promise.all([
      activityIds.length
        ? Activity.findAll({
            where: {
              id: { [Op.in]: activityIds },
            },
            raw: true,
          })
        : [],

      reviewerIds.length
        ? User.findAll({
            where: {
              id: { [Op.in]: reviewerIds },
            },
            attributes: ["id"],
            raw: true,
          })
        : [],
    ]);

    const existingReviewerIds = new Set(
      existingReviewers.map((reviewer) => Number(reviewer.id))
    );

    const validHostReviews = hostReviews.filter((review) =>
      existingReviewerIds.has(Number(review.reviewerId))
    );

    const hostRating = validHostReviews.length
      ? (
          validHostReviews.reduce(
            (sum, review) => sum + Number(review.rating),
            0
          ) / validHostReviews.length
        ).toFixed(1)
      : null;

    return res.json({
      user,
      createdActivities,
      joinedActivities,
      hostRating,
    });
  } catch (err) {
    console.error("GET PROFILE ERROR:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลโปรไฟล์",
    });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: { exclude: ["password"] }
    });

    if (!user) {
      return res.status(404).json({
        message: "ไม่พบผู้ใช้งาน"
      });
    }

    res.json(user);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "เกิดข้อผิดพลาด"
    });
  }
});

router.put("/update",auth, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "ไม่มี token",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const {
      username,
      name,
      phone,
      bio,
      profileImage,
    } = req.body;

    const cleanUsername = username?.trim();
    const cleanPhone = phone?.trim();
    if (!cleanPhone) {
      return res.status(400).json({
        message: "กรุณากรอกเบอร์โทร",
      });
    }

    const usernameRegex = /^[A-Za-z0-9_]{3,20}$/;
    const phoneRegex = /^0\d{9}$/;

    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        message: "กรุณากรอกเบอร์โทร 10 หลัก",
      });
    }

    if (!cleanUsername) {
      return res.status(400).json({
        message: "กรุณากรอกชื่อผู้ใช้",
      });
    }

    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({
        message:
          "ชื่อผู้ใช้ต้องมี 3-20 ตัว และใช้ได้เฉพาะตัวอักษร ตัวเลข หรือ _",
      });
    }

    const duplicateConditions = [
      {
        username: cleanUsername,
      },
    ];

    if (cleanPhone) {
      duplicateConditions.push({
        phone: cleanPhone,
      });
    }

    const existingUser = await User.findOne({
      where: {
        id: {
          [Op.ne]: decoded.id,
        },
        [Op.or]: duplicateConditions,
      },
    });

    if (existingUser) {
      if (
        existingUser.username?.toLowerCase() ===
        cleanUsername.toLowerCase()
      ) {
        return res.status(400).json({
          message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
        });
      }

      if (cleanPhone && existingUser.phone === cleanPhone) {
        return res.status(400).json({
          message: "เบอร์โทรนี้ถูกใช้งานแล้ว",
        });
      }
    }

    const updateData = {
      username: cleanUsername,
      name: name?.trim(),
      phone: cleanPhone || null,
      bio: bio || "",
    };

    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    await User.update(updateData, {
      where: {
        id: decoded.id,
      },
    });

    const updatedUser = await User.findByPk(decoded.id, {
      attributes: {
        exclude: ["password"],
      },
    });

    return res.json({
      message: "อัปเดตสำเร็จ",
      user: updatedUser,
    });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);

    return res.status(500).json({
      message: "เกิดข้อผิดพลาด",
    });
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
