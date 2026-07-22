import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import API_URL from "../config";

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("created");
  const [createdActivities, setCreatedActivities] = useState([]);
  const [joinedActivities, setJoinedActivities] = useState([]);
  const [hostRating, setHostRating] = useState(null);
  const [showMenu, setShowMenu] = useState(false); // 👈 เพิ่ม

  useEffect(() => {
    const fetchAll = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        const userRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) { navigate("/login"); return; }
        const userData = await userRes.json();
        setUser(userData);

        const actRes = await fetch(`${API_URL}/api/activities/user/${userData.id}`);
        const actData = await actRes.json();
        setCreatedActivities(actData);

        const joinRes = await fetch(`${API_URL}/api/join/checked-in`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJoinedActivities(await joinRes.json());

        const ratingRes = await fetch(`${API_URL}/api/review/host/${userData.id}`);
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
    navigate(`/activity-detail?id=${activity.id}`);
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const ActivityCard = ({ item }) => (
    <div className="profile-activity-card" onClick={() => handleViewDetail(item)}>
      {item.cover ? (
        <img src={item.cover} alt="cover" className="profile-card-img" />
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
    <div className="profile-page" onClick={() => setShowMenu(false)}>

      {/* Header */}
      <div className="profile-header-bar">
        <p className="profile-header-title">Profile</p>
        <div className="profile-header-icons">
          {/* 👈 เอาปุ่ม edit ออก เพิ่ม dropdown แทน */}
          <div className="profile-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="profile-icon-btn" onClick={() => setShowMenu(!showMenu)}>⚙️</div>

            {showMenu && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-item" onClick={() => { setShowMenu(false); navigate("/edit-profile"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  แก้ไขโปรไฟล์
                </div>
                <div className="profile-dropdown-item" onClick={() => { setShowMenu(false); navigate("/activity-summary"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l3-3 3 2 4-5" />
                    <circle cx="7" cy="14" r="1" />
                    <circle cx="10" cy="11" r="1" />
                    <circle cx="13" cy="13" r="1" />
                    <circle cx="17" cy="8" r="1" />
                  </svg>
                  สรุปผลกิจกรรม
                </div>
                <div className="dropdown-divider" />
                <div className="profile-dropdown-item red" onClick={() => { setShowMenu(false); handleLogout(); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  ออกจากระบบ
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Card */}
      <div className="profile-card-wrapper">
        <div className="profile-gradient-card">
          <div className="profile-card-inner">
            <div className="profile-avatar-wrap">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="avatar" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-initials">{getInitials(user?.name)}</div>
              )}

            </div>
            <div className="profile-info">
              <p className="profile-display-name">{user?.name || "ผู้ใช้งาน"}</p>
              <p className="profile-username">@{user?.username || ""}</p>
              <div className="profile-badges">
                {hostRating !== null && (<span className="badge-host">⭐ HOST {hostRating}</span>)}              </div>
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
            <p className="stat-num text-blue">{joinedActivities.length}</p>
            <p className="stat-lbl">เข้าร่วม</p>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <p className="stat-num text-pink">{hostRating !== null ? hostRating : "-"}</p>
            <p className="stat-lbl">คะแนน</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <div className={`profile-tab ${activeTab === "created" ? "active" : ""}`} onClick={() => setActiveTab("created")}>
          กิจกรรมที่สร้าง
        </div>
        <div className={`profile-tab ${activeTab === "joined" ? "active" : ""}`} onClick={() => setActiveTab("joined")}>
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

    </div>
  );
}

export default Profile;