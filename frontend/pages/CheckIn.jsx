import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/CheckIn.css";
import { formatDate, formatTime } from "../utils/formatDate";
import Loading from "../components/Loading";

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

  const getCurrentUser = () => {
    try {
      return JSON.parse(sessionStorage.getItem("user")) || {};
    } catch {
      return {};
    }
  };

  const getProfileImage = (user) =>
    user?.profileImage ||
    user?.profilePicture ||
    user?.avatar ||
    "";

  const getDisplayName = (user) =>
    user?.name ||
    user?.username ||
    "ผู้ใช้งาน";

  const getInitial = (user) =>
    (user?.username || user?.name || "U")
      .trim()
      .charAt(0)
      .toUpperCase();

  const currentUser = getCurrentUser();

  useEffect(() => {
    const fetchData = async () => {
      const token = sessionStorage.getItem("token");

      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const actRes = await fetch(
          `${API_URL}/api/activities/${activityId}`
        );

        if (!actRes.ok) {
          throw new Error("ไม่พบข้อมูลกิจกรรม");
        }

        const actData = await actRes.json();
        setActivity(actData);

        const statusRes = await fetch(
          `${API_URL}/api/join/${activityId}/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!statusRes.ok) {
          throw new Error(
            "ไม่สามารถตรวจสอบสถานะการเข้าร่วมได้"
          );
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
        setErrorMessage(
          err.message || "ไม่สามารถโหลดข้อมูลกิจกรรมได้"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activityId, navigate]);

  const handleCheckIn = async () => {
    const token = sessionStorage.getItem("token");

    setCheckinLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/join/${activityId}/checkin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            qrToken,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      setDone(true);
      setJoinStatus("checked_in");
      setAlreadyCheckedIn(false);
    } catch {
      setErrorMessage("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setCheckinLoading(false);
    }
  };

  const ProfileAvatar = ({ user, className = "" }) => {
    const image = getProfileImage(user);

    return (
      <div className={`checkin-profile-avatar ${className}`}>
        {image ? (
          <img
            src={image}
            alt={getDisplayName(user)}
          />
        ) : (
          <span>{getInitial(user)}</span>
        )}
      </div>
    );
  };

  if (errorMessage) {
    return (
      <div className="checkin-page">
        <main className="checkin-content">
          <section className="checkin-error-card">
            <div className="checkin-error-icon">
              <span className="material-icons">
                schedule
              </span>
            </div>

            <h2>ไม่สามารถเช็คอินได้</h2>
            <p>{errorMessage}</p>

            {activity && (
              <div className="checkin-error-activity">
                <div className="checkin-error-cover">
                  {activity.cover ? (
                    <img
                      src={activity.cover}
                      alt={activity.activityName}
                    />
                  ) : (
                    <span className="material-icons">
                      event
                    </span>
                  )}
                </div>

                <div className="checkin-error-info">
                  <strong>{activity.activityName}</strong>
                  <span>{formatDate(activity.date)}</span>

                  <span>
                    {formatTime(activity.time)}
                    {" - "}
                    {formatTime(activity.endTime)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
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
      </div>
    );
  }

if (loading) return <Loading />;

  return (
    <div className="checkin-page">
      

      {done ? (
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
                : `คุณได้เข้าร่วม ${
                    activity?.activityName || ""
                  } เรียบร้อยแล้ว`}
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
        <main className="checkin-content">
          {/* ACTIVITY */}
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

                <p>{formatDate(activity?.date)}</p>
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

                <p>{activity?.location || "-"}</p>
              </div>
            </div>
          </section>

          {/* ORGANIZER */}
          <section className="checkin-section">
            <p className="checkin-section-label">
              ผู้จัดกิจกรรม
            </p>

            <div className="checkin-person-card">
              <ProfileAvatar user={activity?.creator} />

              <div className="checkin-person-info">
                <strong>
                  {activity?.creator?.name ||
                    activity?.creator?.username ||
                    "ไม่พบข้อมูลผู้จัดกิจกรรม"}
                </strong>

                {activity?.creator?.username && (
                  <span>
                    @{activity.creator.username}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* PARTICIPANTS */}
          <section className="checkin-info-card">
            <div className="checkin-info-icon">
              <span className="material-icons">
                groups
              </span>
            </div>

            <div>
              <span>จำนวนผู้เข้าร่วม</span>

              <strong>
                {activity?.participantCount
                  ? `${activity.participantCount} คน`
                  : "ไม่จำกัด"}
              </strong>
            </div>
          </section>

          {/* CHECK-IN TIME */}
          {(activity?.checkinStart ||
            activity?.checkinEnd) && (
            <section className="checkin-info-card checkin-time-card">
              <div className="checkin-info-icon">
                <span className="material-icons">
                  schedule
                </span>
              </div>

              <div>
                <span>ช่วงเวลาเช็คอิน</span>

                <strong className="checkin-time-value">
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

          {/* CURRENT USER */}
          <section className="checkin-section">
            <p className="checkin-section-label">
              คุณกำลังเช็คอินในฐานะ
            </p>

            <div className="checkin-person-card current-user">
              <ProfileAvatar user={currentUser} />

              <div className="checkin-person-info">
                <strong>
                  {getDisplayName(currentUser)}
                </strong>

                {currentUser?.username && (
                  <span>
                    @{currentUser.username}
                  </span>
                )}
              </div>
            </div>
          </section>

          {joinStatus === "approved" ? (
            <>
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