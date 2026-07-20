const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 นาที
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        message: "มีการพยายามเข้าสู่ระบบหลายครั้ง กรุณาลองใหม่อีกครั้งในภายหลัง"
    }
});

module.exports = loginLimiter;