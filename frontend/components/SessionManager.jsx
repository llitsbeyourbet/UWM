import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";

const HEARTBEAT_INTERVAL = 60 * 1000; // ทุก 1 นาที

export default function SessionManager() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    if (!token) return;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/heartbeat`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");

          navigate("/login", {
            replace: true,
            state: {
              message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
            },
          });
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    };

    // เช็ก session ทันทีตอนเปิด/refresh หน้า
    sendHeartbeat();

    // หลังจากนั้นเช็กทุก 1 นาที
    const interval = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL
    );

    return () => {
      clearInterval(interval);
    };
  }, [navigate]);

  return null;
}