import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ActivitySummaryDetail.css";
import API_URL from "../config";

function ActivitySummaryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [rating, setRating] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = localStorage.getItem("token");
        
        // ถอดแบบการ fetch มาจากไฟล์ ActivityDetail
        const [actRes, ratingRes, partRes, revRes] = await Promise.all([
          fetch(`${API_URL}/api/activities/${id}`),
          fetch(`${API_URL}/api/review/activity/${id}/rating`),
          fetch(`${API_URL}/api/activities/${id}/participants`), // ใช้ endpoint เดียวกับผู้เข้าร่วมในไฟล์ ActivityDetail
          fetch(`${API_URL}/api/review/activity/${id}/comments/public`), // ดึงรีวิวสาธารณะมาแสดงตามภาพ UI
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
          const participantsData = await partRes.json();
          setParticipants(participantsData);
        }

        if (revRes.ok) {
          const revData = await revRes.json();
          // รองรับทั้งแบบ array ตรงๆ และแบบ nesting object ตามพฤติกรรม API ในไฟล์ ActivityDetail
          setReviews(Array.isArray(revData) ? revData : revData.reviews || []);
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

  // ส่วนคำนวณคณิตศาสตร์สำหรับ Dashboard
  const total = activity.participantCount || 0;
  const checkedIn = activity.joinedCount || 0;
  const notCheckedIn = Math.max(0, total - checkedIn);
  const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  return (
    <div className="detail-mobile-container">
      {/* 1. Header Navigation */}
      <div className="detail-header">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
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
        <h4 className="section-title">สรุปผลการเข้าร่วม</h4>
        <div className="attendance-overview">
          <div className="attendance-box green-text">
            <span className="box-label">เช็คอินแล้ว</span>
            <span className="box-value">{checkedIn} <small>คน</small></span>
          </div>
          <div className="circle-progress-wrap">
            <div className="circle-progress" style={{ background: `conic-gradient(#2ecc71 ${checkInRate}%, #edf2f7 0)` }}>
              <div className="circle-inner">
                <span className="rate-num">{checkInRate}%</span>
                <span className="rate-label">อัตราเช็คอิน</span>
              </div>
            </div>
          </div>
          <div className="attendance-box gray-text">
            <span className="box-label">ยังไม่เช็คอิน</span>
            <span className="box-value">{notCheckedIn} <small>คน</small></span>
          </div>
        </div>
        <p className="total-hint-text">จากผู้เข้าร่วมทั้งหมด {total} คน</p>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${checkInRate}%` }}></div>
        </div>
      </div>

      {/* 4. รายชื่อผู้เข้าร่วม/เช็คอิน */}
      <div className="section-card">
        <h4 className="section-title">รายชื่อผู้เช็คอิน ({participants.length})</h4>
        <div className="participants-avatars-list">
          {participants.length > 0 ? (
            participants.map((p) => {
              const pImage = p.profileImage;
              const imageUrl = pImage
                ? pImage.startsWith("http") ? pImage : `${API_URL}/uploads/${pImage}`
                : null;

              return (
                <div key={p.id} className="participant-avatar-item" title={`${p.name} (@${p.username || ""})`}>
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
            <span className="score-title">คะแนนเฉลี่ย</span>
            <div className="score-big">
              {rating?.avgRating || "0.0"} <span className="score-max">/ 5</span>
            </div>
            <div className="stars-row">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`star-icon ${i < Math.round(rating?.avgRating || 0) ? 'active' : ''}`}>★</span>
              ))}
            </div>
          </div>
          <div className="divider-vertical"></div>
          <div className="review-count-box">
            <span className="score-title">จำนวนรีวิว</span>
            <span className="review-big-num">{rating?.totalReviews || 0} <span className="review-small-label">รีวิว</span></span>
          </div>
        </div>

        {/* รายการรีวิวแบบแมปค่าโครงสร้าง User Object ซ้อนแบบเดียวกับไฟล์ ActivityDetail */}
        <div className="reviews-feed-list">
          <h5 className="sub-section-title">ความคิดเห็นจากผู้เข้าร่วม</h5>
          {reviews.length > 0 ? (
            reviews.map((c) => {
              // ดึงโครงสร้างข้อมูลตาม fallback logic ของไฟล์เดเทลหลัก
              const reviewer = c.user || c.reviewer || {};
              const reviewerName = reviewer.name || c.userName || c.reviewerName || "ผู้ใช้งานทั่วไป";
              const ratingValue = c.rating || 0;

              return (
                <div key={c.id} className="review-feed-item">
                  <div className="review-feed-header">
                    <div className="feed-user-info">
                      <span className="feed-user-name">{reviewerName}</span>
                      <div className="feed-stars">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={`feed-star ${i < ratingValue ? 'active' : ''}`}>★</span>
                        ))}
                      </div>
                    </div>
                    <span className="feed-rating-tag">⭐ {ratingValue} ดาว</span>
                  </div>
                  <p className="feed-comment-text">
                    {c.comment ? `"${c.comment}"` : `ให้คะแนนกิจกรรมนี้ ${ratingValue} ดาว`}
                  </p>
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