import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import { useAlert } from "../hooks/useAlert";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // ทุก 5 นาที

export default function SessionManager() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  useEffect(() => {
    let requestInProgress = false;

    const sendHeartbeat = async () => {
      if (requestInProgress) return;

      const token = sessionStorage.getItem("token");
      if (!token) return;

      requestInProgress = true;

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
              message:
                "เซสชันของคุณหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
            });
          }
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      } finally {
        requestInProgress = false;
      }
    };

    const interval = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL
    );

    return () => {
      clearInterval(interval);
    };
  }, [navigate, showAlert]);

  return null;
}