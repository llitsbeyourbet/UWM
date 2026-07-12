import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import API_URL from "../config";

function Home() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [username, setUsername] = useState("");
  const [joinCounts, setJoinCounts] = useState({});
  const [error, setError] = useState(null);

  const categories = ["ทั้งหมด", "กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่"];

  const categoryEmoji = {
    "ทั้งหมด": "🌟",
    "กีฬา": "⚽",
    "ดนตรี": "🎵",
    "ท่องเที่ยว": "🏔",
    "อาหาร": "🍜",
    "ศิลปะ": "🎨",
    "เกม": "🎮",
    "คาเฟ่": "☕",
  };

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUsername(data.username || "");
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };

    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities`);
        if (!res.ok) throw new Error("Failed to fetch activities");
        const data = await res.json();
        setActivities(data);
        fetchJoinCounts(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch activities:", err);
        setError("ไม่สามารถโหลดกิจกรรมได้");
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    const fetchJoinCounts = async (activities) => {
      const counts = {};
      try {
        const results = await Promise.allSettled(
          activities.map(async (item) => {
            const res = await fetch(`${API_URL}/api/join/${item.id}/count`);
            if (!res.ok) throw new Error(`Failed to fetch count for ${item.id}`);
            const data = await res.json();
            return { id: item.id, count: data.count || 0 };
          })
        );

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            counts[result.value.id] = result.value.count;
          } else {
            console.warn("Failed to fetch join count:", result.reason);
          }
        });
      } catch (err) {
        console.error("Error fetching join counts:", err);
      }
      setJoinCounts(counts);
    };

    fetchUser();
    fetchActivities();
  }, []);

  const handleViewDetail = (activity) => {
    navigate(`/activity-detail?id=${activity.id}`);
  };

  const filtered = activities
    .filter((item) => item.status !== "suspended")
    .filter((item) => activeCategory === "ทั้งหมด" || item.category === activeCategory)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="home">

      {/* Header */}
      <div className="home-header">
        <div>
          <p className="home-greeting">สวัสดี 👋</p>
          <p className="home-username">@{username}</p>
        </div>
        <div className="home-icons">
          {/* สแกน QR */}
          <div className="icon-btn scan-btn" onClick={() => navigate("/scan")}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#010101" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7V3h4" />
              <path d="M21 7V3h-4" />
              <path d="M3 17v4h4" />
              <path d="M21 17v4h-4" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="home-title">
        <h1>Discover,<br />Create, <em>Enjoy</em></h1>
        <p>หากิจกรรมสนุก ๆ กับเพื่อนใหม่</p>
      </div>

      {/* Categories */}
      <div className="category-scroll">
        {categories.map((cat) => (
          <div
            key={cat}
            className={`category-pill ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {categoryEmoji[cat]} {cat}
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="home-cards">
        {error && (
          <p className="error-text" style={{ color: "#e53935" }}>❌ {error}</p>
        )}
        {loading ? (
          <p className="loading-text">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="empty-text">ไม่พบกิจกรรม</p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="home-card" onClick={() => handleViewDetail(item)}>
              {/* รูปภาพ */}
              <div className="card-image-wrap">
                {item.cover ? (
                  <img src={item.cover} alt="cover" className="card-image" />
                ) : (
                  <div className="card-image-placeholder">🎉</div>
                )}
                <span className={`card-tag ${item.activityType === "public" ? "tag-public" : "tag-private"}`}>
                  {item.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"}
                </span>
              </div>

              {/* เนื้อหา */}
              <div className="card-content">
                <div className="card-content-top">
                  <p className="card-name">{item.activityName}</p>
                </div>
                <p className="card-meta">📍 {item.location || "-"}</p>
                <p className="card-meta">📅 {item.date || "-"}</p>
                <p className="card-meta">⏰ {item.time || "-"} - {item.endTime || "-"}</p>
                <p className="card-meta">👥 {joinCounts[item.id] ?? 0} / {item.participantCount} คน</p>

                <div className="card-tags">
                  {item.category && (
                    <span className="card-tag-chip">{categoryEmoji[item.category]} {item.category}</span>
                  )}
                </div>

                <div className="card-bottom">
                    <div className="card-days-badge">
                      {(() => {
                        if (!item.date) return "-";
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const eventDate = new Date(item.date);
                        eventDate.setHours(0, 0, 0, 0);
                        const diff = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));
                        if (diff < 0) return "ผ่านไปแล้ว";
                        if (diff === 0) return "🔥 วันนี้";
                        return `📅 อีก ${diff} วัน`;
                      })()}
                    </div>
                    <div className="card-btn">ดูรายละเอียด →</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;
