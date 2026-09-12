// backend/config/inappropriateWords.js
// คลังคำสำหรับระบบวิเคราะห์ข้อความไม่เหมาะสม
// weight: 1-100 ยิ่งสูงยิ่งมีความเสี่ยงมาก
// match: "contains" = ตรวจเป็นส่วนหนึ่งของข้อความ, "word" = ตรวจเป็นคำภาษาอังกฤษ

module.exports = [
  // คำหยาบ
  { word: "แม่ง", category: "profanity", weight: 30, match: "contains" },
  { word: "สัส", category: "profanity", weight: 40, match: "contains" },
  { word: "เหี้ย", category: "profanity", weight: 45, match: "contains" },
  { word: "ควย", category: "profanity", weight: 55, match: "contains" },
  { word: "เย็ด", category: "profanity", weight: 55, match: "contains" },

  // ดูหมิ่น / ด่าทอ
  { word: "โง่", category: "insult", weight: 35, match: "contains" },
  { word: "ควาย", category: "insult", weight: 40, match: "contains" },
  { word: "ปัญญาอ่อน", category: "insult", weight: 55, match: "contains" },
  { word: "ไอ้เหี้ย", category: "insult", weight: 65, match: "contains" },
  { word: "อีเหี้ย", category: "insult", weight: 65, match: "contains" },

  // ข่มขู่ / คุกคาม
  { word: "ฆ่ามึง", category: "threat", weight: 95, match: "contains" },
  { word: "จะฆ่า", category: "threat", weight: 90, match: "contains" },
  { word: "ยิงมึง", category: "threat", weight: 95, match: "contains" },
  { word: "แทงมึง", category: "threat", weight: 95, match: "contains" },
  { word: "กระทืบ", category: "threat", weight: 80, match: "contains" },
  { word: "เผาบ้าน", category: "threat", weight: 90, match: "contains" },

  // เนื้อหาทางเพศที่ไม่เหมาะสม
  { word: "เอากัน", category: "sexual", weight: 55, match: "contains" },
  { word: "ข่มขืน", category: "sexual", weight: 95, match: "contains" },

  // สแปม / พนัน / หลอกให้คลิก
  { word: "เครดิตฟรี", category: "spam", weight: 40, match: "contains" },
  { word: "เว็บพนัน", category: "spam", weight: 55, match: "contains" },
  { word: "แทงบอลออนไลน์", category: "spam", weight: 55, match: "contains" },
  { word: "รับเครดิตฟรี", category: "spam", weight: 45, match: "contains" },
  { word: "คลิกลิงก์", category: "spam", weight: 30, match: "contains" },

  // ภาษาอังกฤษ
  { word: "fuck", category: "profanity", weight: 45, match: "word" },
  { word: "shit", category: "profanity", weight: 35, match: "word" },
  { word: "bitch", category: "insult", weight: 45, match: "word" },
  { word: "kill you", category: "threat", weight: 90, match: "contains" },
  { word: "rape", category: "sexual", weight: 95, match: "word" },
  { word: "casino", category: "spam", weight: 35, match: "word" },
];
