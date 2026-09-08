const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 วินาที
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        message: "มีการพยายามเข้าสู่ระบบหลายครั้ง กรุณาลองใหม่อีกครั้งในภายหลัง"
    }
});
console.log("loginRateLimiter loaded");
module.exports = loginLimiter;