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
  // DATE is stored with Sequelize's existing +00:00 convention. Preserve
  // that calendar date; the activity's separate clock time is Bangkok time.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : getActivityDateString(value.toISOString());
  }

  if (typeof value !== "string") return null;

  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})(?:[T ]((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?)(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/
  );
  if (!match || match[1].startsWith("0000-")) return null;

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== match[1]
  ) return null;

  if (!match[2]) return match[1];

  const timestamp = new Date(`${match[1]}T${match[2]}${match[3] || "Z"}`);
  return Number.isNaN(timestamp.getTime())
    ? null
    : timestamp.toISOString().slice(0, 10);
}

function buildBangkokDateTime(dateValue, timeValue) {
  const date = getActivityDateString(dateValue);
  if (!date || !timeValue) return null;

  const time = normalizeTime(timeValue);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/.test(time)) {
    return null;
  }
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
    end.setUTCDate(end.getUTCDate() + 1);
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
