import API_URL from "../config";

export const logoutUser = async () => {
  const token = sessionStorage.getItem("token");

  try {
    if (token) {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  }
};