// backend/services/aiModerationService.js

const AI_MODERATION_URL =
  process.env.AI_MODERATION_URL || "http://127.0.0.1:5001";

const ALLOW_LABELS = new Set(["safe", "alcohol"]);

const moderateWithAI = async (text) => {
  const value = String(text || "").trim();

  if (!value) {
    return {
      label: "safe",
      confidence: 1,
      decision: "allow",
    };
  }

  let response;

  try {
    response = await fetch(`${AI_MODERATION_URL}/moderate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        text: value,
      }),
    });
  } catch (error) {
    const serviceError = new Error("AI moderation service unavailable");
    serviceError.code = "AI_MODERATION_UNAVAILABLE";
    throw serviceError;
  }

  if (!response.ok) {
    const serviceError = new Error("AI moderation service returned an error");
    serviceError.code = "AI_MODERATION_UNAVAILABLE";
    throw serviceError;
  }

  const result = await response.json();

  const label = String(result.label || "").toLowerCase();
  const confidence = Number(result.confidence) || 0;

  if (!label) {
    const serviceError = new Error("Invalid AI moderation response");
    serviceError.code = "AI_MODERATION_UNAVAILABLE";
    throw serviceError;
  }

  return {
    label,
    confidence,
    decision: ALLOW_LABELS.has(label) ? "allow" : "block",
  };
};

module.exports = {
  moderateWithAI,
};