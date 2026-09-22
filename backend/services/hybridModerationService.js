// backend/services/hybridModerationService.js

const {
    analyzeText,
    analyzeFields,
} = require("./moderationService");

const {
    moderateWithAI,
} = require("./aiModerationService");

const AI_CATEGORY_LABELS = {
    profanity: "คำหยาบ",
    insult: "คำดูหมิ่นหรือด่าทอ",
    threat: "คำข่มขู่หรือคุกคาม",
    sexual: "เนื้อหาทางเพศที่ไม่เหมาะสม",
    spam: "สแปมหรือเนื้อหาเสี่ยง",
    alcohol: "เนื้อหาที่เกี่ยวข้องกับเครื่องดื่มมึนเมา",
    smoking: "เนื้อหาเกี่ยวกับการสูบบุหรี่หรือผลิตภัณฑ์ยาสูบ",
};

const hybridAnalyzeText = async (text) => {
    const ruleResult = analyzeText(text);

    if (ruleResult.status !== "safe") {
        return {
            ...ruleResult,
            decision: "block",
            source: "rule",
            ai: null,
        };
    }

    const aiResult = await moderateWithAI(text);

    if (aiResult.decision === "allow") {
        return {
            ...ruleResult,
            decision: "allow",
            source: "ai",
            ai: aiResult,
        };
    }

    return {
        status: "warning",
        riskScore: 0,
        categories: [aiResult.label],
        categoryLabels: [
            AI_CATEGORY_LABELS[aiResult.label] || aiResult.label,
        ],
        matchedWords: [],
        decision: "block",
        source: "ai",
        ai: aiResult,
    };
};

const hybridAnalyzeFields = async (fields = {}) => {
    const ruleResult = analyzeFields(fields);

    if (ruleResult.status !== "safe") {
        return {
            ...ruleResult,
            decision: "block",
            source: "rule",
            ai: null,
        };
    }

    const fieldResults = {};

    for (const [field, value] of Object.entries(fields)) {
        const text = String(value || "").trim();

        if (!text) continue;

        // location ตรวจด้วย Rule ด้านบนแล้ว แต่ไม่ส่งเข้า AI
        if (field === "location") {
            continue;
        }

        const aiResult = await moderateWithAI(text);

        console.log(
            `[AI MODERATION] field=${field} text="${text}" label=${aiResult.label} confidence=${aiResult.confidence} decision=${aiResult.decision}`
        );

        fieldResults[field] = aiResult;

        if (aiResult.decision === "block") {
            return {
                status: "warning",
                riskScore: 0,
                categories: [aiResult.label],
                categoryLabels: [
                    AI_CATEGORY_LABELS[aiResult.label] || aiResult.label,
                ],
                matchedWords: [],
                fields: ruleResult.fields,
                decision: "block",
                source: "ai",
                ai: {
                    field,
                    ...aiResult,
                },
            };
        }
    }

    return {
        ...ruleResult,
        decision: "allow",
        source: "ai",
        ai: fieldResults,
    };
};

module.exports = {
    hybridAnalyzeText,
    hybridAnalyzeFields,
};