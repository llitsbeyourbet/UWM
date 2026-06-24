import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const user = JSON.parse(localStorage.getItem("user"));

  const categories = ["ทั้งหมด", "กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่"];

  const categoryEmoji = {
    "ทั้งหมด": "",
    "กีฬา": "⚽",
    "ดนตรี": "🎵",
    "ท่องเที่ยว": "🏔",
    "อาหาร": "🍜",
    "ศิลปะ": "🎨",
    "เกม": "🎮",
    "คาเฟ่": "☕",
  };
 

  const cardColors = ["#FFF176", "#B8E0FF", "#C8F5C8", "#E8D5F5", "#FFB3C6"];
  const cardEmojis = {
    "ทั้งหมด": "",
    "กีฬา": "⚽",
    "ดนตรี": "🎵",
    "ท่องเที่ยว": "🏔",
    "อาหาร": "🍜",
    "ศิลปะ": "🎨",
    "เกม": "🎮",
    "คาเฟ่": "☕", };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch("${API_URL}/api/activities");
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
    localStorage.setItem("currentActivity", JSON.stringify(activity));
    navigate("/activity-detail");
  };

  const filtered = activities
    .filter((item) => item.status !== "suspended")
    .filter((item) => activeCategory === "ทั้งหมด" || item.category === activeCategory)
    .filter((item) => item.activityName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="home">

      {/* Header */}
      <div className="home-header">
        <div>
          <p className="home-greeting">สวัสดี 👋</p>
          <p className="home-username">@{user?.username || "ผู้ใช้งาน"}</p>
        </div>
        <div className="home-icons">
          <div className="icon-btn" onClick={() => navigate("/search")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div className="icon-btn" onClick={() => navigate("/notifications")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="home-title">
        <h1>Discover,<br/>Create, <em>Enjoy</em></h1>
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
                {item.cover ? (
                  <img src={`${API_URL}/uploads/${item.cover}`} alt="cover" className="card-emoji-img" />
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