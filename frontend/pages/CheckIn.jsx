import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/CheckIn.css";
import { formatDate, formatTime } from "../utils/formatDate";

function CheckIn() {
  const navigate = useNavigate();
  const { activityId, qrToken } = useParams();
  const [activity, setActivity] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const actRes = await fetch(`${API_URL}/api/activities/${activityId}`);
        if (!actRes.ok) {
          throw new Error("ไม่พบข้อมูลกิจกรรม");
        }
        const actData = await actRes.json();
        setActivity(actData);

        const statusRes = await fetch(`${API_URL}/api/join/${activityId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!statusRes.ok) {
          throw new Error("ไม่สามารถตรวจสอบสถานะการเข้าร่วมได้");
        }
        const statusData = await statusRes.json();
        setJoinStatus(statusData.status);

        if (statusData.status === "checked_in") {
          setDone(true);
          setJoinStatus("checked_in");
          setAlreadyCheckedIn(true);
        }
      } catch (err) {
        console.log(err);
        setErrorMessage(err.message || "ไม่สามารถโหลดข้อมูลกิจกรรมได้");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activityId]);

  const handleCheckIn = async () => {
    const token = sessionStorage.getItem("token");
    setCheckinLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/join/${activityId}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          qrToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      setDone(true);
      setJoinStatus("checked_in");
      setAlreadyCheckedIn(false);
    } catch (err) {
      setErrorMessage("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setCheckinLoading(false);
    }
  };

  if (errorMessage) {
    return (
      <div className="checkin-page">
        <div className="checkin-card">

          <div className="checkin-icon">
            <div className="icon-error">✕</div>
          </div>

          <h2 className="checkin-title">ไม่สามารถเช็คอินได้</h2>

          <p className="checkin-subtitle">{errorMessage}</p>

          <button
            className="checkin-btn done"
            onClick={() => activity && navigate(`/activity-detail?id=${activity.id}`, { replace: true })}
          >
            กลับหน้ากิจกรรม
          </button>

        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="checkin-page">
      <p className="loading-text">กำลังโหลด...</p>
    </div>
  );
  return (
  <div className="checkin-page">

    {/* Header */}
    <header className="checkin-header">
      <button
        type="button"
        className="checkin-back-btn"
        onClick={() => navigate(-1)}
      >
        <span className="material-icons">
          arrow_back_ios_new
        </span>
      </button>

      <div className="checkin-header-text">
        <h1>
          {done
            ? "เช็คอินสำเร็จ"
            : "ยืนยันการเข้าร่วมกิจกรรม"}
        </h1>

        <p>
          {done
            ? "ระบบบันทึกการเข้าร่วมเรียบร้อยแล้ว"
            : "กรุณาตรวจสอบข้อมูลกิจกรรมก่อนยืนยัน"}
        </p>
      </div>

      <div className="checkin-header-space" />
    </header>


    {done ? (
      /* =========================
         SUCCESS
      ========================= */
      <main className="checkin-content">

        <section className="checkin-success-card">

          <div className="checkin-success-icon">
            <span className="material-icons">
              check
            </span>
          </div>

          <h2>
            {alreadyCheckedIn
              ? "คุณได้เช็คอินกิจกรรมนี้แล้ว"
              : "ยืนยันการเข้าร่วมสำเร็จ!"}
          </h2>

          <p>
            {alreadyCheckedIn
              ? "ไม่สามารถเช็คอินกิจกรรมเดิมซ้ำได้"
              : `คุณได้เข้าร่วม ${activity?.activityName || ""} เรียบร้อยแล้ว`}
          </p>

          <button
            className="checkin-confirm-btn"
            onClick={() =>
              activity &&
              navigate(
                `/activity-detail?id=${activity.id}`,
                { replace: true }
              )
            }
          >
            กลับหน้ากิจกรรม
          </button>

        </section>

      </main>
    ) : (
      /* =========================
         CONFIRM
      ========================= */
      <main className="checkin-content">

        {/* Activity */}
        <section className="checkin-activity-card">

          <div className="checkin-cover">

            {activity?.cover ? (
              <img
                src={activity.cover}
                alt={activity.activityName}
              />
            ) : (
              <div className="checkin-no-cover">
                <span className="material-icons">
                  image
                </span>
              </div>
            )}

          </div>

          <div className="checkin-activity-info">

            <span className="checkin-type">
              {activity?.activityType === "private"
                ? "กิจกรรมส่วนตัว"
                : "กิจกรรมสาธารณะ"}
            </span>

            <h2>{activity?.activityName}</h2>

            <div className="checkin-info-row">
              <span className="material-icons">
                calendar_today
              </span>

              <p>
                {formatDate(activity?.date)}
              </p>
            </div>

            <div className="checkin-info-row">
              <span className="material-icons">
                schedule
              </span>

              <p>
                {formatTime(activity?.time)}
                {" - "}
                {formatTime(activity?.endTime)}
              </p>
            </div>

            <div className="checkin-info-row">
              <span className="material-icons">
                location_on
              </span>

              <p>
                {activity?.location || "-"}
              </p>
            </div>

          </div>

        </section>


        {/* Organizer / Participants */}
        <section className="checkin-summary-grid">

          <div className="checkin-summary-card">

            <div className="summary-icon">
              <span className="material-icons">
                person
              </span>
            </div>

            <div>
              <span>ผู้จัดกิจกรรม</span>

              <strong>
                {activity?.creatorName ||
                  activity?.creator?.name ||
                  activity?.creatorUsername ||
                  "ผู้จัดกิจกรรม"}
              </strong>
            </div>

          </div>


          <div className="checkin-summary-card">

            <div className="summary-icon">
              <span className="material-icons">
                groups
              </span>
            </div>

            <div>
              <span>จำนวนที่รองรับ</span>

              <strong>
                {activity?.participantCount
                  ? `${activity.participantCount} คน`
                  : "ไม่จำกัด"}
              </strong>
            </div>

          </div>

        </section>


        {/* Check-in time */}
        {(activity?.checkinStart || activity?.checkinEnd) && (
          <section className="checkin-time-card">

            <div className="checkin-time-icon">
              <span className="material-icons">
                schedule
              </span>
            </div>

            <div>
              <span>ช่วงเวลาเช็คอิน</span>

              <strong>
                {activity?.checkinStart
                  ? formatTime(activity.checkinStart)
                  : "--:--"}

                {" - "}

                {activity?.checkinEnd
                  ? formatTime(activity.checkinEnd)
                  : "--:--"}{" "}
                น.
              </strong>
            </div>

          </section>
        )}


        {/* User */}
        <section className="checkin-user-card">

          <div className="checkin-user-icon">
            <span className="material-icons">
              person_outline
            </span>
          </div>

          <div>
            <p>คุณกำลังเช็คอินในฐานะ</p>

            <strong>
              {(() => {
                try {
                  const user = JSON.parse(
                    sessionStorage.getItem("user")
                  );

                  return (
                    user?.name ||
                    user?.username ||
                    "ผู้ใช้งาน"
                  );
                } catch {
                  return "ผู้ใช้งาน";
                }
              })()}
            </strong>

            <span>
              {(() => {
                try {
                  const user = JSON.parse(
                    sessionStorage.getItem("user")
                  );

                  return user?.username
                    ? `@${user.username}`
                    : "";
                } catch {
                  return "";
                }
              })()}
            </span>
          </div>

        </section>


        {joinStatus === "approved" ? (
          <>
            {/* ข้อความแทนกล่องเขียว */}
            <div className="checkin-ready-text">
              <span>พร้อมเข้าร่วมกิจกรรม 🎉</span>
              <p>
                ตรวจสอบข้อมูลด้านบน แล้วกดยืนยันได้เลย
              </p>
            </div>

            <button
              type="button"
              className="checkin-confirm-btn"
              onClick={handleCheckIn}
              disabled={checkinLoading}
            >
              <span className="material-icons">
                check_circle
              </span>

              {checkinLoading
                ? "กำลังยืนยัน..."
                : "ยืนยันการเข้าร่วมกิจกรรม"}
            </button>

            <button
              type="button"
              className="checkin-cancel-btn"
              onClick={() => navigate(-1)}
              disabled={checkinLoading}
            >
              ยกเลิก
            </button>
          </>
        ) : (
          <section className="checkin-not-allowed">

            <span className="material-icons">
              error_outline
            </span>

            <h3>ไม่สามารถเช็คอินได้</h3>

            <p>
              {joinStatus === "pending"
                ? "คำขอยังรอการอนุมัติ"
                : joinStatus === "rejected"
                ? "คำขอเข้าร่วมถูกปฏิเสธ"
                : joinStatus === "cancelled"
                ? "คำขอเข้าร่วมถูกยกเลิกแล้ว"
                : "คุณยังไม่ได้เข้าร่วมกิจกรรมนี้"}
            </p>

            <button
              onClick={() =>
                activity &&
                navigate(
                  `/activity-detail?id=${activity.id}`
                )
              }
            >
              กลับหน้ากิจกรรม
            </button>

          </section>
        )}

      </main>
    )}

  </div>
);
}

export default CheckIn;