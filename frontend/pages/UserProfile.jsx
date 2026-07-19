import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./UserProfile.css";

function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const [activities, setActivities] = useState([]);
  const [hostRating, setHostRating] = useState(null);

  const [joinedActivities, setJoinedActivities] = useState([]);
  const [activeTab, setActiveTab] = useState("created");
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
        // ดึงข้อมูลผู้ใช้
        const userRes = await fetch(`${API_URL}/api/auth/user/${id}`);
        const userData = await userRes.json();
        setUser(userData);

        // ดึงกิจกรรมที่สร้าง
        const actRes = await fetch(`${API_URL}/api/activities/user/${id}`);
        const actData = await actRes.json();
        setActivities(actData);

        // ดึงกิจกรรมที่เข้าร่วม
        const joinRes = await fetch(`${API_URL}/api/join/user/${id}`);

        if (joinRes.ok) {
            const joinData = await joinRes.json();
            setJoinedActivities(joinData);
        }

        // ดึงคะแนนผู้จัด
        const ratingRes = await fetch(`${API_URL}/api/review/host/${id}`);
        const ratingData = await ratingRes.json();
        setHostRating(ratingData.avgRating);

        // ดึงรีวิวของผู้ใช้
        const reviewRes = await fetch(
            `${API_URL}/api/review/host/${id}/reviews`
        );

        if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            setReviews(reviewData);
        }

        } catch (err) {
        console.log(err);
        }

    };

    fetchData();
    }, [id]);

  if (!user) return <div>กำลังโหลด...</div>;

  const ActivityCard = ({ item }) => (
    <div
        className="profile-activity-card"
        onClick={() => navigate(`/activity-detail?id=${item.id}`)}
    >
        {item.cover ? (
        <img
            src={
                item.cover.startsWith("http")
                ? item.cover
                : `${API_URL}/uploads/${item.cover}`
            }
            alt=""
            className="profile-card-img"
        />
        ) : (
        <div className="profile-card-placeholder" />
        )}

        <div className="profile-card-overlay">
        <p className="profile-card-name">
            {item.activityName}
        </p>

        <p className="profile-card-location">
            📍 {item.location || "-"}
        </p>
        </div>
    </div>
    );

  return (
    <div className="user-profile-page">

        {/* Header */}
        <div className="profile-header-bar">
        <button
            className="user-back-btn"
            onClick={() => navigate(-1)}
        >
            ‹
        </button>

        <p className="profile-header-title">
            Profile
        </p>

        <div style={{ width: 36 }} />
        </div>

        {/* Profile Card */}
        <div className="profile-card-wrapper">

        <div className="profile-gradient-card">

            <div className="profile-card-inner">

            <div className="profile-avatar-wrap">

                {user.profileImage ? (

                <img 
                    src={
                        user.profileImage.startsWith("http")
                        ? user.profileImage
                        : `${API_URL}/uploads/${user.profileImage}`
                    }
                    alt="profile"
                    className="profile-avatar-img"
                    />

                ) : (

                <div className="profile-avatar-initials">
                    {user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>

                )}

            </div>

            <div className="profile-info">

                <p className="profile-display-name">
                {user.name}
                </p>

                <p className="profile-username">
                @{user.username}
                </p>

                <div className="profile-badges">

                <span className="badge-host">
                    ⭐ HOST {hostRating !== null
                        ? Number(hostRating).toFixed(1)
                        : "-"}
                </span>

                </div>

            </div>

            </div>

            {user.bio && (
            <p className="profile-bio">
                {user.bio}
            </p>
            )}

        </div>

        </div>

        <div className="profile-stats-wrapper">

            <div className="profile-stats-card">

                <div className="stat-item">
                <p className="stat-num">
                    {activities.length}
                </p>
                <p className="stat-lbl">
                    สร้าง
                </p>
                </div>

                <div className="stat-divider" />

                <div className="stat-item">
                <p className="stat-num text-blue">
                    {joinedActivities.length}
                </p>
                <p className="stat-lbl">
                    เข้าร่วม
                </p>
                </div>

                <div className="stat-divider" />

                <div className="stat-item">
                <p className="stat-num text-pink">
                    {hostRating !== null ? Number(hostRating).toFixed(1) : "-"}
                </p>
                <p className="stat-lbl">
                    คะแนน
                </p>
                </div>

            </div>

        </div>

        <div className="profile-tabs">

            <div
                className={`profile-tab ${
                activeTab === "created" ? "active" : ""
                }`}
                onClick={() => setActiveTab("created")}
            >
                กิจกรรมที่สร้าง
            </div>

            <div
                className={`profile-tab ${
                activeTab === "joined" ? "active" : ""
                }`}
                onClick={() => setActiveTab("joined")}
            >
                เข้าร่วมแล้ว
            </div>

        </div>

        <div className="profile-grid">

            {activeTab === "created" && (
                activities.length === 0 ? (
                <p className="profile-empty">
                    ยังไม่มีกิจกรรมที่สร้าง
                </p>
                ) : (
                activities.map((item) => (
                    <ActivityCard
                    key={item.id}
                    item={item}
                    />
                ))
                )
            )}

            {activeTab === "joined" && (
                joinedActivities.length === 0 ? (
                <p className="profile-empty">
                    ยังไม่มีกิจกรรมที่เข้าร่วม
                </p>
                ) : (
                joinedActivities.map((item) => (
                    <ActivityCard
                    key={item.id}
                    item={item}
                    />
                ))
                )
            )}

            

        </div>

    </div>
    );
}

export default UserProfile;