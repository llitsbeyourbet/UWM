import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import { useAlert } from "../hooks/useAlert";

const HEARTBEAT_INTERVAL = 60 * 1000; // ทุก 1 นาที

export default function SessionManager() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

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
          const data = await response.json();

          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");

          navigate("/login", { replace: true });

          if (data.code === "SESSION_REPLACED") {
            await showAlert({
              type: "info",
              title: "มีการเข้าสู่ระบบจากอุปกรณ์อื่น",
              message:
                "บัญชีของคุณมีการเข้าสู่ระบบจากอุปกรณ์หรือเบราว์เซอร์อื่น กรุณาเข้าสู่ระบบอีกครั้ง",
            });
          } else {
            await showAlert({
              type: "info",
              title: "เซสชันหมดอายุ",
              message: "เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
            });
          }
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