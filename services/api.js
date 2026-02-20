// src/services/api.js
const API_URL = import.meta.env.VITE_API_URL;

export const login = async (data) => {
  return fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};
