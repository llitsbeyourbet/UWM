import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const IDLE_TIME = 60 * 60 * 1000; // 1 ชั่วโมง

function AutoLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let timeout;

    const logout = () => {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      alert("ไม่มีการใช้งานเกิน 1 ชั่วโมง ระบบได้ออกจากระบบอัตโนมัติ");
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