import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSocket } from "../src/context/SocketContext";
import API_URL from "../config";
import "./BottomNavbar.css";

function BottomNavbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { socket } = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUnreadCount(data.unreadCount);
      } catch (err) {
        console.log(err);
      }
    };

    fetchCount();

    if (socket) {
      socket.on("notification", () => {
        fetchCount();
      });
      socket.on("unreadCountUpdated", () => {
        fetchCount();
      });
    }

    return () => {
      if (socket) {
        socket.off("notification");
        socket.off("unreadCountUpdated");
      }
    };
  }, [socket]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="bottom-navbar">
      {/* หน้าหลัก */}
      <div className="nav-item" onClick={() => navigate("/")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke={isActive("/") ? "#000" : "#aaa"}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>

      {/* ค้นหา */}
      <div className="nav-item" onClick={() => navigate("/search")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke={isActive("/search") ? "#000" : "#aaa"}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* ตรงกลาง — admin เห็น Dashboard, user เห็นสร้างกิจกรรม */}
      {user?.role === "admin" ? (
        <div className="nav-item" onClick={() => navigate("/admin")}>
          <div className="create-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>
      ) : (
        <div className="nav-item" onClick={() => navigate("/CreateActivities")}>
          <div className="create-btn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
        </div>
      )}

      {/* แจ้งเตือน */}
      <div className="nav-item" onClick={() => navigate("/notifications")}>
        <div className="notification-wrapper">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke={isActive("/notifications") ? "#000" : "#aaa"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unreadCount > 0 && (
            <div className="notification-badge">{unreadCount}</div>
          )}
        </div>
      </div>

      {/* โปรไฟล์ */}
      <div className="nav-item" onClick={() => navigate("/profile")}>
        <div className="avatar-circle">
          <svg width="26" height="26" viewBox="0 0 24 24"
            fill={isActive("/profile") ? "#000" : "#aaa"}>
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default BottomNavbar;