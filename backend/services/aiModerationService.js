// backend/services/aiModerationService.js

const AI_MODERATION_URL =
  process.env.AI_MODERATION_URL || "http://127.0.0.1:5001";

// V5 อนุญาตเฉพาะ safe
const ALLOW_LABELS = new Set(["safe"]);

const MAX_RETRIES = 2;
const REQUEST_TIMEOUT = 65000;
const RETRY_DELAY = 3000;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchModeration = async (value) => {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    return await fetch(`${AI_MODERATION_URL}/moderate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        text: value,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const wakeUpAI = async () => {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(
      `${AI_MODERATION_URL}/health`,
      {
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `AI health returned status ${response.status}`
      );
    }

    console.log("[AI MODERATION] AI service is awake");

    return true;
  } catch (error) {
    console.warn(
      "[AI MODERATION] AI wake-up failed:",
      error.message
    );

    return false;
  } finally {
    clearTimeout(timeout);
  }
};

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
  let lastError;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      response = await fetchModeration(value);

      if (response.ok) {
        break;
      }

      lastError = new Error(
        `AI moderation returned status ${response.status}`
      );

      if (
        (response.status === 502 ||
          response.status === 503) &&
        attempt < MAX_RETRIES
      ) {
        console.warn(
          "[AI MODERATION] AI service is starting. Waking it up..."
        );

        await wakeUpAI();
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_RETRIES) {
      console.warn(
        `[AI MODERATION] Request failed. Retrying ${attempt + 1}/${MAX_RETRIES}...`
      );

      await sleep(RETRY_DELAY);
    }
  }

  if (!response || !response.ok) {
    console.error(
      "[AI MODERATION] Service unavailable:",
      lastError?.message
    );

    const serviceError = new Error(
      "AI moderation service unavailable"
    );

    serviceError.code = "AI_MODERATION_UNAVAILABLE";

    throw serviceError;
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    const serviceError = new Error(
      "Invalid AI moderation response"
    );

    serviceError.code = "AI_MODERATION_UNAVAILABLE";

    throw serviceError;
  }

  const label =
    String(result.label || "").toLowerCase();

  const confidence =
    Number(result.confidence) || 0;

  if (!label) {
    const serviceError = new Error(
      "Invalid AI moderation response"
    );

    serviceError.code = "AI_MODERATION_UNAVAILABLE";

    throw serviceError;
  }

  return {
    label,
    confidence,
    decision: ALLOW_LABELS.has(label)
      ? "allow"
      : "block",
  };
};

module.exports = {
  moderateWithAI,
  wakeUpAI,
};