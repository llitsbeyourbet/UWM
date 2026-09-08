import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../src/context/SocketContext";
import { useAlert } from "../components/AlertModal";
import "../styles/Notifications.css";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [swipedId, setSwipedId] = useState(null);
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { showConfirm } = useAlert();

  useEffect(() => {
    fetchNotifications();

    if (socket) {
      socket.on("notification", () => {
        fetchNotifications();
      });
    }

    return () => {
      if (socket) socket.off("notification");
    };
  }, [socket]);

  const handleAccept = async (n) => {
    try {
      const token = sessionStorage.getItem("token");

      const res = await fetch(
        `${API_URL}/api/join/${n.activityId}/respond/${n.fromUserId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "approved" }),
        }
      );

      if (!res.ok) {
        throw new Error("อนุมัติไม่สำเร็จ");
      }

      await fetchNotifications();

    } catch (err) {
      console.log(err);
    }
  };


  // 👈 แก้ handleReject ให้เรียก API join/respond
  const handleReject = async (n) => {
    try {
      const token = sessionStorage.getItem("token");

      await fetch(
        `${API_URL}/api/join/${n.activityId}/respond/${n.fromUserId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "rejected" }),
        }
      );

      await fetchNotifications();

    } catch (err) {
      console.log(err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = sessionStorage.getItem("token");

      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setNotifications(data);

    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReadAll = async () => {
    try {
      const token = sessionStorage.getItem("token");

      const res = await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("อ่านแจ้งเตือนทั้งหมดไม่สำเร็จ");

      setMenuOpen(false);
      await fetchNotifications();
    } catch (err) {
      console.log(err);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: "ลบการแจ้งเตือน?",
      message: "ต้องการลบการแจ้งเตือนนี้หรือไม่?",
      confirmText: "ลบ",
      cancelText: "ยกเลิก",
    });

    if (!confirmed) return;

    try {
      const token = sessionStorage.getItem("token");

      const res = await fetch(
        `${API_URL}/api/notifications/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error("ลบการแจ้งเตือนไม่สำเร็จ");
      }

      setSwipedId(null);
      await fetchNotifications();
    } catch (err) {
      console.log(err);
    }
  };

const handleDeleteAll = async () => {
  const confirmed = await showConfirm({
    title: "ลบการแจ้งเตือนทั้งหมด?",
    message: "ต้องการลบการแจ้งเตือนทั้งหมดหรือไม่?",
    confirmText: "ลบทั้งหมด",
    cancelText: "ยกเลิก",
  });

  if (!confirmed) return;

  try {
    const token = sessionStorage.getItem("token");

    const res = await fetch(
      `${API_URL}/api/notifications/delete-all`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      throw new Error("ลบการแจ้งเตือนทั้งหมดไม่สำเร็จ");
    }

    setMenuOpen(false);
    setSwipedId(null);
    await fetchNotifications();
  } catch (err) {
    console.log(err);
  }
};

  const getNotificationCategory = (type) => {
    if (["reminder"].includes(type)) {
      return "activity";
    }

    if (
      ["report", "activity_warning", "activity_suspended"].includes(type)
    ) {
      return "report";
    }

    if (
      [
        "join_request",
        "join_confirmed",
        "join_rejected",
        "member_joined",
        "checkin",
      ].includes(type)
    ) {
      return "join";
    }

    if (["review", "review_request"].includes(type)) {
      return "review";
    }

    return "other";
  };

  const filteredNotifications =
    activeTab === "all"
      ? notifications
      : notifications.filter(
        (n) => getNotificationCategory(n.type) === activeTab
      );

  const renderIcon = (type) => {
    if (type === "join_request") return (
      <div className="notif-icon blue">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5577cc" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    );
    if (type === "join_confirmed") return (
      <div className="notif-icon green">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#44aa66" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
    if (type === "member_joined") return (
      <div className="notif-icon green">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#44aa66" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );

    if (type === "checkin") return (
      <div className="notif-icon green">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#44aa66" strokeWidth="2" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );

    if (type === "review") return (
      <div className="notif-icon amber">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc8833" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.1L12 16l-5.5 3.3 1-6.1L3 8.9 9 8z" />
        </svg>
      </div>
    );

    if (type === "reminder") return (
      <div className="notif-icon amber">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc8833" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
    );
    if (type === "review_request") return (
      <div className="notif-icon amber">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc8833" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 15 15 16 16 15" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
    );
    if (type === "join_rejected") return (
      <div className="notif-icon red">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
    );
    if (type === "report") return (
      <div className="notif-icon red">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc4444" strokeWidth="2" strokeLinecap="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
      </div>
    );

    if (type === "activity_warning") return (
      <div className="notif-icon amber">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#cc8833"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
    );

    if (type === "activity_suspended") return (
      <div className="notif-icon red">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#cc4444"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="7" x2="12" y2="13" />
          <circle cx="12" cy="17" r="1" />
        </svg>
      </div>
    );
  };

  const renderMessage = (n) => {
    if (n.type === "join_request")
      return <><span className="bold">{n.fromUsername}</span> ส่งคำขอเข้าร่วมกิจกรรม <span className="bold">{n.activityName}</span></>;
    if (n.type === "join_confirmed")
      return <><span className="bold">{n.fromUsername}</span> {" "}อนุมัติให้คุณเข้าร่วมกิจกรรม{" "} <span className="bold">{n.activityName}</span> {" "}แล้ว </>;
    if (n.type === "join_rejected")
      return <><span className="bold">{n.fromUsername}</span>{" "} ปฏิเสธคำขอเข้าร่วมกิจกรรม{" "} <span className="bold">{n.activityName}</span> </>;
    if (n.type === "member_joined")
      return <><span className="bold">{n.fromUsername}</span>{" "} เข้าร่วมกิจกรรม{" "}<span className="bold">{n.activityName}</span>{" "} แล้ว </>;
    if (n.type === "reminder")
      return <>กิจกรรม <span className="bold">{n.activityName}</span> จะเริ่มในอีก <span className="bold">1 ชั่วโมง</span></>;
    if (n.type === "report")
      return <><span className="bold">{n.fromUsername}</span> รายงานกิจกรรม <span className="bold">{n.activityName}</span></>;
    if (n.type === "review_request")
      return <>คุณสามารถรีวิวกิจกรรม{" "} <span className="bold">{n.activityName}</span> {" "}ได้แล้ว </>;
    if (n.type === "checkin")
      return <><span className="bold">{n.fromUsername}</span> {" "}ยืนยันการเข้าร่วมกิจกรรม{" "} <span className="bold">{n.activityName}</span> {" "}แล้ว </>;
    if (n.type === "review")
      return <><span className="bold">{n.fromUsername}</span> {" "}รีวิวกิจกรรม{" "} <span className="bold">{n.activityName}</span> {" "}แล้ว </>;
    if (n.type === "activity_warning")
      return (<>กิจกรรม{" "}<span className="bold">{n.activityName}</span>{" "}ได้รับคำเตือนจากผู้ดูแลระบบ</>);
    if (n.type === "activity_suspended")
      return (<>กิจกรรม{" "}<span className="bold">{n.activityName}</span>{" "}ถูกระงับโดยผู้ดูแลระบบ</>);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";

    const d = new Date(dateStr);
    const now = new Date();

    const diffMinutes = Math.floor((now - d) / 1000 / 60);

    if (diffMinutes < 1) return "เมื่อสักครู่";

    if (diffMinutes < 60)
      return `${diffMinutes} นาทีที่แล้ว`;

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24)
      return `${diffHours} ชั่วโมงที่แล้ว`;

    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 1)
      return "เมื่อวาน";

    if (diffDays < 7)
      return `${diffDays} วันที่แล้ว`;

    return d.toLocaleDateString("th-TH");
  };

  const NotifCard = ({ n }) => {
    const [touchStartX, setTouchStartX] = useState(null);

    const handleTouchStart = (e) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e) => {
      if (touchStartX === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX - touchEndX;

      if (diff > 60) {
        setSwipedId(n.id);
      } else if (diff < -30) {
        setSwipedId(null);
      }

      setTouchStartX(null);
    };

    const handleClick = async () => {
      try {
        const token = sessionStorage.getItem("token");
        await fetch(`${API_URL}/api/notifications/${n.id}/read`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });
        await fetchNotifications();
      } catch (err) {
        console.log(err);
      }

      if (n.type === "review_request") {
        navigate(`/review/${n.activityId}`);
      } else if (n.type === "report") {
        navigate("/admin/reports");
      } else if (n.activityId) {
        navigate(`/activity-detail?id=${n.activityId}`);
      }
    };

    return (
      <div
        className={`notif-swipe-wrapper ${swipedId === n.id ? "swiped" : ""
          }`}
      >
        <button
          type="button"
          className="notif-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(n.id);
          }}
          aria-label="ลบการแจ้งเตือน"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </button>

        <div
          className={`notif-card ${!n.isRead ? "new" : ""}`}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {n.type === "join_request" || n.type === "member_joined" ? (
            <button
              type="button"
              className="notif-profile"
              onClick={(e) => {
                e.stopPropagation();

                if (n.fromUserId) {
                  navigate(`/user/${n.fromUserId}`);
                }
              }}
            >
              {n.fromUser?.profileImage ? (
                <img
                  src={n.fromUser.profileImage}
                  alt={n.fromUser.username || "profile"}
                />
              ) : (
                <span>
                  {(n.fromUser?.name || n.fromUsername || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
              )}
            </button>
          ) : (
            renderIcon(n.type)
          )}

          <div className="notif-body">
            <p className="notif-message">
              {renderMessage(n)}
            </p>

            {(n.type === "activity_warning" ||
              n.type === "activity_suspended") &&
              n.adminNote && (
                <div className="notif-admin-note">
                  <span>หมายเหตุจากผู้ดูแลระบบ :</span>
                  <p>{n.adminNote}</p>
                </div>
              )}

            <p className="notif-time">
              {formatTime(n.createdAt)}
            </p>

            {n.type === "join_request" && (
              <div
                className="notif-actions"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn-accept"
                  onClick={() => handleAccept(n)}
                >
                  ยอมรับ
                </button>

                <button
                  className="btn-reject"
                  onClick={() => handleReject(n)}
                >
                  ปฏิเสธ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="notifications-page">
      <div className="notif-header">
        <p className="notif-title">การแจ้งเตือน</p>

        <div className="notif-menu-wrapper">
          <button
            type="button"
            className="notif-menu-btn"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="เมนูการแจ้งเตือน"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className="notif-dropdown">
              <button type="button" onClick={handleReadAll}>
                <span>✓</span>
                อ่านการแจ้งเตือนทั้งหมด
              </button>

              <button
                type="button"
                className="danger"
                onClick={handleDeleteAll}
              >
                <span>🗑</span>
                ลบการแจ้งเตือนทั้งหมด
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="notif-tabs">
        <button
          className={activeTab === "all" ? "active" : ""}
          onClick={() => setActiveTab("all")}
        >
          ทั้งหมด
        </button>

        <button
          className={activeTab === "activity" ? "active" : ""}
          onClick={() => setActiveTab("activity")}
        >
          กิจกรรม
        </button>

        <button
          className={activeTab === "join" ? "active" : ""}
          onClick={() => setActiveTab("join")}
        >
          การเข้าร่วม
        </button>

        <button
          className={activeTab === "review" ? "active" : ""}
          onClick={() => setActiveTab("review")}
        >
          รีวิว
        </button>

        <button
          className={activeTab === "report" ? "active" : ""}
          onClick={() => setActiveTab("report")}
        >
          รายงาน
        </button>
      </div>

      <div className="notif-list">
        {loading ? (
          <p className="empty-text">กำลังโหลด...</p>
        ) : filteredNotifications.length === 0 ? (
          <p className="empty-text">ไม่มีการแจ้งเตือน</p>
        ) : (
          <>
            {filteredNotifications.filter((n) => !n.isRead).length > 0 && (
              <>
                <p className="notif-section-label">ยังไม่ได้อ่าน</p>

                {filteredNotifications
                  .filter((n) => !n.isRead)
                  .map((n) => (
                    <NotifCard key={n.id} n={n} />
                  ))}
              </>
            )}

            {filteredNotifications.filter((n) => n.isRead).length > 0 && (
              <>
                <p className="notif-section-label">อ่านแล้ว</p>

                {filteredNotifications
                  .filter((n) => n.isRead)
                  .map((n) => (
                    <NotifCard key={n.id} n={n} />
                  ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Notifications;