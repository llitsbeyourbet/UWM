import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ActivitySummary.css";
import API_URL from "../config";

function ActivitySummary() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // เพิ่ม State สำหรับระบุการค้นหาและตัวกรองตามหน้า UI ในรูป
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        // 1. ดึงข้อมูลผู้ใช้ปัจจุบัน
        const userRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) {
          navigate("/login");
          return;
        }
        const userData = await userRes.json();

        // 2. ดึงกิจกรรมทั้งหมดที่ผู้ใช้คนนี้สร้าง
        const actRes = await fetch(`${API_URL}/api/activities/user/${userData.id}`);
        if (!actRes.ok) throw new Error("ไม่สามารถดึงข้อมูลกิจกรรมได้");
        const userActivities = await actRes.json();

        // 3. สำหรับแต่ละกิจกรรม ดึงคะแนนและจำนวนผู้เข้าร่วม
        const activitiesWithStats = await Promise.all(
          userActivities.map(async (act) => {
            try {
              const [ratingRes, detailRes] = await Promise.all([
                fetch(`${API_URL}/api/review/activity/${act.id}/rating`),
                fetch(`${API_URL}/api/activities/${act.id}`),
              ]);

              const ratingData = ratingRes.ok ? await ratingRes.json() : { avgRating: 0, totalReviews: 0 };
              const detailData = detailRes.ok ? await detailRes.json() : { joinedCount: 0, participantCount: 0 };

              return {
                id: act.id,
                activityName: act.activityName,
                cover: act.cover,
                date: act.date || "ไม่ระบุวันที่", // สมมติว่าใน act มีฟิลด์ date หรือสร้างไว้รองรับ UI
                review: ratingData.avgRating || "0.0",
                totalReview: ratingData.totalReviews || 0,
                checkedIn: detailData.joinedCount || 0,
                totalJoin: detailData.participantCount || 0,
              };
            } catch (err) {
              console.error(`Error fetching stats for activity ${act.id}:`, err);
              return {
                id: act.id,
                activityName: act.activityName,
                cover: act.cover,
                date: act.date || "ไม่ระบุวันที่",
                review: "0.0",
                totalReview: 0,
                checkedIn: 0,
                totalJoin: 0,
              };
            }
          })
        );

        setActivities(activitiesWithStats);
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลสรุปผล");
      } finally {
        loading && setLoading(false);
      }
    };

    fetchSummary();
  }, [navigate]);

  // ฟังก์ชันกรองข้อมูลตามคำค้นหา (Search)
  const filteredActivities = activities.filter((item) =>
    item.activityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="summary-mobile-container">
      {/* ส่วนหัวหน้าจอ */}
      <div className="summary-header">
        <div className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <h2>สรุปผลกิจกรรม</h2>
        <div className="header-space" />
      </div>

      {/* ส่วนค้นหาและตัวกรอง */}
      <div className="search-filter-section">
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="ค้นหากิจกรรม"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* รายการกิจกรรม */}
      {filteredActivities.length === 0 ? (
        <div className="summary-empty">ไม่พบข้อมูลสรุปผลกิจกรรม</div>
      ) : (
        <div className="summary-list">
          {filteredActivities.map((item) => (
            <div className="summary-card" key={item.id}>
              {/* รูปภาพปกกิจกรรมทรงโค้งมน */}
              <div className="summary-img-wrap">
                {item.cover ? (
                  <img
                    src={item.cover.startsWith("http") ? item.cover : `${API_URL}/uploads/${item.cover}`}
                    alt={item.activityName}
                    className="summary-img"
                  />
                ) : (
                  <div className="summary-img-placeholder" />
                )}
              </div>

              {/* รายละเอียดข้อมูลกิจกรรม */}
              <div className="summary-info">
                <h3>{item.activityName}</h3>
                <span className="activity-date">{item.date}</span>
                
                <div className="stats-row">
                  <span className="stat-star">★</span>
                  <span className="stat-rating">
                    {item.totalReview > 0 ? (
                      <><strong>{item.review}</strong> <span className="review-count">({item.totalReview} รีวิว)</span></>
                    ) : (
                      <span className="no-review">ยังไม่มีรีวิว</span>
                    )}
                  </span>
                </div>

                <div className="stats-row">
                  <span className="stat-check">✔</span>
                  <span className="stat-users">
                    เช็คอิน <span className="checked-in-count">{item.checkedIn}</span> / {item.totalJoin} คน
                  </span>
                </div>
              </div>

              {/* ปุ่มดูสรุปขวามือสไตล์มินิมอล */}
              <button
                className="summary-btn"
                onClick={() => navigate(`/activity-summary/${item.id}`)}
              >
                ดูสรุป <span>→</span>
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default ActivitySummary;