import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Search.css";

function Search() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activities, setActivities] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");

  const categories = ["ทั้งหมด", "กีฬา", "ดนตรี", "ภาพยนตร์", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่"];

  const categoryEmoji = {
    "ทั้งหมด": "🌟",
    "กีฬา": "⚽",
    "ดนตรี": "🎵",
    "ภาพยนตร์":"🎥",
    "ท่องเที่ยว": "🏔",
    "อาหาร": "🍜",
    "ศิลปะ": "🎨",
    "เกม": "🎮",
    "คาเฟ่": "☕",
  };

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities`);
        const data = await res.json();
        setActivities(data);
        setFiltered(data);
      } catch (err) {
        console.log(err);
      }
    };
    fetchActivities();
  }, []);

  // 👈 แก้ useEffect ให้กรองตาม category ด้วย
  useEffect(() => {
    let result = activities.filter((item) => item.status !== "suspended");
    
    if (activeCategory !== "ทั้งหมด") {
      result = result.filter((item) => item.category === activeCategory);
    }

    if (search) {
      result = result.filter((item) =>
        item.activityName.toLowerCase().includes(search.toLowerCase())
      );
    }
    result = result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    setFiltered(result);
  }, [search, activities, activeCategory]);

  const handleViewDetail = (activity) => {
    navigate(`/activity-detail?id=${activity.id}`);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div className="search-page">
      {/* ช่องค้นหา */}
      <div className="search-header">
        <div className="search-input-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="ค้นหากิจกรรม..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* หมวดหมู่ */}
      <div className="category-section">
        <p className="category-label">หมวดหมู่</p>
        <div className="category-list">
          {categories.map((cat) => (
            <div
              key={cat}
              className={`category-chip ${activeCategory === cat ? "active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {categoryEmoji[cat]} {cat}
            </div>
          ))}
        </div>
      </div>

      {/* รายการกิจกรรม */}
      <div className="activity-list">
        {filtered.length === 0 ? (
          <p className="empty-text">ไม่พบกิจกรรม</p>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="activity-card" onClick={() => handleViewDetail(item)}>
              {item.cover ? (
                <img src={item.cover} alt="cover" className="card-cover" />
              ) : (
                <div className="card-cover-placeholder" />
              )}
              <div className="card-body">
                <p className="card-title">{item.activityName}</p>
                <p className="card-info">📍 {item.location || "-"} &nbsp;·&nbsp; 👥 {item.participantCount} คน</p>
                <p className="card-date">{formatDate(item.date)} · {item.time || "-"} - {item.endTime || "-"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Search;