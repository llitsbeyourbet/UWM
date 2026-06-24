import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "./ActivityDetail.css";

function ActivityDetail() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [joinStatus, setJoinStatus] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [activityRating, setActivityRating] = useState(null); // 👈 เพิ่ม
  const [comments, setComments] = useState([]);               // 👈 เพิ่ม

  const reportReasons = [
    "เนื้อหาไม่เหมาะสม",
    "ข้อมูลเป็นเท็จ",
    "สแปม",
    "เป็นอันตราย",
    "อื่นๆ",
  ];

  useEffect(() => {
    const fetchActivity = async () => {
      const data = localStorage.getItem("currentActivity");
      const token = localStorage.getItem("token");
      if (!data) return;

      const parsed = JSON.parse(data);
      const activityId = parsed.id;

      let user = null;
      try {
        const userRes = await fetch("${API_URL}/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        user = await userRes.json();
      } catch (err) {
        console.log(err);
      }

      try {
        const res = await fetch(`${API_URL}/api/activities/${activityId}`);
        const activityData = await res.json();
        setActivity(activityData);

        // 👈 ดึงคะแนนเฉลี่ยกิจกรรม (ทุกคนเห็น)
        const ratingRes = await fetch(`${API_URL}/api/review/activity/${activityId}/rating`);
        const ratingData = await ratingRes.json();
        setActivityRating(ratingData);

        if (user && activityData.createdBy === user.id) {
          setIsOwner(true);

          // 👈 ถ้าเป็นเจ้าของ ดึง comment ด้วย
          const commentRes = await fetch(`${API_URL}/api/review/activity/${activityId}/comments`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const commentData = await commentRes.json();
          setComments(commentData);

        } else if (user) {
          const statusRes = await fetch(`${API_URL}/api/join/${activityId}/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusRes.json();
          setJoinStatus(statusData.status);

          if (statusData.status === "checked_in") {
            const reviewRes = await fetch(`${API_URL}/api/review/${activityId}/status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const reviewData = await reviewRes.json();
            setReviewed(reviewData.reviewed);
          }
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchActivity();
  }, []);

  const handleJoin = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("กรุณาเข้าสู่ระบบก่อน");
      navigate("/login");
      return;
    }

    setJoinLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/join/${activity.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      setJoinStatus(data.status);
      if (data.status === "approved") {
        alert("เข้าร่วมกิจกรรมสำเร็จ!");
      } else {
        alert("ส่งคำขอเข้าร่วมสำเร็จ! รอการอนุมัติ");
      }
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setJoinLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("ต้องการยกเลิกการเข้าร่วมไหม?")) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/join/${activity.id}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }
      setJoinStatus("cancelled");
      alert("ยกเลิกการเข้าร่วมสำเร็จ");
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("ต้องการลบกิจกรรมนี้ไหม?")) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/activities/${activity.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      alert("ลบกิจกรรมสำเร็จ");
      navigate("/");
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      alert("กรุณาเลือกเหตุผล");
      return;
    }

    const token = localStorage.getItem("token");
    setReportLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/report/${activity.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      alert("รายงานสำเร็จ ขอบคุณที่แจ้งเตือน");
      setShowReportModal(false);
      setReportReason("");
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setReportLoading(false);
    }
  };

  if (!activity) return <div className="loading">ไม่พบข้อมูลกิจกรรม</div>;

  const getDayName = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "long" });
  };

  return (
    <div className="activity-detail-page">
      <div className="activity-cover">
        {activity.cover ? (
          <img src={`${API_URL}/uploads/${activity.cover}`} alt="cover" className="activity-cover-img" />
        ) : (
          <div className="activity-cover-placeholder" />
        )}
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
      </div>

      <div className="activity-content">
        <div className="activity-title-row">
          <h1 className="activity-title">{activity.activityName}</h1>
          <span className="heart-btn">🤍</span>
        </div>

        <div className="activity-info-row">
          <div className="date-box">
            <span className="date-month">
              {activity.date ? new Date(activity.date).toLocaleDateString("en-US", { month: "short" }) : "-"}
            </span>
            <span className="date-day">
              {activity.date ? new Date(activity.date).getDate() : "-"}
            </span>
          </div>
          <div className="date-detail">
            <p className="day-name">{getDayName(activity.date)}</p>
            <p className="time-range">{activity.time || "-"} - {activity.endTime || "-"}</p>
          </div>
        </div>

        <div className="activity-section">
          <h3>About</h3>
          <p>{activity.detail || "-"}</p>
        </div>

        {activityRating?.totalReviews > 0 && (
          <div className="activity-info-row">
            <span className="icon">⭐</span>
            <span>{activityRating.avgRating} ({activityRating.totalReviews} รีวิว)</span>
          </div>
        )}

        <div className="activity-info-row">
          <span className="icon">📍</span>
          <span>{activity.location || "-"}</span>
        </div>

        <div className="activity-info-row">
          <span className="icon">👥</span>
          <span>{activity.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"}</span>
        </div>

        <div className="activity-info-row">
          <span className="icon">🚶</span>
          <span>{activity.participantCount} คน</span>
        </div>

        {isOwner && comments.length > 0 && (
          <div className="activity-section">
            <h3>ความคิดเห็นจากผู้เข้าร่วม</h3>
            {comments.map((c) => (
              <div key={c.id} className="comment-card">
                <p className="comment-text">"{c.comment}"</p>
                <p className="comment-date">{new Date(c.createdAt).toLocaleDateString("th-TH")}</p>
              </div>
            ))}
          </div>
        )}

        {/* 👈 isOwner section */}
        {isOwner && (
          <div className="qr-owner-section">
            <div className="owner-actions">
              <button className="edit-activity-btn" onClick={() => navigate(`/edit-activity/${activity.id}`)}>
                แก้ไขกิจกรรม
              </button>
              <button className="delete-activity-btn" onClick={handleDelete}>
                ลบกิจกรรม
              </button>
            </div>

            <button className="show-qr-btn" onClick={() => setShowQR(!showQR)}>
              {showQR ? "ซ่อน QR Code" : "แสดง QR Code สำหรับยืนยันการเข้าร่วม"}
            </button>

            {showQR && (
              <div className="qr-container">
                <p>QR Code สำหรับยืนยันการเข้าร่วม</p>
                <QRCodeCanvas value={`http://localhost:5173/checkin/${activity.id}`} size={180} />
                {activity.checkinStart && activity.checkinEnd && (
                  <p className="checkin-time-info">
                    ⏰ เช็คอินได้ {activity.checkinStart} - {activity.checkinEnd}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 👈 suspended banner อยู่นอก isOwner */}
        {activity.status === "suspended" && (
          <div className="suspended-banner">
            🚫 กิจกรรมนี้ถูกระงับโดย Admin
          </div>
        )}

        {/* 👈 join section อยู่นอก isOwner */}
        {!isOwner && activity.status !== "suspended" && (
          <div className="join-section">
            {joinStatus === "checked_in" && (
              <>
                <button className="join-btn joined" disabled>เข้าร่วมแล้ว ✓</button>
                {!reviewed ? (
                  <button className="review-btn" onClick={() => navigate(`/review/${activity.id}`)}>
                    ⭐ รีวิวกิจกรรม
                  </button>
                ) : (
                  <p className="reviewed-text">✓ รีวิวแล้ว</p>
                )}
              </>
            )}
            {joinStatus === "approved" && (
              <>
                <button className="join-btn joined" disabled>เข้าร่วมแล้ว ✓</button>
                <button className="cancel-btn" onClick={handleCancel}>ยกเลิกการเข้าร่วม</button>
              </>
            )}
            {joinStatus === "pending" && (
              <>
                <button className="join-btn pending" disabled>รอการอนุมัติ...</button>
                <button className="cancel-btn" onClick={handleCancel}>ยกเลิกคำขอ</button>
              </>
            )}
            {(joinStatus === null || joinStatus === "cancelled") && (
              <button className="join-btn" onClick={handleJoin} disabled={joinLoading}>
                {joinLoading ? "กำลังส่ง..." : "Join"}
              </button>
            )}

            <button className="report-btn" onClick={() => setShowReportModal(true)}>
              🚩 รายงานกิจกรรม
            </button>
          </div>
        )}
      </div>

      {/* 👈 Modal อยู่นอก activity-content */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">รายงานกิจกรรม</h3>
            <p className="modal-subtitle">เลือกเหตุผลที่รายงาน</p>

            <div className="reason-list">
              {reportReasons.map((r) => (
                <div
                  key={r}
                  className={`reason-item ${reportReason === r ? "selected" : ""}`}
                  onClick={() => setReportReason(r)}
                >
                  {reportReason === r ? "● " : "○ "}{r}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setShowReportModal(false)}>
                ยกเลิก
              </button>
              <button
                className="modal-report-btn"
                onClick={handleReport}
                disabled={reportLoading}
              >
                {reportLoading ? "กำลังส่ง..." : "รายงาน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityDetail;