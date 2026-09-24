// backend/services/aiModerationService.js

const AI_MODERATION_URL =
  process.env.AI_MODERATION_URL || "http://127.0.0.1:5001";

// V5 อนุญาตเฉพาะ safe
const ALLOW_LABELS = new Set(["safe"]);

const MAX_RETRIES = 2;

// request ปกติ
const REQUEST_TIMEOUT = 65000;

// รอระหว่าง retry ของ /moderate
const RETRY_DELAY = 3000;

// สำหรับรอ Render cold start
const HEALTH_TIMEOUT = 10000;
const WAKE_UP_INTERVAL = 5000;
const MAX_WAKE_UP_ATTEMPTS = 12;

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

const checkAIHealth = async () => {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    HEALTH_TIMEOUT
  );

  try {
    const response = await fetch(
      `${AI_MODERATION_URL}/health`,
      {
        signal: controller.signal,
      }
    );

    return response.ok;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const wakeUpAI = async () => {
  console.log(
    "[AI MODERATION] Waiting for AI service to become ready..."
  );

  for (
    let attempt = 1;
    attempt <= MAX_WAKE_UP_ATTEMPTS;
    attempt++
  ) {
    const ready = await checkAIHealth();

    if (ready) {
      console.log(
        "[AI MODERATION] AI service is ready"
      );

      return true;
    }

    console.log(
      `[AI MODERATION] AI not ready (${attempt}/${MAX_WAKE_UP_ATTEMPTS})`
    );

    if (attempt < MAX_WAKE_UP_ATTEMPTS) {
      await sleep(WAKE_UP_INTERVAL);
    }
  }

  console.error(
    "[AI MODERATION] AI service did not become ready in time"
  );

  return false;
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
          "[AI MODERATION] AI service is starting..."
        );

        const ready = await wakeUpAI();

        if (!ready) {
          break;
        }
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_RETRIES) {
      console.warn(
        `[AI MODERATION] Retrying request ${attempt + 1}/${MAX_RETRIES}...`
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

    serviceError.code =
      "AI_MODERATION_UNAVAILABLE";

    throw serviceError;
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    const serviceError = new Error(
      "Invalid AI moderation response"
    );

    serviceError.code =
      "AI_MODERATION_UNAVAILABLE";

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

    serviceError.code =
      "AI_MODERATION_UNAVAILABLE";

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