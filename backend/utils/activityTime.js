const BANGKOK_OFFSET = "+07:00";

function normalizeTime(t) {
  if (!t) return "";

  const value = String(t);
  const parts = value.split(":");

  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
  }

  return value;
}

function getActivityDateString(value) {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildBangkokDateTime(dateValue, timeValue) {
  const date = getActivityDateString(dateValue);
  if (!date || !timeValue) return null;

  const time = String(timeValue).slice(0, 8);
  const result = new Date(`${date}T${time}${BANGKOK_OFFSET}`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function getActivityEndDateTime(activity) {
  const end = buildBangkokDateTime(
    activity?.date,
    activity?.endTime || activity?.time
  );

  if (!end) return null;

  if (activity?.endsNextDay) {
    end.setDate(end.getDate() + 1);
  }

  return end;
}

function isActivityEnded(activity, now = new Date()) {
  const end = getActivityEndDateTime(activity);
  return !end || now >= end;
}

function getActivityStartDateTime(activity) {
  return buildBangkokDateTime(
    activity?.date,
    activity?.time
  );
}

function getActivityDateRange(activity) {
  const start = getActivityStartDateTime(activity);
  const end = getActivityEndDateTime(activity);

  if (!start || !end) return null;

  return { start, end };
}

function isActivityOverlap(activityA, activityB) {
  const rangeA = getActivityDateRange(activityA);
  const rangeB = getActivityDateRange(activityB);

  if (!rangeA || !rangeB) return false;

  return (
    rangeA.start < rangeB.end &&
    rangeA.end > rangeB.start
  );
}

module.exports = {
  getActivityDateString,
  buildBangkokDateTime,
  getActivityEndDateTime,
  isActivityEnded,
  normalizeTime,
  getActivityStartDateTime,
  getActivityDateRange,
  isActivityOverlap,
};
