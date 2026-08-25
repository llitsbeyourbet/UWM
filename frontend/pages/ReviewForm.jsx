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

  const activityLabels = [
    "",
    "แย่มาก",
    "พอใช้",
    "ดี",
    "ดีมาก",
    "ยอดเยี่ยม",
  ];

  const hostLabels = [
    "",
    "ควรปรับปรุง",
    "พอใช้",
    "ดี",
    "เป็นมิตรมาก",
    "ยอดเยี่ยม",
  ];

  /* =========================
     LOAD ACTIVITY
  ========================= */

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/activities/${activityId}`
        );

        const data = await res.json();

        if (!res.ok) {
          alert(data.message || "ไม่พบข้อมูลกิจกรรม");
          navigate(-1);
          return;
        }

        setActivity(data);
      } catch (err) {
        console.log(err);
      }
    };

    fetchActivity();
  }, [activityId, navigate]);

  /* =========================
     SUBMIT
  ========================= */

  const handleSubmit = async () => {
    if (!activityRating) {
      alert("กรุณาให้คะแนนกิจกรรม");
      return;
    }

    if (!hostRating) {
      alert("กรุณาให้คะแนนผู้สร้างกิจกรรม");
      return;
    }

    const token = sessionStorage.getItem("token");

    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/review/${activityId}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            activityRating,
            hostRating,
            comment,
            hostComment,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      alert("ส่งรีวิวสำเร็จ ขอบคุณสำหรับความคิดเห็น 🎉");

      navigate(-1);
    } catch (err) {
      console.log(err);

      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     STAR COMPONENT
  ========================= */

  const StarRating = ({
    value,
    onChange,
    labels,
    type,
  }) => {
    return (
      <div className="review-star-section">

        <div className={`review-stars ${type}`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              type="button"
              key={star}
              className={`review-star ${
                star <= value ? "active" : ""
              }`}
              onClick={() => onChange(star)}
              aria-label={`${star} ดาว`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="review-rating-text">
          {value > 0 ? (
            <>
              <strong>
                {value}/5
              </strong>

              <span>
                {labels[value]}
              </span>
            </>
          ) : (
            <span>
              แตะดาวเพื่อให้คะแนน
            </span>
          )}
        </div>

      </div>
    );
  };

  /* =========================
     FORMAT
  ========================= */

  const formatActivityDate = (date) => {
    if (!date) return "-";

    const d = new Date(`${date}T00:00:00`);

    if (Number.isNaN(d.getTime())) {
      return date;
    }

    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatActivityTime = (time) => {
    if (!time) return "";

    return String(time).slice(0, 5);
  };

  /* ========================= */

  if (!activity) {
    return (
      <div className="review-loading">
        <div className="review-loading-spinner" />
        <p>กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="review-page">

      {/* ================= HEADER ================= */}

      <header className="review-header">

        <button
          type="button"
          className="review-back-btn"
          onClick={() => navigate(-1)}
          aria-label="ย้อนกลับ"
        >
          <span className="material-icons">
            arrow_back
          </span>
        </button>

        <div className="review-header-text">
          <h1>รีวิวกิจกรรม</h1>

          <p>
            แบ่งปันประสบการณ์ของคุณ
            เพื่อช่วยพัฒนากิจกรรมให้ดียิ่งขึ้น
          </p>
        </div>

      </header>


      <main className="review-content">

        {/* ================= ACTIVITY INFO ================= */}

        <section className="review-activity-card">

          <div className="review-activity-image">

            {activity.cover ? (
              <img
                src={activity.cover}
                alt={activity.activityName}
              />
            ) : (
              <div className="review-no-image">
                <span className="material-icons">
                  celebration
                </span>
              </div>
            )}

          </div>


          <div className="review-activity-info">

            <span className="review-activity-badge">
              กิจกรรม
            </span>

            <h2>
              {activity.activityName}
            </h2>

            <div className="review-activity-detail">

              <span className="material-icons">
                calendar_today
              </span>

              <p>
                {formatActivityDate(activity.date)}
              </p>

            </div>


            {(activity.time || activity.endTime) && (
              <div className="review-activity-detail">

                <span className="material-icons">
                  schedule
                </span>

                <p>
                  {formatActivityTime(activity.time)}

                  {activity.endTime &&
                    ` - ${formatActivityTime(
                      activity.endTime
                    )}`}
                </p>

              </div>
            )}


            <div className="review-activity-detail">

              <span className="material-icons">
                location_on
              </span>

              <p>
                {activity.location || "-"}
              </p>

            </div>

          </div>

        </section>


        {/* ============================================
            REVIEW ACTIVITY
        ============================================ */}

        <section className="review-section activity-review-section">

          <div className="review-section-heading">

            <div className="review-section-icon activity-icon">
              <span className="material-icons">
                star
              </span>
            </div>

            <div className="review-section-title">

              <div>
                <h2>
                  ให้คะแนนกิจกรรม
                </h2>

                <span className="required-badge">
                  จำเป็น
                </span>
              </div>

              <p>
                ประสบการณ์ของคุณกับกิจกรรมนี้เป็นอย่างไร
              </p>

            </div>

          </div>


          <StarRating
            value={activityRating}
            onChange={setActivityRating}
            labels={activityLabels}
            type="activity-stars"
          />


          <div className="review-comment-box">

            <div className="review-comment-header">

              <label htmlFor="activity-comment">
                ความคิดเห็นต่อกิจกรรม
              </label>

              <span>ไม่บังคับ</span>

            </div>

            <textarea
              id="activity-comment"
              className="review-textarea"
              placeholder="กิจกรรมนี้เป็นอย่างไรบ้าง? แชร์ประสบการณ์ให้เพื่อน ๆ ฟังหน่อย"
              value={comment}
              onChange={(e) =>
                setComment(e.target.value)
              }
              maxLength={500}
              rows={4}
            />

            <div className="review-character-count">
              {comment.length}/500
            </div>

          </div>

        </section>


        {/* ============================================
            REVIEW HOST
        ============================================ */}

        <section className="review-section host-review-section">

          <div className="review-section-heading">

            <div className="review-section-icon host-icon">
              <span className="material-icons">
                person
              </span>
            </div>

            <div className="review-section-title">

              <div>
                <h2>
                  ให้คะแนนผู้สร้างกิจกรรม
                </h2>

                <span className="required-badge host">
                  จำเป็น
                </span>
              </div>

              <p>
                ผู้สร้างกิจกรรมดูแลและจัดกิจกรรมเป็นอย่างไร
              </p>

            </div>

          </div>


          <StarRating
            value={hostRating}
            onChange={setHostRating}
            labels={hostLabels}
            type="host-stars"
          />


          <div className="review-comment-box">

            <div className="review-comment-header">

              <label htmlFor="host-comment">
                ความคิดเห็นต่อผู้สร้างกิจกรรม
              </label>

              <span>ไม่บังคับ</span>

            </div>

            <textarea
              id="host-comment"
              className="review-textarea"
              placeholder="ผู้สร้างกิจกรรมดูแลดีไหม? ฝากคำแนะนำหรือความคิดเห็นได้ที่นี่"
              value={hostComment}
              onChange={(e) =>
                setHostComment(e.target.value)
              }
              maxLength={500}
              rows={4}
            />

            <div className="review-character-count">
              {hostComment.length}/500
            </div>

          </div>

        </section>


        {/* ================= SUBMIT ================= */}

        <button
          type="button"
          className="review-submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          <span className="material-icons">
            send
          </span>

          {loading
            ? "กำลังส่งรีวิว..."
            : "ส่งรีวิว"}
        </button>

      </main>

    </div>
  );
}

export default ReviewForm;