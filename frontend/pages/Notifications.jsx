import API_URL from "../config";
import { useEffect, useState } from "react";
import "./Notifications.css";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  // 👈 แก้ handleAccept ให้เรียก API join/respond
  const handleAccept = async (n) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/join/${n.activityId}/respond/${n.fromUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "approved" }),
      });
      setNotifications((prev) =>
        prev.map((item) => item.id === n.id ? { ...item, type: "join_confirmed" } : item)
      );
    } catch (err) {
      console.log(err);
    }
  };

  // 👈 แก้ handleReject ให้เรียก API join/respond
  const handleReject = async (n) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/join/${n.activityId}/respond/${n.fromUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "rejected" }),
      });
      setNotifications((prev) =>
        prev.map((item) => item.id === n.id ? { ...item, type: "join_rejected" } : item)
      );
    } catch (err) {
      console.log(err);
    }
  };

  const newNotifs = notifications.filter((n) => !n.isRead);
  const oldNotifs = notifications.filter((n) => n.isRead);

  const renderIcon = (type) => {
    if (type === "join_request") return (
      <div className="notif-icon blue">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5577cc" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
    );
    if (type === "join_confirmed") return (
      <div className="notif-icon green">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#44aa66" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
    if (type === "reminder") return (
      <div className="notif-icon amber">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc8833" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
    );
    if (type === "join_rejected") return (
      <div className="notif-icon red">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
    );
    if (type === "report") return (
      <div className="notif-icon red">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc4444" strokeWidth="2" strokeLinecap="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      </div>
    );
  };

  const renderMessage = (n) => {
    if (n.type === "join_request")
      return <><span className="bold">{n.fromUsername}</span> ส่งขอเข้าร่วมกิจกรรม <span className="bold">{n.activityName}</span></>;
    if (n.type === "join_confirmed")
      return <><span className="bold">{n.fromUsername}</span> ตอบรับคำขอเข้าร่วมกิจกรรม <span className="bold">{n.activityName}</span> แล้ว</>;
    if (n.type === "join_rejected")
      return <><span className="bold">{n.fromUsername}</span> ปฏิเสธคำขอเข้าร่วมกิจกรรม <span className="bold">{n.activityName}</span></>;
    if (n.type === "reminder")
      return <>กิจกรรม <span className="bold">{n.activityName}</span> จะเริ่มในอีก <span className="bold">1 ชั่วโมง</span></>;
    if (n.type === "report")
      return <><span className="bold">{n.fromUsername}</span> รายงานกิจกรรม <span className="bold">{n.activityName}</span></>;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000 / 60);
    if (diff < 1) return "เมื่อกี้";
    if (diff < 60) return `${diff} นาทีที่แล้ว`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ชั่วโมงที่แล้ว`;
    return "เมื่อวาน";
  };

  const NotifCard = ({ n }) => (
    <div className={`notif-card ${!n.isRead ? "new" : ""}`}>
      {renderIcon(n.type)}
      <div className="notif-body">
        <p className="notif-message">{renderMessage(n)}</p>
        <p className="notif-time">{formatTime(n.createdAt)}</p>
        {n.type === "join_request" && (
          <div className="notif-actions">
            <button className="btn-accept" onClick={() => handleAccept(n)}>ยอมรับ</button>
            <button className="btn-reject" onClick={() => handleReject(n)}>ปฏิเสธ</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="notifications-page">
      <div className="notif-header">
        <p className="notif-title">Notification</p>
      </div>

      <div className="notif-list">
        {loading ? (
          <p className="empty-text">กำลังโหลด...</p>
        ) : notifications.length === 0 ? (
          <p className="empty-text">ไม่มีการแจ้งเตือน</p>
        ) : (
          <>
            {newNotifs.length > 0 && (
              <>
                <p className="notif-section-label">ใหม่</p>
                {newNotifs.map((n) => <NotifCard key={n.id} n={n} />)}
              </>
            )}
            {oldNotifs.length > 0 && (
              <>
                <p className="notif-section-label">ก่อนหน้า</p>
                {oldNotifs.map((n) => <NotifCard key={n.id} n={n} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Notifications;