import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ActivitySummaryDetail.css";
import API_URL from "../config";
import { formatDateTime ,formatTime, formatDate } from "../utils/formatDate";

function ActivitySummaryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [rating, setRating] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [showAllCheckedIn, setShowAllCheckedIn] = useState(false);
  const [visibleReviews, setVisibleReviews] = useState(3);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = localStorage.getItem("token");

        let user = null;
        try {
          const userRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            user = await userRes.json();
          }
        } catch (err) {
          console.log("Error checking user context:", err);
        }

        const [actRes, ratingRes, partRes, revRes, participantsRes] = await Promise.all([
          fetch(`${API_URL}/api/activities/${id}`),
          fetch(`${API_URL}/api/review/activity/${id}/rating`),
          fetch(`${API_URL}/api/activities/${id}/summary-participants`),
          fetch(`${API_URL}/api/review/activity/${id}/detailed-reviews`),
          fetch(`${API_URL}/api/activities/${id}/participants`)
        ]);

        if (!actRes.ok) {
          if (actRes.status === 404) setNotFound(true);
          return;
        }

        const activityData = await actRes.json();
        setActivity(activityData);

        if (ratingRes.ok) {
          const ratingData = await ratingRes.json();
          setRating(ratingData);
        }

        if (partRes.ok) {
          const attendanceData = await partRes.json();
          setAttendance(attendanceData);
        }

        if (revRes.ok) {
          const revData = await revRes.json();
          setReviews(Array.isArray(revData) ? revData : revData.reviews || []);
        }

        if (participantsRes.ok) {
          const pData = await participantsRes.json();
          setParticipants(Array.isArray(pData) ? pData : []);
        }

        if (user && activityData.createdBy === user.id) {
          setIsOwner(true);
        } else {
          setLoading(false);
          navigate("/");
          return;
        }
      } catch (err) {
        console.error("Error fetching summary details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  if (loading) return <div className="detail-loading">กำลังโหลดข้อมูล...</div>;
  if (notFound || !activity) return <div className="detail-loading">ไม่พบข้อมูลสรุปผลกิจกรรม</div>;

  const total = attendance?.totalJoined || 0;
  const checkedIn = attendance?.checkedIn?.length || 0;
  const notCheckedIn = attendance?.approved?.length || 0;
  const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  // คำนวณคะแนนเฉลี่ยของผู้จัด (Host) จากรีวิวทั้งหมดในกิจกรรมนี้
  const hostRatings = reviews
    .map((r) => r.hostRating)
    .filter((v) => v !== null && v !== undefined);
  const avgHostRating = hostRatings.length > 0
    ? (hostRatings.reduce((sum, v) => sum + v, 0) / hostRatings.length).toFixed(1)
    : "0.0";


  return (
    <div className="detail-mobile-container">
      {/* 1. Header Navigation */}
      <div className="detail-header">
        <div className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <h2>สรุปผลกิจกรรม</h2>
        <div className="header-space"></div>
      </div>

      {/* 2. Activity Profile Section */}
      <div className="activity-profile-section">
        <div className="profile-img-wrap">
          {activity.cover ? (
            <img
              src={activity.cover.startsWith("http") ? activity.cover : `${API_URL}/uploads/${activity.cover}`}
              alt={activity.activityName}
              className="profile-img"
            />
          ) : (
            <div className="profile-img-placeholder" />
          )}
        </div>
        <div className="profile-info">
          <h3>{activity.activityName}</h3>
          <span className="profile-date">📅 {formatDate(activity.date)}</span>
          <span className="profile-location">📍 {activity.location || "-"}</span>
          <span className="badge-type">
            {activity.activityType === "public" ? "กิจกรรมสาธารณะ" : "กิจกรรมส่วนตัว"}
          </span>
        </div>
      </div>

      {/* 3. สรุปผลการเข้าร่วม */}
      <div className="section-card">
        <div className="section-header-flex">
          <h4 className="section-title">สรุปผลการเข้าร่วมกิจกรรม</h4>
          <span className="opened-seats-badge">เปิดรับ {activity.participantCount || 0} คน</span>
        </div>
        <div className="attendance-overview">
          <div className="attendance-box gray-text">
            <span className="box-label">เข้าร่วมทั้งหมด</span>
            <span className="box-value">{total} <small>คน</small></span>
          </div>
          <div className="attendance-box green-text">
            <span className="box-label">เช็คอินแล้ว</span>
            <span className="box-value">{checkedIn} <small>คน</small></span>
          </div>
          <div className="attendance-box gray-text">
            <span className="box-label">ยังไม่เช็คอิน</span>
            <span className="box-value">{notCheckedIn} <small>คน</small></span>
          </div>
        </div>
      </div>

      {/* 4. รายชื่อผู้เข้าร่วมทั้งหมด */}
      <div className="section-card">
        <h4 className="section-title">รายชื่อผู้เข้าร่วมทั้งหมด ({participants.length})</h4>
        <div className="participants-avatars-list">
          {participants.length > 0 ? (
            participants
              .slice(0, showAllParticipants ? participants.length : 10)
              .map((p) => {
                const pImage = p.profileImage;
                const imageUrl = pImage
                  ? pImage.startsWith("http") ? pImage : `${API_URL}/uploads/${pImage}`
                  : null;

                return (
                  <div
                    key={p.id}
                    className="participant-avatar-item"
                    title={`${p.name} (@${p.username || ""})`}
                    onClick={() => navigate(`/user/${p.id}`)}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={p.name} />
                    ) : (
                      <div className="avatar-placeholder">{p.name?.charAt(0).toUpperCase() || "U"}</div>
                    )}
                    <span className="avatar-mini-name">{p.name?.split(" ")[0]}</span>
                  </div>
                );
              })
          ) : (
            <p className="empty-text">ยังไม่มีผู้เข้าร่วมกิจกรรม</p>
          )}
        </div>
        {participants.length > 10 && (
          <div className="show-more-container">
            <button
              className="show-more-btn"
              onClick={() => setShowAllParticipants(!showAllParticipants)}
            >
              {showAllParticipants ? "แสดงน้อยลง" : `ดูเพิ่มเติม (${participants.length - 10} คน)`}
            </button>
          </div>
        )}
      </div>

      {/* 5. รายชื่อผู้เช็คอิน */}
      <div className="section-card">
        <h4 className="section-title">รายชื่อผู้เช็คอิน ({checkedIn})</h4>
        <div className="participants-avatars-list">
          {attendance?.checkedIn?.length > 0 ? (
            attendance.checkedIn
              .slice(0, showAllCheckedIn ? attendance.checkedIn.length : 10)
              .map((p) => {
                const pImage = p.profileImage;
                const imageUrl = pImage
                  ? pImage.startsWith("http") ? pImage : `${API_URL}/uploads/${pImage}`
                  : null;

                return (
                  <div
                    key={p.id}
                    className="participant-avatar-item"
                    title={`${p.name} (@${p.username || ""})`}
                    onClick={() => navigate(`/user/${p.id}`)}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={p.name} />
                    ) : (
                      <div className="avatar-placeholder">{p.name?.charAt(0).toUpperCase() || "U"}</div>
                    )}
                    <span className="avatar-mini-name">{p.name?.split(" ")[0]}</span>
                  </div>
                );
              })
          ) : (
            <p className="empty-text">ไม่มีรายชื่อผู้เช็คอิน</p>
          )}
        </div>
        {attendance?.checkedIn?.length > 10 && (
          <div className="show-more-container">
            <button
              className="show-more-btn"
              onClick={() => setShowAllCheckedIn(!showAllCheckedIn)}
            >
              {showAllCheckedIn ? "แสดงน้อยลง" : `ดูเพิ่มเติม (${attendance.checkedIn.length - 10} คน)`}
            </button>
          </div>
        )}
      </div>

      {/* 6. สรุปผลการรีวิวและความคิดเห็น */}
      <div className="section-card">
        <h4 className="section-title">สรุปผลการรีวิว</h4>

        <div className="review-dashboard">
          <div className="rating-score-box">
            <span className="score-title">คะแนนกิจกรรม</span>
            <div className="score-big">
              {rating?.avgActivityRating || rating?.avgRating || "0.0"} <span className="score-max">/ 5</span>
            </div>
            <div className="stars-row">
              {Array.from({ length: 5 }).map((_, i) => {
                const isActive = i < Math.round(rating?.avgActivityRating || rating?.avgRating || 0);
                return <span key={i} className={`star-icon ${isActive ? 'active' : ''}`}>★</span>;
              })}
            </div>
          </div>
          <div className="divider-vertical"></div>
          <div className="rating-score-box">
            <span className="score-title">คะแนนผู้สร้างกิจกรรม</span>
            <div className="score-big blue-text">
              {avgHostRating} <span className="score-max">/ 5</span>
            </div>
            <div className="stars-row">
              {Array.from({ length: 5 }).map((_, i) => {
                const isActive = i < Math.round(Number(avgHostRating));
                return <span key={i} className={`star-icon ${isActive ? 'active' : ''}`}>★</span>;
              })}
            </div>
          </div>
          <div className="divider-vertical"></div>
          <div className="review-count-box">
            <span className="score-title">จำนวนรีวิว</span>
            <div className="score-big">
              <span className="review-big-num">{rating?.totalReviews || 0} <span className="review-small-label">รีวิว</span></span>
            </div>
            <div className="stars-row" style={{ visibility: 'hidden' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="star-icon">★</span>
              ))}
            </div>
          </div>
        </div>

        <div className="reviews-feed-list">
          <h5 className="sub-section-title">รายละเอียดรีวิวจากผู้เข้าร่วม</h5>
          {reviews.length > 0 ? (
            <>
              {reviews.slice(0, visibleReviews).map((c) => {
                const reviewer = c.user || c.reviewer || {
                  id: c.userId || c.reviewerId
                };
                const reviewerName = reviewer.name || c.userName || c.reviewerName || "ผู้ใช้งานทั่วไป";

                const ratingValue = c.rating !== undefined && c.rating !== null ? c.rating : (c.activityRating || 0);

                const pImage = reviewer.profileImage || c.profileImage;
                const imageUrl = pImage
                  ? pImage.startsWith("http") ? pImage : `${API_URL}/uploads/${pImage}`
                  : null;

                return (
                  <div key={c.id} className="review-feed-item">
                    <div className="review-feed-header">
                      <div
                        className="feed-user-wrap"
                        onClick={() => navigate(`/user/${reviewer.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="feed-avatar-wrap">
                          {imageUrl ? (
                            <img src={imageUrl} alt={reviewerName} className="feed-user-avatar" />
                          ) : (
                            <div className="avatar-placeholder" style={{ width: '100%', height: '100%', fontSize: '0.9rem' }}>
                              {reviewerName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="feed-user-info">
                          <span className="feed-user-name">{reviewerName}</span>
                          <div className="feed-stars-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.6rem', color: '#888', whiteSpace: 'nowrap' }}>กิจกรรม:</span>
                              <div className="stars-row">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const isActive = i < ratingValue;
                                  return <span key={i} className={`star-icon ${isActive ? 'active' : ''}`}>★</span>;
                                })}
                              </div>
                            </div>
                            <span style={{ color: '#ddd', fontSize: '0.8rem' }}>|</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.6rem', color: '#888', whiteSpace: 'nowrap' }}>ผู้สร้างกิจกรรม:</span>
                              <div className="stars-row">
                                {Array.from({ length: 5 }).map((_, i) => {
                                  const isActive = i < (c.hostRating || 0);
                                  return <span key={i} className={`star-icon ${isActive ? 'active' : ''}`}>★</span>;
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="feed-comment-section" style={{ paddingLeft: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{
                          backgroundColor: '#fcfbfa',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          borderLeft: '3px solid #7d5fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          borderRight: '1px solid #eee',
                          borderTop: '1px solid #eee',
                          borderBottom: '1px solid #eee'
                        }}>
                          <p className="feed-comment-text" style={{ marginBottom: '0', paddingLeft: '0' }}>
                            <strong style={{ fontSize: '0.7rem', color: '#7d5fff', display: 'block', marginBottom: '2px' }}>กิจกรรม:</strong> {c.activityComment ? `"${c.activityComment}"` : "ไม่มีความคิดเห็น"}
                          </p>
                        </div>
                        <div style={{
                          backgroundColor: '#fcfbfa',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          borderLeft: '3px solid #0369a1',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          borderRight: '1px solid #eee',
                          borderTop: '1px solid #eee',
                          borderBottom: '1px solid #eee'
                        }}>
                          <p className="feed-comment-text" style={{ marginBottom: '0', paddingLeft: '0' }}>
                            <strong style={{ fontSize: '0.7rem', color: '#0369a1', display: 'block', marginBottom: '2px' }}>ผู้สร้างกิจกรรม:</strong> {c.hostComment ? `"${c.hostComment}"` : "ไม่มีความคิดเห็น"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="feed-footer-row">
                      <span className="feed-date">
                        {formatDateTime(c.createdAt)}
                      </span>
                      {isOwner && (
                        <span className={`visibility-badge ${c.isPublic ? "public-type" : "private-type"}`}>
                          {c.isPublic ? "แสดงสาธารณะ" : "เห็นเฉพาะเจ้าของ"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {reviews.length > visibleReviews ? (
                <div className="show-more-container">
                  <button
                    className="show-more-btn"
                    onClick={() => setVisibleReviews(prev => prev + 5)}
                  >
                    ดูรีวิวเพิ่มเติม ({reviews.length - visibleReviews} รีวิว)
                  </button>
                </div>
              ) : (
                visibleReviews > 3 && (
                  <div className="show-more-container">
                    <button
                      className="show-more-btn"
                      onClick={() => setVisibleReviews(3)}
                    >
                      แสดงน้อยลง
                    </button>
                  </div>
                )
              )}
            </>
          ) : (
            <p className="empty-text">ยังไม่มีรีวิวสำหรับกิจกรรมนี้</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivitySummaryDetail;
