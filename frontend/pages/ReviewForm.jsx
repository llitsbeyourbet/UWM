import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./ReviewForm.css";

function ReviewForm() {
  const navigate = useNavigate();
  const { activityId } = useParams();
  const [activity, setActivity] = useState(null);
  const [activityRating, setActivityRating] = useState(0);
  const [hostRating, setHostRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const activityLabels = ["", "แย่มาก!", "พอใช้", "สนุกมาก!", "ดีมาก!", "เยี่ยมเลย!"];
  const hostLabels = ["", "ไม่ค่อยดี", "พอใช้", "โอเค", "เป็นมิตรมาก!", "ดีที่สุด!"];

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities/${activityId}`);
        const data = await res.json();
        setActivity(data);
      } catch (err) {
        console.log(err);
      }
    };
    fetchActivity();
  }, [activityId]);

  const handleSubmit = async () => {
    if (!activityRating || !hostRating) {
      alert("กรุณาให้คะแนนกิจกรรมและผู้สร้างด้วย");
      return;
    }

    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/review/${activityId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activityRating, hostRating, comment }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      alert("ส่งรีวิวสำเร็จ! ขอบคุณ 🎉");
      navigate(-1);
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const StarRating = ({ value, onChange, labels }) => (
    <div className="star-container">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`star ${star <= value ? "active" : ""}`}
            onClick={() => onChange(star)}
          >
            ★
          </span>
        ))}
      </div>
      {value > 0 && <p className="star-label">{labels[value]}</p>}
    </div>
  );

  if (!activity) return <div className="review-loading">กำลังโหลด...</div>;

  return (
    <div className="review-page">

      {/* Header */}
      <div className="review-header">
        <div className="review-back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <p className="review-header-title">Review</p>
        <div style={{ width: 36 }} />
      </div>

      <div className="review-content">

        {/* Title */}
        <div className="review-title-section">
          <h1 className="review-title">How was your experience? </h1>
        </div>

        {/* Activity Info */}
        <div className="review-activity-card">
          <div className="review-activity-icon">
            {activity.cover ? (
              <img src={activity.cover} alt="cover" className="review-activity-img" />
            ) : (
              <span style={{ fontSize: 28 }}>🎉</span>
            )}
          </div>
          <div>
            <p className="review-activity-name">{activity.activityName}</p>
            <p className="review-activity-meta">{activity.date || "-"} · {activity.location || "-"}</p>
          </div>
        </div>

        {/* Rate Activity */}
        <div className="review-card yellow">
          <p className="review-card-sub">กิจกรรม</p>
          <p className="review-card-title">ให้คะแนนกิจกรรมนี้</p>
          <StarRating value={activityRating} onChange={setActivityRating} labels={activityLabels} />
        </div>

        {/* Rate Host */}
        <div className="review-card blue">
          <p className="review-card-sub">ผู้จัด</p>
          <p className="review-card-title">ให้คะแนนผู้สร้าง</p>
          <StarRating value={hostRating} onChange={setHostRating} labels={hostLabels} />
        </div>

        {/* Comment */}
        <div className="review-card green">
          <p className="review-card-sub">ความคิดเห็น <span className="optional">(ไม่บังคับ)</span></p>
          <textarea
            className="review-textarea"
            placeholder="สนุกมั้ย? แชร์ให้เพื่อน ๆ ฟังหน่อย!"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit */}
        <button className="review-submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "กำลังส่ง..." : "ส่งรีวิว →"}
        </button>

      </div>
    </div>
  );
}

export default ReviewForm;