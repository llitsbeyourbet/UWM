import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ActivitySummary.css";
import API_URL from "../config";
import { formatDate } from "../utils/formatDate";
import { useAlert } from "../hooks/useAlert";
import Loading from "../components/Loading";

function ActivitySummary() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // เพิ่ม State สำหรับระบุการค้นหาและตัวกรองตามหน้า UI ในรูป
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const token = sessionStorage.getItem("token");

        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/activities/summary/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          navigate("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("ไม่สามารถดึงข้อมูลสรุปผลได้");
        }

        const data = await response.json();

        setActivities(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);

        await showAlert({
          type: "error",
          title: "เกิดข้อผิดพลาด",
          message: "เกิดข้อผิดพลาดในการดึงข้อมูลสรุปผล",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [navigate]);

  // ฟังก์ชันกรองข้อมูลตามคำค้นหา (Search)
  const filteredActivities = activities.filter((item) =>
    item.activityName.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  if (loading) return <Loading />;

  return (
    <div className="summary-mobile-container">
      {/* ส่วนหัวหน้าจอ */}
      <div className="summary-header">
        <div className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        <h2>สรุปผลกิจกรรม</h2>
        <div className="header-space" />
      </div>

      {/* ส่วนค้นหาและตัวกรอง */}
      <div className="search-filter-section">
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                <span className="activity-date">{formatDate(item.date)}</span>

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
                ดูสรุปผลกิจกรรม
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default ActivitySummary;