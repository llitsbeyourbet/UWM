import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "./ActivityDetail.css";
import API_URL from "../config";

function ActivityDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("id");
  const fromAdmin = searchParams.get("from") === "admin";

  const [activity, setActivity] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrToken, setQrToken] = useState("");
  const [qrCountdown, setQrCountdown] = useState(10);
  const [joinStatus, setJoinStatus] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [activityRating, setActivityRating] = useState(null);
  const [comments, setComments] = useState([]);
  const [publicComments, setPublicComments] = useState([]);
  const [host, setHost] = useState(null);
  const [hostRating, setHostRating] = useState(null);
  const [participants, setParticipants] = useState([]);

  const reportReasons = ["เนื้อหาไม่เหมาะสม", "ข้อมูลเป็นเท็จ", "สแปม", "เป็นอันตราย", "อื่นๆ"];

  const fetchActivity = async () => {
    if (!activityId) return;
    const token = localStorage.getItem("token");

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

      // ดึงรายชื่อผู้เข้าร่วม
      const participantsRes = await fetch(`${API_URL}/api/activities/${activityId}/participants`);
      if (participantsRes.ok) {
        const participantsData = await participantsRes.json();
        setParticipants(participantsData);
      }

      if (user && activityData.createdBy === user.id) {
        setIsOwner(true);

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

  useEffect(() => {
    fetchActivity();
  }, [activityId]);

  useEffect(() => {
    if (!showQR || !isOwner || !activity) return;

    loadQR();

    const interval = setInterval(() => {
      setQrCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);

  }, [showQR, activity, isOwner]);


  useEffect(() => {
    if (qrCountdown === 0) {
      loadQR();
      setQrCountdown(10);
    }
  }, [qrCountdown]);

  const loadQR = async () => {
    if (!activity) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `${API_URL}/api/activities/${activity.id}/qr`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      if (res.ok) {
        setQrToken(data.qrToken);
      } else {
        console.log(data.message);
      }
    } catch (err) {
      console.log(err);
    }
  };

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

  const handleToggleCommentVisibility = async (commentId, currentIsPublic) => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API_URL}/api/review/comment/${commentId}/visibility`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isPublic: !currentIsPublic }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "ไม่สามารถเปลี่ยนการมองเห็นความคิดเห็นได้");
        return;
      }

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, isPublic: !currentIsPublic }
            : comment
        )
      );

      if (currentIsPublic) {
        // สาธารณะ → ส่วนตัว
        setPublicComments((prev) =>
          prev.filter((comment) => comment.id !== commentId)
        );
      } else {
        // ส่วนตัว → สาธารณะ
        const updatedComment = comments.find(
          (comment) => comment.id === commentId
        );

        if (updatedComment) {
          setPublicComments((prev) => [
            { ...updatedComment, isPublic: true },
            ...prev.filter((comment) => comment.id !== commentId),
          ]);
        }
      }
    } catch (err) {
      console.log(err);
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  if (!activity) return <div className="loading">ไม่พบข้อมูลกิจกรรม</div>;

  const getDayName = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
  };

  const displayComments = isOwner ? comments : publicComments;

  return (
    <div className="activity-detail-page">

      <div className="activity-content">

        {/* Top Bar */}
        <div className="detail-topbar">
          <button
            className="user-back-btn"
            onClick={() => navigate(-1)}
            aria-label="ย้อนกลับ"
          >
            ‹
          </button>

          <div className="report-menu-wrapper">
            <button
              className="report-icon-btn"
              onClick={() => setShowReportMenu((prev) => !prev)}
              aria-label="เมนูเพิ่มเติม"
              aria-expanded={showReportMenu}
            >
              ⋮
            </button>

            {showReportMenu && (
              <>
                <button
                  className="menu-backdrop"
                  aria-label="ปิดเมนู"
                  onClick={() => setShowReportMenu(false)}
                />

                <div className="report-dropdown">
                  {isOwner ? (
                    <>
                      <button
                        className="menu-action-btn"
                        onClick={() => {
                          setShowReportMenu(false);
                          navigate(`/edit-activity/${activity.id}`);
                        }}
                      >
                        <span className="menu-action-icon">✎</span>
                        แก้ไขกิจกรรม
                      </button>

                      <button
                        className="menu-action-btn delete"
                        onClick={() => {
                          setShowReportMenu(false);
                          handleDelete();
                        }}
                      >
                        <span className="menu-action-icon">⌫</span>
                        ลบกิจกรรม
                      </button>
                    </>
                  ) : (
                    <button
                      className="menu-action-btn report"
                      onClick={() => {
                        setShowReportMenu(false);
                        setShowReportModal(true);
                      }}
                    >
                      <span className="menu-action-icon">⚑</span>
                      รายงานกิจกรรม
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cover */}
        <div className="activity-cover-wrapper">

          <div className="activity-cover">

            <img
              src={activity.cover}
              alt={activity.activityName}
              className="activity-main-image"
            />
          </div>

        </div>

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
          <span>{activity.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"} · {activity.joinedCount || 0}/{activity.participantCount} คน</span>
        </div>

        {/* About */}
        <div className="activity-section">
          <h3>About</h3>
          <p>{activity.detail || "-"}</p>
        </div>

        {/* Host */}
        {host && (
          <div className="host-section">
            <h3 className="section-title">จัดโดย</h3>

            <div
              className="host-card"
              onClick={() => navigate(`/user/${host.id}`)}
            >
              <div className="host-avatar">
                {host.profileImage ? (
                  <img
                    src={host.profileImage.startsWith("http") ? host.profileImage : `${API_URL}/uploads/${host.profileImage}`}
                    alt={host.name}
                    className="host-avatar-img"
                  />
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
          </div>
        )}

        {/* Participants */}
        <div className="participants-section">
          <div className="participants-header">
            <h3>ผู้เข้าร่วม ({participants.length})</h3>

            {participants.length > 3 && (
              <button
                className="view-all-btn"
                onClick={() => setShowAllParticipants((prev) => !prev)}
              >
                {showAllParticipants ? "ย่อรายการ" : "ดูทั้งหมด"}
              </button>
            )}
          </div>

          {participants.length > 0 ? (
            <div className="participants-list">
              {(showAllParticipants ? participants : participants.slice(0, 3)).map((p) => (
                <div
                  key={p.id}
                  className="participant-item"
                  onClick={() => navigate(`/user/${p.id}`)}
                >
                  <div className="p-avatar">
                    {p.profileImage ? (
                      <img
                        src={
                          p.profileImage.startsWith("http")
                            ? p.profileImage
                            : `${API_URL}/uploads/${p.profileImage}`
                        }
                        alt={p.name}
                      />
                    ) : (
                      <div className="p-avatar-initials">
                        {p.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="participant-info">
                    <span className="p-name">{p.name}</span>

                    {p.username && (
                      <span className="p-username">
                        @{p.username}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-participants">ยังไม่มีผู้เข้าร่วม</p>
          )}
        </div>

        {/* Reviews & Comments */}
        {activityRating?.totalReviews > 0 && (
          <div className="activity-section reviews-section">
            <div className="reviews-title-row">
              <h3>รีวิว ({activityRating.totalReviews})</h3>
            </div>

            {displayComments.length > 0 ? (
              <div className="comments-list">
                {displayComments.map((c) => {
                  const reviewer = c.user || c.reviewer || {};
                  const reviewerId = reviewer.id || c.userId || c.reviewerId;
                  const reviewerName =
                    reviewer.name || c.userName || c.reviewerName || "ผู้ใช้งาน";
                  const reviewerUsername =
                    reviewer.username || c.username || c.reviewerUsername;
                  const reviewerImage =
                    reviewer.profileImage || c.profileImage || c.reviewerProfileImage;

                  const imageUrl = reviewerImage
                    ? reviewerImage.startsWith("http")
                      ? reviewerImage
                      : `${API_URL}/uploads/${reviewerImage}`
                    : null;

                  const isPublic = Boolean(c.isPublic);

                  return (
                    <div key={c.id} className="comment-card">
                      <div className="comment-header">
                        <button
                          type="button"
                          className="reviewer-profile"
                          onClick={() => reviewerId && navigate(`/user/${reviewerId}`)}
                          disabled={!reviewerId}
                        >
                          <div className="comment-avatar">
                            {imageUrl ? (
                              <img src={imageUrl} alt={reviewerName} />
                            ) : (
                              <span>{reviewerName?.charAt(0).toUpperCase() || "U"}</span>
                            )}
                          </div>

                          <div className="reviewer-info">
                            <span className="reviewer-name">{reviewerName}</span>
                            {reviewerUsername && (
                              <span className="reviewer-username">
                                @{reviewerUsername}
                              </span>
                            )}
                          </div>
                        </button>

                        <p className="comment-date">
                          {new Date(c.createdAt).toLocaleDateString("th-TH")}
                        </p>
                      </div>

                      <p className="comment-text">"{c.comment}"</p>

                      {isOwner && (
                        <div className="comment-visibility-row">
                          <span className="visibility-label">
                            {isPublic ? "สาธารณะ" : "ส่วนตัว"}
                          </span>

                          <button
                            type="button"
                            className={`comment-toggle-button ${isPublic ? "public" : ""}`}
                            onClick={() =>
                              handleToggleCommentVisibility(c.id, isPublic)
                            }
                            aria-pressed={isPublic}
                          >
                            <span className="toggle-thumb" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="no-comments">ยังไม่มีความคิดเห็นที่แสดงได้</p>
            )}
          </div>
        )}

        {/* Suspended Banner */}
        {activity.status === "suspended" && (
          <div className="suspended-banner">
            🚫 กิจกรรมนี้ถูกระงับโดย Admin
          </div>
        )}

        {/* Owner QR */}
        {isOwner && (
          <div className="qr-owner-section">
            <button className="show-qr-btn" onClick={() => { setShowQR(!showQR); setQrCountdown(10); }}>
              {showQR ? "ซ่อน QR Code" : "แสดง QR Code สำหรับยืนยันการเข้าร่วม"}
            </button>
            {showQR && (
              <div className="qr-container">
                <p>QR Code สำหรับยืนยันการเข้าร่วม</p>
                <QRCodeCanvas
                  value={`${window.location.origin}/checkin/${activity.id}/${qrToken}`}
                  size={180}
                />

                <p className="qr-countdown">
                  🔄 QR Code จะเปลี่ยนใหม่ใน {qrCountdown} วินาที
                </p>
                {activity.checkinStart && activity.checkinEnd && (
                  <p className="checkin-time-info">⏰ เช็คอินได้ {activity.checkinStart} - {activity.checkinEnd}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Join Section */}

        {fromAdmin ? (
          <div className="join-section">
            <button
              className="suspend-btn-big"
              onClick={async () => {
                if (!window.confirm("ต้องการระงับกิจกรรมนี้ไหม?")) return;
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_URL}/api/admin/suspend/${activity.id}`, {
                  method: "PUT",
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                  alert("ระงับกิจกรรมสำเร็จ");
                  navigate("/admin");
                }
              }}
            >
              🚫 ระงับกิจกรรม
            </button>
            <button className="cancel-btn" onClick={() => navigate("/admin")}>
              ← กลับ Dashboard
            </button>
          </div>
        ) : (
          !isOwner && activity.status !== "suspended" && (
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
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3h-3z" />
                      <path d="M17 17h4" />
                      <path d="M17 14v3" />
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
          )
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