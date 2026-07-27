const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const User = require("../models/User");
const loginLimiter = require("../middleware/loginRateLimiter");

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
  try {
    const { username, name, email, password, phone, birthdate } = req.body;
    if (!username || !name || !email || !phone || !birthdate || !password)
      return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบ" });

    const cleanUsername = username?.trim();
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    // อนุญาตเฉพาะตัวอักษรภาษาอังกฤษและตัวเลข
    const usernameRegex = /^[A-Za-z0-9]+$/;

    if (!usernameRegex.test(cleanUsername || "")) {
      return res.status(400).json({
        message:
          "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลขเท่านั้น",
      });
    }

    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { username: cleanUsername },
          { email: cleanEmail },
          { phone: cleanPhone },
        ],
      },
    });

    if (existing) {
      if (
        existing.username.toLowerCase() ===
        cleanUsername.toLowerCase()
      ) {
        return res.status(400).json({
          message: "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
        });
      }

      if (
        existing.email.toLowerCase() ===
        cleanEmail.toLowerCase()
      ) {
        return res.status(400).json({
          message: "อีเมลนี้ถูกใช้งานแล้ว",
        });
      }

      if (existing.phone === cleanPhone) {
        return res.status(400).json({
          message: "เบอร์โทรนี้ถูกใช้งานแล้ว",
        });
      }
    }
    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      username: cleanUsername,
      name: name.trim(),
      email: cleanEmail,
      password: hashed,
      phone: cleanPhone,
      birthdate,
    });

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
      birthdate,
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

    const usernameRegex = /^[A-Za-z0-9]+$/;
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
          "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลขเท่านั้น",
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
      birthdate: birthdate || null,
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