// backend/services/hybridModerationService.js

const { analyzeText, analyzeFields } = require("./moderationService");
const { moderateWithAI } = require("./aiModerationService");

const AI_CATEGORY_LABELS = {
  profanity: "คำหยาบ",
  insult: "คำดูหมิ่นหรือด่าทอ",
  sexual: "เนื้อหาทางเพศที่ไม่เหมาะสม",
  spam: "สแปมหรือเนื้อหาเสี่ยง",
};

const hasMeaningfulText = (text) =>
  /[\p{L}\p{N}]/u.test(String(text || ""));

const getCategoryLabel = (label) =>
  AI_CATEGORY_LABELS[label] || label;

// ตรวจข้อความเดียว
const hybridAnalyzeText = async (text) => {
  const ruleResult = analyzeText(text);

  if (ruleResult.status !== "safe") {
    return {
      ...ruleResult,
      decision: "block",
      source: "rule",
      ai: null,
      aiFlags: [],
    };
  }

  if (!hasMeaningfulText(text)) {
    return {
      ...ruleResult,
      decision: "allow",
      source: "rule",
      ai: null,
      aiFlags: [],
    };
  }

  const aiResult = await moderateWithAI(text);

  if (aiResult.decision === "allow") {
    return {
      ...ruleResult,
      decision: "allow",
      source: "ai",
      ai: aiResult,
      aiFlags: [],
    };
  }

  return {
    status: "warning",
    riskScore: 0,
    categories: [aiResult.label],
    categoryLabels: [getCategoryLabel(aiResult.label)],
    matchedWords: [],
    decision: "block",
    source: "ai",
    ai: aiResult,
    aiFlags: [aiResult],
  };
};

// ตรวจหลาย field
const hybridAnalyzeFields = async (fields = {}) => {
  const ruleResult = analyzeFields(fields);

  if (ruleResult.status !== "safe") {
    return {
      ...ruleResult,
      decision: "block",
      source: "rule",
      ai: null,
      aiFlags: [],
    };
  }

  const fieldResults = {};
  const aiFlags = [];

  for (const [field, value] of Object.entries(fields)) {
    const text = String(value || "").trim();

    // location ตรวจเฉพาะ Rule-based
    if (
      !text ||
      field === "location" ||
      !hasMeaningfulText(text)
    ) {
      continue;
    }

    const aiResult = await moderateWithAI(text);

    console.log(
      `[AI MODERATION] field=${field} label=${aiResult.label} confidence=${aiResult.confidence} decision=${aiResult.decision}`
    );

    fieldResults[field] = aiResult;

    if (aiResult.decision === "block") {
      aiFlags.push({
        field,
        ...aiResult,
      });
    }
  }

  // AI ตรวจพบอย่างน้อย 1 field
  if (aiFlags.length > 0) {
    const categories = [
      ...new Set(aiFlags.map((flag) => flag.label)),
    ];

    return {
      status: "warning",
      riskScore: 0,
      categories,
      categoryLabels: categories.map(getCategoryLabel),
      matchedWords: [],
      fields: ruleResult.fields,
      decision: "block",
      source: "ai",
      ai: fieldResults,
      aiFlags,
    };
  }

  return {
    ...ruleResult,
    decision: "allow",
    source: "ai",
    ai: fieldResults,
    aiFlags: [],
  };
};

module.exports = {
  hybridAnalyzeText,
  hybridAnalyzeFields,
};