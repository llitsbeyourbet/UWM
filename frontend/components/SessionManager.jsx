import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";

const HEARTBEAT_INTERVAL = 60 * 1000; // ทุก 1 นาที

export default function SessionManager() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    if (!token) return;

    // =========================
    // HEARTBEAT
    // =========================
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

    // ส่ง heartbeat ครั้งแรกทันที
    sendHeartbeat();

    const interval = setInterval(
      sendHeartbeat,
      HEARTBEAT_INTERVAL
    );

    // =========================
    // ปิด TAB / ปิด WINDOW
    // =========================
    const handlePageHide = () => {
      fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("pagehide", handlePageHide);

    // =========================
    // CLEANUP
    // =========================
    return () => {
      clearInterval(interval);

      window.removeEventListener(
        "pagehide",
        handlePageHide
      );
    };
  }, [navigate]);

  return null;
}