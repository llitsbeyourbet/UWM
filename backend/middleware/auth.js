const jwt = require("jsonwebtoken");

const User = require("../models/User");
const UserSession = require("../models/UserSession");

const SESSION_IDLE_TIMEOUT = 60 * 60 * 1000; // ชั่วคราว 2 นาที

const auth = async (req, res, next) => {
  const token =
    req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "ไม่มี token",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    if (!decoded.sessionId) {
      return res.status(401).json({
        message: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
      });
    }

    const session = await UserSession.findOne({
      where: {
        userId: user.id,
        sessionId: decoded.sessionId,
      },
    });

    if (!session) {
      return res.status(401).json({
        message: "เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่",
      });
    }

    if (session.revokedAt) {
      return res.status(401).json({
        message: "เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่",
      });
    }

    const now = new Date();

    if (now >= new Date(session.expiresAt)) {
      await session.update({
        revokedAt: now,
      });

      return res.status(401).json({
        message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
      });
    }

    const lastSeen =
      new Date(session.lastSeenAt).getTime();

    if (
      now.getTime() - lastSeen >
      SESSION_IDLE_TIMEOUT
    ) {
      await session.update({
        revokedAt: now,
      });

      return res.status(401).json({
        message: "ไม่มีการใช้งานเป็นเวลานาน กรุณาเข้าสู่ระบบใหม่",
      });
    }

    req.userId = user.id;
    req.role = user.role;
    req.sessionId = session.sessionId;
    req.session = session;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token ไม่ถูกต้องหรือหมดอายุ",
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return res.status(403).json({
      message: "ไม่มีสิทธิ์เข้าถึง",
    });
  }

  next();
};

module.exports = {auth,isAdmin,};