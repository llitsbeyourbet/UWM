import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "../styles/ActivityDetail.css";
import API_URL from "../config";
import { formatDate, formatTime } from "../utils/formatDate";
import { getCategoryIcon } from "../utils/categoryIcons";

const getPaginationNumbers = (page, totalPages) => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, "...", totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", page, "...", totalPages];
};


function ActivityDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("id");
  const source = searchParams.get("from");
  const fromAdmin = searchParams.get("from") === "admin";
  const fromReport = source === "admin-report";

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
  const [visibleReviews, setVisibleReviews] = useState(3);
  const [reportReason, setReportReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [activityRating, setActivityRating] = useState(null);
  const [detailedReviews, setDetailedReviews] = useState([]);
  const [reviewTab, setReviewTab] = useState("activity");
  const [host, setHost] = useState(null);

  const [participantsPage, setParticipantsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [hostRating, setHostRating] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [hasPendingReport, setHasPendingReport] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const reportReasons = ["เนื้อหาไม่เหมาะสม", "ข้อมูลเป็นเท็จ", "สแปม", "เป็นอันตราย", "อื่นๆ"];

  const fetchActivity = useCallback(async () => {
    if (!activityId) return;
    const token = localStorage.getItem("token");

    let user = null;
    try {
      const userRes = await fetch(API_URL + "/api/auth/me", {
        headers: { Authorization: "Bearer " + token },
      });
      if (userRes.ok) {
        user = await userRes.json();
        setCurrentUser(user);
      }
    } catch (err) {
      console.log(err);
    }

    try {
      const res = await fetch(API_URL + "/api/activities/" + activityId);
      if (!res.ok) {
        if (res.status === 404) setNotFound(true);
        return;
      }
      const activityData = await res.json();
      setActivity(activityData);
      setNotFound(false);

      const hostRes = await fetch(API_URL + "/api/auth/user/" + activityData.createdBy);
      if (hostRes.ok) {
        const hostData = await hostRes.json();
        setHost(hostData);
      }

      const hostRatingRes = await fetch(API_URL + "/api/review/host/" + activityData.createdBy);
      if (hostRatingRes.ok) {
        const hostRatingData = await hostRatingRes.json();
        setHostRating(hostRatingData.avgRating);
      }

      const ratingRes = await fetch(API_URL + "/api/review/activity/" + activityId + "/rating");
      if (ratingRes.ok) {
        const ratingData = await ratingRes.json();
        setActivityRating(ratingData);
      }

      const detailedRes = await fetch(API_URL + "/api/review/activity/" + activityId + "/detailed-reviews");
      if (detailedRes.ok) {
        const detailedData = await detailedRes.json();
        setDetailedReviews(detailedData);
      }

      const participantsRes = await fetch(API_URL + "/api/activities/" + activityId + "/participants");
      if (participantsRes.ok) {
        const participantsData = await participantsRes.json();
        setParticipants(participantsData);
      }

      if (user && Number(activityData.createdBy) === Number(user.id)) {
        setIsOwner(true);
      } else if (user) {
        const statusRes = await fetch(API_URL + "/api/join/" + activityId + "/status", {
          headers: { Authorization: "Bearer " + token },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setJoinStatus(statusData.status);

          if (statusData.status === "checked_in") {
            const reviewRes = await fetch(API_URL + "/api/review/" + activityId + "/status", {
              headers: { Authorization: "Bearer " + token },
            });
            if (reviewRes.ok) {
              const reviewData = await reviewRes.json();
              setReviewed(reviewData.reviewed);
            }
          }
        }
      }
    } catch (err) {
      console.log(err);
    }
  }, [activityId, navigate]);

  useEffect(() => {
    fetchActivity();

    const handleUpdate = () => {
      fetchActivity();
    };
    window.addEventListener("activityUpdated", handleUpdate);

    return () => {
      window.removeEventListener("activityUpdated", handleUpdate);
    };
  }, [fetchActivity]);

  useEffect(() => {
    if (!fromAdmin || !activityId) return;

    const checkReport = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(API_URL + "/api/admin/reports", {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.message || "โหลดรายงานไม่สำเร็จ");
        const reports = Array.isArray(data) ? data : Array.isArray(data?.reports) ? data.reports : [];
        const found = reports.some((report) => {
          const reportedActivityId = report.activityId || report.activity_id || report.activity?.id || report.activity?._id;
          const status = String(report.status || "pending").toLowerCase();
          return (String(reportedActivityId) === String(activityId) && ["pending", "reviewing"].includes(status));
        });
        setHasPendingReport(found);
      } catch (error) {
        console.error(error);
        setHasPendingReport(false);
      }
    };
    checkReport();
  }, [fromAdmin, activityId]);

  useEffect(() => {
    if (!showQR || !isOwner || !activity) return;
    loadQR();
    const interval = setInterval(() => { setQrCountdown((prev) => prev - 1); }, 1000);
    return () => clearInterval(interval);
  }, [showQR, activity, isOwner]);

  useEffect(() => {
    if (qrCountdown === 0) {
      loadQR();
      setQrCountdown(15);
    }
  }, [qrCountdown]);

  const loadQR = async () => {
    if (!activity) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(API_URL + "/api/activities/" + activity.id + "/qr", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (res.ok) setQrToken(data.qrToken);
    } catch (err) { console.log(err); }
  };

  const handleJoin = async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    setJoinLoading(true);
    try {
      const res = await fetch(API_URL + "/api/join/" + activity.id, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
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
      const res = await fetch(API_URL + "/api/join/" + activity.id + "/cancel", {
        method: "PUT",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      setJoinStatus("cancelled");
      alert("ยกเลิกการเข้าร่วมสำเร็จ");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
  };

  const handleDelete = async () => {
    const ended =
      activity &&
      new Date(
        activity.date + "T" + (activity.endTime || activity.time)
      ) <= new Date();

    if (activity.status === "suspended") {
      alert("กิจกรรมที่ถูกระงับโดยแอดมินไม่สามารถลบได้");
      return;
    }

    if (ended) {
      alert("กิจกรรมที่สิ้นสุดแล้วไม่สามารถลบได้");
      return;
    }

    if (Number(activity.joinedCount || participants.length || 0) > 0) {
      alert("ไม่สามารถลบกิจกรรมที่มีผู้เข้าร่วมแล้วได้");
      return;
    }

    if (!window.confirm("ต้องการลบกิจกรรมนี้ไหม?")) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        API_URL + "/api/activities/" + activity.id,
        {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + token,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message);
        return;
      }

      alert("ลบกิจกรรมสำเร็จ");
      navigate("/");
    } catch {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  const handleReport = async () => {
    if (!reportReason) { alert("กรุณาเลือกเหตุผล"); return; }
    if (reportReason === "อื่นๆ" && !otherReason.trim()) { alert("กรุณาระบุเหตุผลเพิ่มเติม"); return; }
    const token = localStorage.getItem("token");
    setReportLoading(true);
    try {
      const res = await fetch(API_URL + "/api/report/" + activity.id, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ reason: reportReason === "อื่นๆ" ? otherReason : reportReason }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("รายงานสำเร็จ ขอบคุณที่แจ้งเตือน");
      setShowReportModal(false);
      setReportReason("");
      setOtherReason("");
    } catch { alert("ไม่สามารถเชื่อมต่อ server ได้"); }
    finally { setReportLoading(false); }
  };

  const handleToggleCommentVisibility = async (commentId, currentIsPublic) => {
    if (!commentId) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(API_URL + "/api/review/comment/" + commentId + "/visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ isPublic: !currentIsPublic }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "ไม่สามารถเปลี่ยนการมองเห็นความคิดเห็นได้"); return; }

      setDetailedReviews((prev) => prev.map((rev) => {
        if (rev.activityCommentId === commentId) {
          return { ...rev, activityIsPublic: !currentIsPublic };
        }
        if (rev.hostCommentId === commentId) {
          return { ...rev, hostIsPublic: !currentIsPublic };
        }
        return rev;
      }));
    } catch (err) { console.log(err); alert("ไม่สามารถเชื่อมต่อ server ได้"); }
  };

  if (!activityId) return <div className="loading">ไม่พบ ID กิจกรรม</div>;
  if (notFound) return <div className="loading">ไม่พบกิจกรรมที่คุณต้องการดู</div>;
  if (!activity) return <div className="loading">กำลังโหลด...</div>;

  const getDayName = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
  };

  const filteredReviews = detailedReviews.filter((rev) => {
    if (reviewTab === "activity") {
      if (!isOwner && !rev.activityIsPublic) return false;
      return rev.activityRating !== null;
    }
    if (reviewTab === "host") {
      if (!isOwner && !rev.hostIsPublic) return false;
      return rev.hostRating !== null;
    }
    return true;
  });

  const activityEnded = activity && new Date(activity.date + "T" + (activity.endTime || activity.time)) <= new Date();

  // Pagination for Participants
  const totalP = participants.length;
  const totalPagesP = Math.max(1, Math.ceil(totalP / ITEMS_PER_PAGE));
  const pStart = (participantsPage - 1) * ITEMS_PER_PAGE + 1;
  const pEnd = Math.min(participantsPage * ITEMS_PER_PAGE, totalP);
  const paginatedParticipants = participants.slice(
    (participantsPage - 1) * ITEMS_PER_PAGE,
    participantsPage * ITEMS_PER_PAGE
  );

  const hasParticipants =
    Number(activity.joinedCount || participants.length || 0) > 0;

  const canDeleteActivity =
    isOwner &&
    !activityEnded &&
    activity.status !== "suspended" &&
    !hasParticipants;

  return (
    <div className="activity-detail-page">
      <div className="activity-content">
        <div className="detail-topbar">
          <div className="back-btn" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
          {!fromAdmin && !fromReport && (
            <div className="report-menu-wrapper">
              <button type="button" className="report-icon-btn" onClick={() => setShowReportMenu((prev) => !prev)} aria-label="เมนูเพิ่มเติม" aria-expanded={showReportMenu}>⋮</button>
              {showReportMenu && (
                <>
                  <button type="button" className="menu-backdrop" aria-label="ปิดเมนู" onClick={() => setShowReportMenu(false)} />
                  <div className="report-dropdown">
                    {isOwner ? (
                      <>

                        <>
                          <button type="button" className="menu-action-btn"
                            onClick={() => {
                              setShowReportMenu(false);
                              if (activityEnded) {
                                alert("กิจกรรมที่สิ้นสุดแล้วไม่สามารถแสดง QR Code ได้");
                                return;
                              }
                              setShowQR((prev) => !prev); setQrCountdown(15);
                            }}>
                            <span className="menu-action-icon">▦</span> {showQR ? "ซ่อน QR Code" : "แสดง QR Code"}
                          </button>
                          <button type="button" className="menu-action-btn"
                            onClick={() => {
                              setShowReportMenu(false);
                              if (activityEnded) {
                                alert("กิจกรรมที่สิ้นสุดแล้ว ไม่สามารถแก้ไขได้");
                                return;
                              }
                              navigate("/edit-activity/" + activity.id);
                            }}>
                            <span className="menu-action-icon">✎</span> แก้ไขกิจกรรม
                          </button>

                          <button
                            type="button"
                            className="menu-action-btn delete"
                            onClick={() => {
                              setShowReportMenu(false);
                              handleDelete();
                            }}
                          >
                            <span className="menu-action-icon">🗑️</span>
                            ลบกิจกรรม
                          </button>

                        </>


                      </>
                    ) : (
                      <button type="button" className="menu-action-btn report" onClick={() => { setShowReportMenu(false); setShowReportModal(true); }}>
                        <span className="menu-action-icon">⚑</span> รายงานกิจกรรม
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="activity-cover-wrapper">
          <div className="activity-cover">
            {activity.cover ? (
              <img src={activity.cover.startsWith("http") ? activity.cover : API_URL + "/uploads/" + activity.cover} alt={activity.activityName} className="activity-main-image" />
            ) : (
              <div className="activity-cover-placeholder">
                <div className="placeholder-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#bcc6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 15" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

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

        <div className="activity-info-row">
          <div className="date-box">
            <span className="date-month">{activity.date ? new Date(activity.date).toLocaleDateString("en-US", { month: "short" }) : "-"}</span>
            <span className="date-day">{activity.date ? new Date(activity.date).getDate() : "-"}</span>
          </div>
          <div className="date-detail">
            <p className="day-name">{getDayName(activity.date)}</p>
            <p className="time-range"> {formatTime(activity.time)} - {formatTime(activity.endTime)}</p>
          </div>
        </div>

        <div className="activity-info-row">
          <span className="icon">📍</span>
          <span>{activity.location || "-"}</span>
        </div>
        <div className="activity-info-row">
          <span className="icon">👥</span>
          <span>{activity.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"} · {activity.joinedCount || 0}/{activity.participantCount} คน</span>
        </div>

        <div className="category-badges">
          {(Array.isArray(activity.category)
            ? activity.category
            : [activity.category]
          )
            .filter(Boolean)
            .map((category) => (
              <span key={category} className="category-badge">
                {getCategoryIcon(category)} {category}
              </span>
            ))}
        </div>


        <div className="activity-section">
          <h3>About</h3>
          <p>{activity.detail || "-"}</p>
        </div>

        {host && (
          <div className="host-section">
            <h3 className="section-title">ผู้สร้างกิจกรรม</h3>
            <div className="host-card" onClick={() => navigate("/user/" + host.id)}>
              <div className="host-avatar">
                {host.profileImage ? (
                  <img src={host.profileImage.startsWith("http") ? host.profileImage : API_URL + "/uploads/" + host.profileImage} alt={host.name} className="host-avatar-img" />
                ) : (
                  <div className="host-avatar-initials">{host.name?.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="host-info">
                <p className="host-name">{host.name}</p>
                <p className="host-username">@{host.username}</p>
              </div>
              {isOwner && (
                <span className="user-role-badge me">
                  👑 ME
                </span>
              )}
              {hostRating && (
                <div className="host-rating">
                  <span>⭐</span>
                  <span>{hostRating}</span>
                </div>
              )}
            </div>
          </div>
        )}


        <div className="participants-section">
          <div className="participants-header">
            <h3>ผู้เข้าร่วม ({participants.length})</h3>
            {participants.length > 5 && (
              <button className="view-all-btn" onClick={() => {
                setShowAllParticipants((prev) => !prev);
                setParticipantsPage(1);
              }}>
                {showAllParticipants ? "ย่อรายการ" : "ดูเพิ่มเติม"}
              </button>
            )}
          </div>
          {participants.length > 0 ? (
            <>
              {!showAllParticipants ? (
                <div className="participants-list">
                  {participants.slice(0, 5).map((p) => (
                    <div key={p.id} className="participant-item" onClick={() => navigate("/user/" + p.id)}>
                      <div className="p-avatar">
                        {p.profileImage ? (
                          <img src={p.profileImage.startsWith("http") ? p.profileImage : API_URL + "/uploads/" + p.profileImage} alt={p.name} />
                        ) : (
                          <div className="p-avatar-initials">{p.name?.charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="participant-info">
                        <span className="p-name">{p.name}</span>
                        {p.username && <span className="p-username">@{p.username}</span>}
                      </div>
                      {Number(p.id) === Number(currentUser?.id) && (
                        <span className="user-role-badge member">
                          👑 ME
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="participants-list">
                    {paginatedParticipants.map((p) => (
                      <div key={p.id} className="participant-item" onClick={() => navigate("/user/" + p.id)}>
                        <div className="p-avatar">
                          {p.profileImage ? (
                            <img src={p.profileImage.startsWith("http") ? p.profileImage : API_URL + "/uploads/" + p.profileImage} alt={p.name} />
                          ) : (
                            <div className="p-avatar-initials">{p.name?.charAt(0).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="participant-info">
                          <span className="p-name">{p.name}</span>
                          {p.username && <span className="p-username">@{p.username}</span>}
                        </div>
                        {Number(p.id) === Number(currentUser?.id) && (
                          <span className="user-role-badge member">
                            👑 ME
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pagination-controls">
                    <span className="pagination-info">
                      แสดง {participantsPage === 1 ? 1 : pStart}-{pEnd} จาก {participants.length} คน
                    </span>
                    <div className="pagination-buttons">
                      <button
                        className="pagination-btn"
                        disabled={participantsPage === 1}
                        onClick={() => setParticipantsPage(prev => prev - 1)}
                      >
                        ‹
                      </button>
                      {getPaginationNumbers(participantsPage, totalPagesP).map((num, index) => (
                        typeof num === "number" ? (
                          <button
                            key={num}
                            className={`pagination-btn ${participantsPage === num ? "active" : ""}`}
                            onClick={() => setParticipantsPage(num)}
                          >
                            {num}
                          </button>
                        ) : (
                          <span key={`dots-${index}`} className="pagination-dots">
                            {num}
                          </span>
                        )
                      ))}
                      <button
                        className="pagination-btn"
                        disabled={participantsPage === totalPagesP}
                        onClick={() => setParticipantsPage(prev => prev + 1)}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="no-participants">ยังไม่มีผู้เข้าร่วม</p>
          )}
        </div>


        {!fromAdmin && activityRating?.totalReviews > 0 && (
          <div className="activity-section reviews-section">
            <div className="reviews-header">
              <h3>รีวิว ({activityRating.totalReviews})</h3>
              <div className="review-tabs">
                <button
                  className={"tab-btn " + (reviewTab === 'activity' ? 'active' : '')}
                  onClick={() => setReviewTab('activity')}
                >
                  รีวิวกิจกรรม
                </button>
                <button
                  className={"tab-btn " + (reviewTab === 'host' ? 'active' : '')}
                  onClick={() => setReviewTab('host')}
                >
                  รีวิวผู้สร้างกิจกรรม
                </button>
              </div>
            </div>
            {filteredReviews.length > 0 ? (
              <>
                <div className="comments-list">
                  {filteredReviews.slice(0, visibleReviews).map((rev) => {
                    const reviewer = rev.user || {};
                    const reviewerId = rev.userId;
                    const reviewerName = reviewer.name || "ผู้ใช้งาน";
                    const reviewerUsername = reviewer.username;
                    const reviewerImage = reviewer.profileImage;
                    const imageUrl = reviewerImage ? (reviewerImage.startsWith("http") ? reviewerImage : API_URL + "/uploads/" + reviewerImage) : null;

                    return (
                      <div key={rev.id} className="comment-card">
                        <div className="comment-header">
                          <button type="button" className="reviewer-profile" onClick={() => reviewerId && navigate("/user/" + reviewerId)} disabled={!reviewerId}>
                            <div className="comment-avatar">
                              {imageUrl ? <img src={imageUrl} alt={reviewerName} /> : <span>{reviewerName?.charAt(0).toUpperCase() || "U"}</span>}
                            </div>
                            <div className="reviewer-info">
                              <span className="reviewer-name">{reviewerName}</span>
                              {reviewerUsername && <span className="reviewer-username">@{reviewerUsername}</span>}
                            </div>
                          </button>
                          <p className="comment-date">{new Date(rev.createdAt).toLocaleDateString("th-TH")}</p>
                        </div>
                        <div className="comment-content-wrap">
                          <div className="comment-rating-badge">
                            <span className="type-stars">
                              {"⭐".repeat(reviewTab === 'host' ? (rev.hostRating || 0) : (rev.activityRating || 0))}
                            </span>
                          </div>
                          <p className="comment-text">
                            {(reviewTab === 'host' ? rev.hostComment : rev.activityComment)
                              ? '"' + (reviewTab === 'host' ? rev.hostComment : rev.activityComment) + '"'
                              : "ไม่มีความคิดเห็น"}
                          </p>
                        </div>
                        <div className="comment-visibility-row">
                          <span className="visibility-label">
                            {(reviewTab === 'host' ? rev.hostIsPublic : rev.activityIsPublic) ? "สาธารณะ" : "ส่วนตัว"}
                          </span>
                          {isOwner && (
                            <button
                              type="button"
                              className={"comment-toggle-button " + (reviewTab === 'host' ? (rev.hostIsPublic ? "public" : "") : (rev.activityIsPublic ? "public" : ""))}
                              onClick={() => handleToggleCommentVisibility(
                                reviewTab === 'host' ? rev.hostCommentId : rev.activityCommentId,
                                reviewTab === 'host' ? rev.hostIsPublic : rev.activityIsPublic
                              )}
                              aria-pressed={reviewTab === 'host' ? rev.hostIsPublic : rev.activityIsPublic}
                            >
                              <span className="toggle-thumb" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="show-more-container" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  {filteredReviews.length > visibleReviews && (
                    <button
                      className="show-more-btn"
                      onClick={() => setVisibleReviews(prev => prev + 5)}
                    >
                      ดูรีวิวเพิ่มเติม ({filteredReviews.length - visibleReviews} รีวิว)
                    </button>
                  )}
                  {visibleReviews > 3 && (
                    <button
                      className="show-more-btn"
                      onClick={() => setVisibleReviews(3)}
                    >
                      แสดงน้อยลง
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="no-comments">ไม่พบรีวิวในหมวดนี้</p>
            )}
          </div>
        )}


        {isOwner && showQR && (
          <div className="qr-owner-section">
            <div className="qr-container">
              <p>QR Code สำหรับยืนยันการเข้าร่วม</p>
              <QRCodeCanvas value={window.location.origin + "/checkin/" + activity.id + "/" + qrToken} size={180} />
              <p className="qr-countdown">🔄 QR Code จะเปลี่ยนใหม่ใน {qrCountdown} วินาที</p>
              {activity.checkinStart && activity.checkinEnd && <p className="checkin-time-info">⏰ เช็คอินได้ {activity.checkinStart} - {activity.checkinEnd}</p>}
            </div>
          </div>
        )}
        {/* Badge และปุ่มสถานะด้านล่าง */}
        {activity.status === "suspended" ? (
          <div className="join-section">
            <button className="join-btn suspended" disabled>
              🚫 กิจกรรมนี้ถูกระงับโดย Admin
            </button>
          </div>
        ) : activityEnded ? (
          <div className="join-section">
            <button className="join-btn ended" disabled>
              กิจกรรมนี้สิ้นสุดแล้ว
            </button>
          </div>
        ) : fromAdmin || isOwner ? null : (
          <div className="join-section">

            {/* เช็คอินแล้ว แต่ยังไม่ได้รีวิว */}
            {joinStatus === "checked_in" && !reviewed && (
              <button
                className="review-btn"
                onClick={() => navigate("/review/" + activity.id)}
              >
                ⭐ รีวิวกิจกรรม
              </button>
            )}

            {/* เช็คอินและรีวิวแล้ว จะไม่แสดงอะไร */}

            {/* กิจกรรมสาธารณะเข้าร่วมแล้ว
        หรือกิจกรรมส่วนตัวได้รับการอนุมัติแล้ว */}
            {joinStatus === "approved" && (
              <>
                <button
                  className="scan-btn"
                  onClick={() => navigate("/scan")}
                >
                  Scan QR Code ยืนยันการเข้าร่วมกิจกรรม
                </button>

                <button
                  className="cancel-btn"
                  onClick={handleCancel}
                >
                  ยกเลิกการเข้าร่วมกิจกรรม
                </button>
              </>
            )}

            {/* กิจกรรมส่วนตัว ส่งคำขอแล้ว */}
            {joinStatus === "pending" && (
              <>
                <button className="join-btn pending" disabled>
                  ส่งคำขอเข้าร่วมกิจกรรมแล้ว
                </button>

                <button
                  className="cancel-btn"
                  onClick={handleCancel}
                >
                  ยกเลิกคำขอ
                </button>
              </>
            )}

            {/* ยังไม่ได้เข้าร่วม หรือเคยยกเลิก */}
            {(joinStatus === null || joinStatus === "cancelled") && (
              <>
                {Number(activity.joinedCount || 0) >=
                  Number(activity.participantCount || 0) ? (
                  <button className="join-btn joined" disabled>
                    กิจกรรมเต็มแล้ว
                  </button>
                ) : (
                  <button
                    className="join-btn"
                    onClick={handleJoin}
                    disabled={joinLoading}
                  >
                    {joinLoading
                      ? "กำลังส่ง..."
                      : "เข้าร่วมกิจกรรม"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {showReportModal && (
          <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">รายงานกิจกรรม</h3>
              <p className="modal-subtitle">เลือกเหตุผลที่รายงาน</p>
              <div className="reason-list">
                {reportReasons.map((r) => (
                  <div key={r} className={"reason-item " + (reportReason === r ? "selected" : "")} onClick={() => setReportReason(r)}>
                    {reportReason === r ? "● " : "○ "}{r}
                  </div>
                ))}
              </div>
              {reportReason === "อื่นๆ" && (
                <div className="other-reason-wrap">
                  <p className="other-reason-lbl">โปรดระบุเหตุผลเพิ่มเติม</p>
                  <textarea className="other-reason-input" placeholder="ระบุเหตุผลที่นี่..." value={otherReason} onChange={(e) => setOtherReason(e.target.value)} />
                </div>
              )}
              <div className="modal-actions">
                <button className="modal-cancel-btn" onClick={() => { setShowReportModal(false); setReportReason(""); setOtherReason(""); }}>ยกเลิก</button>
                <button className="modal-report-btn" onClick={handleReport} disabled={reportLoading || (reportReason === "อื่นๆ" && !otherReason.trim())}>
                  {reportLoading ? "กำลังส่ง..." : "รายงาน"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityDetail;
