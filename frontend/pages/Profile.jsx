import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("created");
  const [createdActivities, setCreatedActivities] = useState([]);
  const [joinedActivities, setJoinedActivities] = useState([]);
  const [hostRating, setHostRating] = useState(null); // 👈 เพิ่ม

  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // ดึง user จาก API
        const userRes = await fetch("${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) {
          navigate("/login");
          return;
        }
        const userData = await userRes.json();
        setUser(userData);

        // ดึงกิจกรรมที่สร้าง
        const actRes = await fetch("${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/activities");
        const actData = await actRes.json();
        const created = actData.filter((a) => a.createdBy === userData.id);
        setCreatedActivities(created);

        // ดึงกิจกรรมที่ checked_in
        const joinRes = await fetch("${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/join/checked-in", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const joinData = await joinRes.json();
        setJoinedActivities(joinData);

        // 👈 ดึงคะแนน host จาก API
        const ratingRes = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/review/host/${userData.id}`);
        const ratingData = await ratingRes.json();
        setHostRating(ratingData.avgRating);

      } catch (err) {
        console.log(err);
        navigate("/login");
      }
    };

    fetchAll();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleViewDetail = (activity) => {
    localStorage.setItem("currentActivity", JSON.stringify(activity));
    navigate("/activity-detail");
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ");
    return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const ActivityCard = ({ item }) => (
    <div className="profile-activity-card" onClick={() => handleViewDetail(item)}>
      {item.cover ? (
        <img src={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/uploads/${item.cover}`} alt="cover" className="profile-card-img" />
      ) : (
        <div className="profile-card-placeholder" />
      )}
      <div className="profile-card-overlay">
        <p className="profile-card-name">{item.activityName}</p>
        <p className="profile-card-location">📍 {item.location || "-"}</p>
      </div>
    </div>
  );

  if (!user) return <div className="profile-loading">กำลังโหลด...</div>;

  return (
    <div className="profile-page">

      {/* Header */}
      <div className="profile-header-bar">
        <p className="profile-header-title">Profile</p>
        <div className="profile-header-icons">
          <div className="profile-icon-btn" onClick={() => navigate("/edit-profile")}>✏️</div>
          <div className="profile-icon-btn">⚙️</div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="profile-card-wrapper">
        <div className="profile-gradient-card">
          <div className="profile-card-inner">
            <div className="profile-avatar-wrap">
              {user?.profileImage ? (
                <img src={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/uploads/${user.profileImage}`} alt="avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-initials">
                  {getInitials(user?.name)}
                </div>
              )}
              <div className="profile-online-dot" />
            </div>
            <div className="profile-info">
              <p className="profile-display-name">{user?.name || "ผู้ใช้งาน"}</p>
              <p className="profile-username">@{user?.username || ""}</p>
              <div className="profile-badges">
                {/* 👈 แสดงคะแนนจริงจาก API */}
                {hostRating && (
                  <span className="badge-host">⭐ HOST {hostRating}</span>
                )}
              </div>
            </div>
          </div>
          {user?.bio && <p className="profile-bio">{user.bio}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats-wrapper">
        <div className="profile-stats-card">
          <div className="stat-item">
            <p className="stat-num">{createdActivities.length}</p>
            <p className="stat-lbl">สร้าง</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <p className="stat-num blue">{joinedActivities.length}</p>
            <p className="stat-lbl">เข้าร่วม</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            {/* 👈 แสดงคะแนนจริงจาก API */}
            <p className="stat-num pink">{hostRating || "-"}</p>
            <p className="stat-lbl">คะแนน</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <div
          className={`profile-tab ${activeTab === "created" ? "active" : ""}`}
          onClick={() => setActiveTab("created")}
        >
          กิจกรรมที่สร้าง
        </div>
        <div
          className={`profile-tab ${activeTab === "joined" ? "active" : ""}`}
          onClick={() => setActiveTab("joined")}
        >
          เข้าร่วมแล้ว
        </div>
      </div>

      {/* Activity Grid */}
      <div className="profile-grid">
        {activeTab === "created" && (
          createdActivities.length === 0 ? (
            <p className="profile-empty">ยังไม่มีกิจกรรมที่สร้าง</p>
          ) : (
            createdActivities.map((item) => <ActivityCard key={item.id} item={item} />)
          )
        )}
        {activeTab === "joined" && (
          joinedActivities.length === 0 ? (
            <p className="profile-empty">ยังไม่มีกิจกรรมที่เข้าร่วม</p>
          ) : (
            joinedActivities.map((item) => <ActivityCard key={item.id} item={item} />)
          )
        )}
      </div>

      {/* Logout */}
      <div style={{ padding: "0 20px 24px" }}>
        <div className="profile-logout-btn" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>ออกจากระบบ</span>
        </div>
      </div>

    </div>
  );
}

export default Profile;