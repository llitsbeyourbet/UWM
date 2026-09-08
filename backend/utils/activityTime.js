const BANGKOK_OFFSET = "+07:00";

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
  return buildBangkokDateTime(
    activity?.date,
    activity?.endTime || activity?.time
  );
}

function isActivityEnded(activity, now = new Date()) {
  const end = getActivityEndDateTime(activity);
  return !end || now >= end;
}

module.exports = {
  getActivityDateString,
  buildBangkokDateTime,
  getActivityEndDateTime,
  isActivityEnded,
};
