export const CATEGORY_ICONS = {
  กีฬา: "⚽",
  เกม: "🎮",
  ดนตรี: "🎵",
  ภาพยนตร์: "🎬",
  อาหาร: "🍜",
  คาเฟ่: "☕",
  ศิลปะ: "🎨",
  ท่องเที่ยว: "✈️",
  เรียน: "📚",
  สุขภาพ: "🏃",
  จิตอาสา: "🌍",
};

export const getCategoryIcon = (category) =>
  CATEGORY_ICONS[category] || "🏷️";