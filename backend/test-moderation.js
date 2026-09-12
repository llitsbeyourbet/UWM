const {
  analyzeText,
  analyzeFields,
} = require("./services/moderationService");

const samples = [
  "ไปวิ่งออกกำลังกายกันตอนเย็น",
  "กิจกรรมนี้แม่งสนุกมาก",
  "ค ว ย",
  "ค-ว-ย",
  "เดี๋ยวจะฆ่ามึง",
  "สมัครเว็บพนันเครดิตฟรี",
];

for (const text of samples) {
  console.log("\nข้อความ:", text);
  console.log(analyzeText(text));
}

console.log("\nหลายช่อง:");
console.log(
  analyzeFields({
    activityName: "วิ่งเพื่อสุขภาพ",
    detail: "มาร่วมออกกำลังกายและพบเพื่อนใหม่กัน",
  })
);
