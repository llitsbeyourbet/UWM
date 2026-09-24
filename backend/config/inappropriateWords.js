// backend/config/inappropriateWords.js
// คลังคำสำหรับระบบวิเคราะห์ข้อความไม่เหมาะสม
// เก็บเฉพาะคำ/วลีที่มีความชัดเจนสูง
// ข้อความที่ต้องพิจารณาบริบทให้ AI เป็นผู้วิเคราะห์

module.exports = [
  // คำหยาบที่มีความชัดเจนสูง
  { word: "สัส", category: "profanity", weight: 40, match: "contains" },
  { word: "เหี้ย", category: "profanity", weight: 45, match: "contains" },
  { word: "ควย", category: "profanity", weight: 55, match: "contains" },
  { word: "เย็ด", category: "profanity", weight: 55, match: "contains" },
  { word: "ชิบหาย", category: "profanity", weight: 55, match: "contains" },

  // ดูหมิ่น / ด่าทอที่มีความชัดเจนสูง
  // ดูหมิ่น / ด่าทอที่มีความชัดเจนสูง

  { word: "ปัญญาอ่อน", category: "insult", weight: 55, match: "contains" },
  { word: "ไอ้เหี้ย", category: "insult", weight: 65, match: "contains" },
  { word: "อีเหี้ย", category: "insult", weight: 65, match: "contains" },

  { word: "มึงโง่", category: "insult", weight: 55, match: "contains" },
  { word: "แกโง่", category: "insult", weight: 55, match: "contains" },
  { word: "ไอ้โง่", category: "insult", weight: 55, match: "contains" },

  // ข่มขู่ / คุกคาม
  // V5 ไม่มี threat class จึงให้ Rule ป้องกันวลีรุนแรงที่ชัดเจน
  { word: "ฆ่ามึง", category: "threat", weight: 95, match: "contains" },
  { word: "จะฆ่า", category: "threat", weight: 90, match: "contains" },
  { word: "ยิงมึง", category: "threat", weight: 95, match: "contains" },
  { word: "แทงมึง", category: "threat", weight: 95, match: "contains" },
  { word: "เผาบ้าน", category: "threat", weight: 90, match: "contains" },
  { word: "กระทืบ", category: "threat", weight: 90, match: "contains" },

  // เนื้อหาทางเพศที่มีความชัดเจนสูง
  // เนื้อหาทางเพศที่มีความชัดเจนสูง

  { word: "ข่มขืน", category: "sexual", weight: 95, match: "contains" },
  { word: "มีเซ็กซ์", category: "sexual", weight: 55, match: "contains" },

  { word: "มาเอากัน", category: "sexual", weight: 65, match: "contains" },
  { word: "เอากันไหม", category: "sexual", weight: 65, match: "contains" },
  { word: "เอากันมั้ย", category: "sexual", weight: 65, match: "contains" },
  { word: "อยากโดนเอา", category: "sexual", weight: 70, match: "contains" },

  // สแปม / พนัน
  { word: "เครดิตฟรี", category: "spam", weight: 40, match: "contains" },
  { word: "เว็บพนัน", category: "spam", weight: 55, match: "contains" },
  { word: "แทงบอลออนไลน์", category: "spam", weight: 55, match: "contains" },
  { word: "รับเครดิตฟรี", category: "spam", weight: 45, match: "contains" },

  // ภาษาอังกฤษ
  { word: "fuck", category: "profanity", weight: 45, match: "word" },
  { word: "shit", category: "profanity", weight: 35, match: "word" },
  { word: "bitch", category: "insult", weight: 45, match: "word" },
  { word: "kill you", category: "threat", weight: 90, match: "contains" },
  { word: "rape", category: "sexual", weight: 95, match: "word" },
  { word: "casino", category: "spam", weight: 35, match: "word" },
];