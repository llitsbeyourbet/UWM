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

const getProcessingTime = (startTime) =>
  Number((performance.now() - startTime).toFixed(2));

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
      processingTimeMs: null,
    };
  }

  if (!hasMeaningfulText(text)) {
    return {
      ...ruleResult,
      decision: "allow",
      source: "rule",
      ai: null,
      aiFlags: [],
      processingTimeMs: null,
    };
  }

  const startTime = performance.now();
  const aiResult = await moderateWithAI(text);

  if (aiResult.decision === "allow") {
    return {
      ...ruleResult,
      decision: "allow",
      source: "ai",
      ai: aiResult,
      aiFlags: [],
      processingTimeMs: getProcessingTime(startTime),
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
    processingTimeMs: getProcessingTime(startTime),
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
      processingTimeMs: null,
    };
  }

  const fieldResults = {};
  const aiFlags = [];
  let aiProcessingTimeMs = 0;

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

    const aiStartTime = performance.now();
    const aiResult = await moderateWithAI(text);
    aiProcessingTimeMs += performance.now() - aiStartTime;

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

  const processingTimeMs =
    Object.keys(fieldResults).length > 0
      ? Number(aiProcessingTimeMs.toFixed(2))
      : null;

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
      processingTimeMs,
    };
  }

  return {
    ...ruleResult,
    decision: "allow",
    source: "ai",
    ai: fieldResults,
    aiFlags: [],
    processingTimeMs,
  };
};

module.exports = {
  hybridAnalyzeText,
  hybridAnalyzeFields,
};