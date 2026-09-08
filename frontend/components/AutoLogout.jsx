import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../utils/logout";
import { useAlert } from "../hooks/useAlert";

const IDLE_TIME = 60 * 60 * 1000; // 1 ชั่วโมง

function AutoLogout() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  useEffect(() => {
    let timeout;

    const logout = async () => {
      await logoutUser();

      await showAlert({
        type: 'info',
        title: 'ออกจากระบบอัตโนมัติ',
        message: 'ไม่มีการใช้งานเกิน 1 ชั่วโมง ระบบได้ออกจากระบบเพื่อความปลอดภัย',
      });

      navigate("/login", { replace: true });
    };

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(logout, IDLE_TIME);
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer();

    return () => {
      clearTimeout(timeout);

      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [navigate]);

  return null;
}

export default AutoLogout;