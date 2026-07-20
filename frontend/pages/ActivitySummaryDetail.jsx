import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ActivitySummaryDetail.css";
import API_URL from "../config";

function ActivitySummaryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [rating, setRating] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

        const [actRes, ratingRes, partRes, revRes] = await Promise.all([
          fetch(`${API_URL}/api/activities/${id}`),
          fetch(`${API_URL}/api/review/activity/${id}/rating`),
          fetch(`${API_URL}/api/activities/${id}/summary-participants`),
          fetch(`${API_URL}/api/review/activity/${id}/detailed-reviews`)
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

        if (user && activityData.createdBy === user.id) {
          setIsOwner(true);
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

  return (
    <div className="detail-mobile-container">
      {/* 1. Header Navigation */}
      <div className="detail-header">
        <div className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <h2>สรุปกิจกรรม</h2>
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
          <span className="profile-date">📅 {activity.date ? new Date(activity.date).toLocaleDateString("th-TH") : "-"}</span>
          <span className="profile-location">📍 {activity.location || "-"}</span>
          <span className="badge-type">
            {activity.activityType === "public" ? "กิจกรรมสาธารณะ" : "กิจกรรมส่วนตัว"}
          </span>
        </div>
      </div>

      {/* 3. สรุปผลการเข้าร่วม */}
      <div className="section-card">
        <div className="section-header-flex">
          <h4 className="section-title">สรุปผลการเข้าร่วม</h4>
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

        <div className="attendance-visuals-row">
          <div className="circle-progress-wrap">
            <div className="circle-progress" style={{ background: `conic-gradient(#2ecc71 ${checkInRate}%, #edf2f7 0)` }}>
              <div className="circle-inner">
                <span className="rate-num">{checkInRate}%</span>
                <span className="rate-label">อัตราเช็คอิน</span>
              </div>
            </div>
          </div>
          <div className="attendance-bar-side">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${checkInRate}%` }}></div>
            </div>
            <p className="attendance-calc-hint">สัดส่วนเช็คอิน: <strong>{checkedIn}</strong> จาก <strong>{total}</strong> คน</p>
          </div>
        </div>
      </div>

      {/* 4. รายชื่อผู้เช็คอิน */}
      <div className="section-card">
        <h4 className="section-title">รายชื่อผู้เช็คอิน ({checkedIn})</h4>
        <div className="participants-avatars-list">
          {attendance?.checkedIn?.length > 0 ? (
            attendance.checkedIn.map((p) => {
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
      </div>

      {/* 5. สรุปผลการรีวิวและความคิดเห็น */}
      <div className="section-card">
        <h4 className="section-title">สรุปผลการรีวิว</h4>
        
        <div className="review-dashboard">
          <div className="rating-score-box">
            <span className="score-title">คะแนนกิจกรรม</span>
            <div className="score-big">
              {rating?.avgActivityRating || rating?.avgRating || "0.0"} <span className="score-max">/ 5</span>
            </div>
            <div className="stars-row">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`star-icon ${i < Math.round(rating?.avgActivityRating || rating?.avgRating || 0) ? 'active' : ''}`}>★</span>
              ))}
            </div>
          </div>
          <div className="divider-vertical"></div>
          <div className="review-count-box">
            <span className="score-title">จำนวนรีวิว</span>
            <span className="review-big-num">{rating?.totalReviews || 0} <span className="review-small-label">รีวิว</span></span>
          </div>
        </div>

        {/* รายการฟีดความคิดเห็นที่มีการตรวจจับค่าคะแนนผู้ใช้ถูกต้อง */}
        <div className="reviews-feed-list">
          <h5 className="sub-section-title">รายละเอียดรีวิวจากผู้เข้าร่วม</h5>
          {reviews.length > 0 ? (
            reviews.map((c) => {
              const reviewer = c.user || c.reviewer || {
                id: c.userId || c.reviewerId
              };
              const reviewerName = reviewer.name || c.userName || c.reviewerName || "ผู้ใช้งานทั่วไป";
              
              // ตรวจสอบข้อมูลคะแนนจากฟิลด์
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
                      {/* เปลี่ยนให้รูปวงกลมมีหน้าตาและสีม่วงพาสเทลเหมือนกันกับรายชื่อด้านบน */}
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
                        <div className="feed-stars-row">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`star-icon ${i < ratingValue ? 'active' : ''}`}>★</span> 
                          ))}
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  
                  <p className="feed-comment-text">
                    {c.comment ? `"${c.comment}"` : `ให้คะแนนกิจกรรมนี้ ${ratingValue} ดาว`}
                  </p>

                  <div className="feed-footer-row">
                    <span className="feed-date">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("th-TH") : "-"}</span>
                    {isOwner && (
                      <span className={`visibility-badge ${c.isPublic ? "public-type" : "private-type"}`}>
                        {c.isPublic ? "แสดงสาธารณะ" : "เห็นเฉพาะเจ้าของ"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="empty-text">ยังไม่มีรีวิวสำหรับกิจกรรมนี้</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivitySummaryDetail;