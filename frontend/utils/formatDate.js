export const formatDate = (dateString) => {
  if (!dateString) return "-";

  const [year, month, day] = String(dateString).split("-");

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
};

export const formatTime = (timeString) => {
  if (!timeString) return "-";

  return String(timeString).slice(0, 5);
};

export const formatDateTime = (dateString) => {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTimeDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTimeTime = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};