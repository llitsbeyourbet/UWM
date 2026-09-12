// backend/services/moderationService.js
const inappropriateWords = require("../config/inappropriateWords");

const CATEGORY_LABELS = {
  profanity: "คำหยาบ",
  insult: "คำดูหมิ่นหรือด่าทอ",
  threat: "คำข่มขู่หรือคุกคาม",
  sexual: "เนื้อหาทางเพศที่ไม่เหมาะสม",
  spam: "สแปมหรือเนื้อหาเสี่ยง",
};

const normalizeText = (value) => {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
};

const compactText = (value) => {
  return normalizeText(value).replace(
    /[\s\-_.•*~`!@#$%^&()+=|\\/:;"'<>?,{}\[\]]+/gu,
    ""
  );
};

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const entryMatches = (normalized, compact, entry) => {
  const normalizedWord = normalizeText(entry.word);
  if (!normalizedWord) return false;

  if (entry.match === "word") {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${escapeRegExp(normalizedWord)}([^a-z0-9]|$)`,
      "iu"
    );
    return pattern.test(normalized);
  }

  if (normalized.includes(normalizedWord)) return true;

  // รองรับการเขียนหลบ เช่น ค ว ย, ค-ว-ย, ค...ว...ย
  // จำกัดคำตั้งแต่ 3 ตัวอักษรขึ้นไปเพื่อลด false positive
  const compactWord = compactText(normalizedWord);
  return compactWord.length >= 3 && compact.includes(compactWord);
};

const calculateRiskScore = (matches) => {
  if (!matches.length) return 0;

  const weights = matches
    .map((item) => Number(item.weight) || 0)
    .sort((a, b) => b - a);

  const strongest = weights[0];
  const additional = weights
    .slice(1)
    .reduce((sum, weight) => sum + weight * 0.35, 0);

  return Math.min(100, Math.round(strongest + additional));
};

const getStatus = (riskScore) => {
  if (riskScore >= 70) return "danger";
  if (riskScore >= 30) return "warning";
  return "safe";
};

const analyzeText = (text) => {
  const normalized = normalizeText(text);
  const compact = compactText(text);

  if (!normalized) {
    return {
      status: "safe",
      riskScore: 0,
      categories: [],
      categoryLabels: [],
      matchedWords: [],
    };
  }

  const found = new Map();

  for (const entry of inappropriateWords) {
    if (!entryMatches(normalized, compact, entry)) continue;

    const key = `${entry.category}:${normalizeText(entry.word)}`;
    const previous = found.get(key);

    if (!previous || entry.weight > previous.weight) {
      found.set(key, {
        word: entry.word,
        category: entry.category,
        weight: entry.weight,
      });
    }
  }

  const matches = [...found.values()];
  const riskScore = calculateRiskScore(matches);
  const status = getStatus(riskScore);
  const categories = [...new Set(matches.map((item) => item.category))];

  return {
    status,
    riskScore,
    categories,
    categoryLabels: categories.map(
      (category) => CATEGORY_LABELS[category] || category
    ),
    matchedWords: [...new Set(matches.map((item) => item.word))],
  };
};

const analyzeFields = (fields = {}) => {
  const results = {};
  const combinedMatches = [];

  for (const [field, value] of Object.entries(fields)) {
    const result = analyzeText(value);
    results[field] = result;

    for (const word of result.matchedWords) {
      const candidates = inappropriateWords.filter(
        (item) => normalizeText(item.word) === normalizeText(word)
      );

      for (const item of candidates) {
        combinedMatches.push({
          field,
          word: item.word,
          category: item.category,
          weight: item.weight,
        });
      }
    }
  }

  const unique = new Map();
  for (const item of combinedMatches) {
    const key = `${item.category}:${normalizeText(item.word)}`;
    const previous = unique.get(key);
    if (!previous || item.weight > previous.weight) unique.set(key, item);
  }

  const matches = [...unique.values()];
  const riskScore = calculateRiskScore(matches);
  const status = getStatus(riskScore);
  const categories = [...new Set(matches.map((item) => item.category))];

  return {
    status,
    riskScore,
    categories,
    categoryLabels: categories.map(
      (category) => CATEGORY_LABELS[category] || category
    ),
    matchedWords: [...new Set(matches.map((item) => item.word))],
    fields: results,
  };
};

const getModerationMessage = (result) => {
  if (!result || result.status === "safe") return "";

  const categoryText = result.categoryLabels?.length
    ? ` (${result.categoryLabels.join(", ")})`
    : "";

  if (result.status === "danger") {
    return `ตรวจพบข้อความที่ไม่เหมาะสมในระดับรุนแรง${categoryText} กรุณาแก้ไขข้อความก่อนดำเนินการ`;
  }

  return `ตรวจพบข้อความที่อาจไม่เหมาะสม${categoryText} กรุณาตรวจสอบข้อความก่อนดำเนินการ`;
};

const buildModerationResponse = (result) => ({
  moderation: {
    status: result.status,
    riskScore: result.riskScore,
    categories: result.categories,
    categoryLabels: result.categoryLabels,
    matchedWords: result.matchedWords,
  },
});

module.exports = {
  normalizeText,
  analyzeText,
  analyzeFields,
  getModerationMessage,
  buildModerationResponse,
};
