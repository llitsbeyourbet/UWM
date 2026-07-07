import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "./ActivityDetail.css";
import API_URL from "../config";

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
  const [activityRating, setActivityRating] = useState(null);
  const [comments, setComments] = useState([]);
  const [publicComments, setPublicComments] = useState([]);
  const [host, setHost] = useState(null);
  const [hostRating, setHostRating] = useState(null);
  const [commentPublic, setCommentPublic] = useState(false);

  const reportReasons = ["เนื้อหาไม่เหมาะสม", "ข้อมูลเป็นเท็จ", "สแปม", "เป็นอันตราย", "อื่นๆ"];

  useEffect(() => {
    const fetchActivity = async () => {
      const data = localStorage.getItem("currentActivity");
      const token = localStorage.getItem("token");
      if (!data) return;

      const parsed = JSON.parse(data);
      const activityId = parsed.id;

      let user = null;
      try {
        const userRes = await fetch(`${API_URL}/api/auth/me`, {
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
        setCommentPublic(activityData.commentPublic);

        // ดึงข้อมูล host
        const hostRes = await fetch(`${API_URL}/api/auth/user/${activityData.createdBy}`);
        if (hostRes.ok) {
          const hostData = await hostRes.json();
          setHost(hostData);
        }

        // ดึงคะแนน host
        const hostRatingRes = await fetch(`${API_URL}/api/review/host/${activityData.createdBy}`);
        const hostRatingData = await hostRatingRes.json();
        setHostRating(hostRatingData.avgRating);

        // ดึงคะแนนเฉลี่ยกิจกรรม
        const ratingRes = await fetch(`${API_URL}/api/review/activity/${activityId}/rating`);
        const ratingData = await ratingRes.json();
        setActivityRating(ratingData);

        // ดึง comments สาธารณะ
        const pubCommentRes = await fetch(`${API_URL}/api/review/activity/${activityId}/comments/public`);
        const pubCommentData = await pubCommentRes.json();
        setPublicComments(pubCommentData);

        if (user && activityData.createdBy === user.id) {
          setIsOwner(true);

          // เจ้าของดึง comments ทั้งหมด
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
    if (!token) { navigate("/login"); return; }
    setJoinLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/join/${activity.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      setJoinStatus(data.status);
      alert(data.status === "approved" ? "เข้าร่วมกิจกรรมสำเร็จ!" : "ส่งคำขอเข้าร่วมสำเร็จ! รอการอนุมัติ");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
    finally { setJoinLoading(false); }
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
      if (!res.ok) { alert(data.message); return; }
      setJoinStatus("cancelled");
      alert("ยกเลิกการเข้าร่วมสำเร็จ");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
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
      if (!res.ok) { alert(data.message); return; }
      alert("ลบกิจกรรมสำเร็จ");
      navigate("/");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
  };

  const handleReport = async () => {
    if (!reportReason) { alert("กรุณาเลือกเหตุผล"); return; }
    const token = localStorage.getItem("token");
    setReportLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/report/${activity.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reportReason }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("รายงานสำเร็จ ขอบคุณที่แจ้งเตือน");
      setShowReportModal(false);
      setReportReason("");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
    finally { setReportLoading(false); }
  };

  const handleToggleCommentPublic = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/activities/${activity.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commentPublic: !commentPublic }),
      });
      if (!res.ok) return;
      setCommentPublic(!commentPublic);
    } catch { console.log("error"); }
  };

  if (!activity) return <div className="loading">ไม่พบข้อมูลกิจกรรม</div>;

  const getDayName = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
  };

  const displayComments = isOwner ? comments : publicComments;

  return (
    <div className="activity-detail-page">

      {/* Cover */}
      <div className="activity-cover">
        {activity.cover ? (
          <img src={activity.cover} alt="cover" className="activity-cover-img" />
        ) : (
          <div className="activity-cover-placeholder" />
        )}
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        {/* 👈 เปลี่ยนจากหัวใจเป็นปุ่มรายงาน */}
        {!isOwner && (
          <button className="report-icon-btn" onClick={() => setShowReportModal(true)}>🚩</button>
        )}
      </div>

      <div className="activity-content">

        {/* Title & Rating */}
        <div className="activity-title-row">
          <h1 className="activity-title">{activity.activityName}</h1>
          {activityRating?.totalReviews > 0 && (
            <div className="rating-badge">
              <span>⭐</span>
              <span className="rating-num">{activityRating.avgRating}</span>
              <span className="rating-count">({activityRating.totalReviews})</span>
            </div>
          )}
        </div>

        {/* Date & Time */}
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

        {/* Info */}
        <div className="activity-info-row">
          <span className="icon">📍</span>
          <span>{activity.location || "-"}</span>
        </div>
        <div className="activity-info-row">
          <span className="icon">👥</span>
          <span>{activity.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"} · {activity.participantCount} คน</span>
        </div>

        {/* About */}
        <div className="activity-section">
          <h3>About</h3>
          <p>{activity.detail || "-"}</p>
        </div>

        {/* Host Card */}
        {host && (
          <div className="host-card" onClick={() => navigate(`/profile/${host.id}`)}>
            <div className="host-avatar">
              {host.profileImage ? (
                <img src={host.profileImage} alt="host" className="host-avatar-img" />
              ) : (
                <div className="host-avatar-initials">
                  {host.name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="host-info">
              <p className="host-name">{host.name}</p>
              <p className="host-username">@{host.username}</p>
            </div>
            {hostRating && (
              <div className="host-rating">
                <span>⭐</span>
                <span>{hostRating}</span>
              </div>
            )}
          </div>
        )}

        {/* Reviews & Comments */}
        {activityRating?.totalReviews > 0 && (
          <div className="activity-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>รีวิว ({activityRating.totalReviews})</h3>
              {/* เจ้าของตั้งค่าความคิดเห็น */}
              {isOwner && (
                <div className="comment-toggle" onClick={handleToggleCommentPublic}>
                  <span style={{ fontSize: 12, color: "#888" }}>ความคิดเห็น</span>
                  <div className={`toggle-switch ${commentPublic ? "on" : ""}`}>
                    <div className="toggle-thumb" />
                  </div>
                  <span style={{ fontSize: 12, color: commentPublic ? "#6BCB77" : "#aaa" }}>
                    {commentPublic ? "สาธารณะ" : "ส่วนตัว"}
                  </span>
                </div>
              )}
            </div>

            {/* Comments */}
            {displayComments.length > 0 && (
              <div className="comments-list">
                {displayComments.map((c) => (
                  <div key={c.id} className="comment-card">
                    <div className="comment-header">
                      <div className="comment-avatar">
                        {c.userId?.toString().slice(0, 1).toUpperCase() || "U"}
                      </div>
                      <p className="comment-date">
                        {new Date(c.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <p className="comment-text">"{c.comment}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suspended Banner */}
        {activity.status === "suspended" && (
          <div className="suspended-banner">
            🚫 กิจกรรมนี้ถูกระงับโดย Admin
          </div>
        )}

        {/* Owner Actions */}
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
                <QRCodeCanvas value={`${window.location.origin}/checkin/${activity.id}`} size={180} />
                {activity.checkinStart && activity.checkinEnd && (
                  <p className="checkin-time-info">⏰ เช็คอินได้ {activity.checkinStart} - {activity.checkinEnd}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Join Section */}
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
                <button className="scan-btn" onClick={() => navigate("/scan")}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <path d="M14 14h3v3h-3z"/>
                    <path d="M17 17h4"/>
                    <path d="M17 14v3"/>
                  </svg>
                  สแกน QR เช็คอิน
                </button>
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
          </div>
        )}
      </div>

      {/* Report Modal */}
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
              <button className="modal-cancel-btn" onClick={() => setShowReportModal(false)}>ยกเลิก</button>
              <button className="modal-report-btn" onClick={handleReport} disabled={reportLoading}>
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