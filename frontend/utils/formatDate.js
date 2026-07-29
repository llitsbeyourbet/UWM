export const formatDate = (dateString) => {
  if (!dateString) return "-";

  const [year, month, day] = String(dateString).split("-");

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
};