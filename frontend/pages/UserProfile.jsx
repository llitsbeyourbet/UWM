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

        // ดึงคะแนนผู้จัด
        const ratingRes = await fetch(`${API_URL}/api/review/host/${id}`);
        const ratingData = await ratingRes.json();
        setHostRating(ratingData.avgRating);
        } catch (err) {
        console.log(err);
        }
    };

    fetchData();
    }, [id]);

  if (!user) return <div>กำลังโหลด...</div>;

  return (
    <div className="user-profile-page">

        <div className="user-cover">
        <button
            className="user-back-btn"
            onClick={() => navigate(-1)}
        >
            ←
        </button>
        </div>

        <div className="user-profile-card">

        <div className="user-avatar">
            {user.profileImage ? (
            <img src={user.profileImage} alt="profile" />
            ) : (
            <div className="user-avatar-placeholder">
                {user.name?.charAt(0).toUpperCase()}
            </div>
            )}
        </div>

        <h2 className="user-name">{user.name}</h2>

        <p className="user-username">@{user.username}</p>

        {hostRating && (
            <div className="user-rating">
            ⭐ {hostRating}
            </div>
        )}

        {user.bio && (
            <p className="user-bio">{user.bio}</p>
        )}

        <div className="user-stats">

            <div className="stat-item">
            <h3>{activities.length}</h3>
            <p>กิจกรรม</p>
            </div>

        </div>

        <div className="user-section">

            <h3>กิจกรรมที่สร้าง</h3>

            {activities.length === 0 ? (

            <p className="empty-text">
                ยังไม่มีกิจกรรม
            </p>

            ) : (

            activities.map((activity) => (

                <div
                key={activity.id}
                className="user-activity-card"
                onClick={() => navigate(`/activity?id=${activity.id}`)}
                >

                {activity.cover && (
                    <img
                    src={activity.cover}
                    alt=""
                    className="user-activity-cover"
                    />
                )}

                <div className="user-activity-title">
                    {activity.activityName}
                </div>

                <div className="user-activity-detail">
                    📍 {activity.location}
                </div>

                <div className="user-activity-detail">
                    📅 {activity.date} {activity.time}
                </div>

                </div>

            ))

            )}

        </div>

        </div>

    </div>
    );
}

export default UserProfile;