import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import API_URL from "../config";

function Home() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");

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

  const cardColors = ["#FFF176", "#B8E0FF", "#C8F5C8", "#E8D5F5", "#FFB3C6"];

  const [username, setUsername] = useState("");

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
        console.log(err);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities`);
        const data = await res.json();
        setActivities(data);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
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
        {loading ? (
          <p className="loading-text">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="empty-text">ไม่พบกิจกรรม</p>
        ) : (
          filtered.map((item, index) => (
            <div
              key={item.id}
              className="home-card"
              style={{ background: cardColors[index % cardColors.length] }}
              onClick={() => handleViewDetail(item)}
            >
              <div className="card-circle" />
              <div className="card-top">
                <div>
                  <span className="card-tag">{item.activityType === "public" ? "สาธารณะ" : "ส่วนตัว"}</span>
                  <p className="card-name">{item.activityName}</p>
                  <p className="card-meta">📍 {item.location || "-"} · {item.date || "-"}</p>
                  <p className="card-meta">👥 {item.participantCount} คน</p>
                </div>
                {/* 👈 แก้ตรงนี้ */}
                {item.cover ? (
                  <img src={item.cover} alt="cover" className="card-emoji-img" />
                ) : (
                  <span className="card-emoji">🎉</span>
                )}
              </div>
              <div className="card-bottom">
                <div className="card-btn">ดูรายละเอียด →</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Home;
