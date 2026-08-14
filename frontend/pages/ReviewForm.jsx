import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/ReviewForm.css";

function ReviewForm() {
  const navigate = useNavigate();
  const { activityId } = useParams();
  const [activity, setActivity] = useState(null);
  const [activityRating, setActivityRating] = useState(0);
  const [hostRating, setHostRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hostComment, setHostComment] = useState("");
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
        body: JSON.stringify({ activityRating, hostRating, comment, hostComment }),
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
        
        {/* Comment Activity */}
        <div className="review-card yellow">
          <p className="review-card-sub">ความคิดเห็นต่อกิจกรรม <span className="optional">(ไม่บังคับ)</span></p>
          <textarea
            className="review-textarea"
            placeholder="กิจกรรมนี้เป็นอย่างไรบ้าง? แชร์ให้เพื่อน ๆ ฟังหน่อย!"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Rate Host */}
        <div className="review-card blue">
          <p className="review-card-sub">ผู้สร้างกิจกรรม</p>
          <p className="review-card-title">ให้คะแนนผู้สร้างกิจกรรม</p>
          <StarRating value={hostRating} onChange={setHostRating} labels={hostLabels} />
        </div>

        

        {/* Comment Host */}
        <div className="review-card blue">
          <p className="review-card-sub">ความคิดเห็นต่อผู้สร้างกิจกรรม <span className="optional">(ไม่บังคับ)</span></p>
          <textarea
            className="review-textarea"
            placeholder="ผู้สร้างกิจกรรมดูแลดีไหม? ให้คำแนะนำถึงผู้สร้างกิจกรรมได้ที่นี่"
            value={hostComment}
            onChange={(e) => setHostComment(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit */}
        <button className="review-submit-btn" onClick={handleSubmit} disabled={loading}>
          {loading ? "กำลังส่ง..." : "ส่งรีวิว"}
        </button>

      </div>
    </div>
  );
}

export default ReviewForm;