export const optimizeImageUrl = (url, width = 900) => {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;

  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto,c_limit,w_${width}/`
  );
};
