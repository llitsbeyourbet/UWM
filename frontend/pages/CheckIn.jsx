import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CheckIn.css";

function CheckIn() {
  const navigate = useNavigate();
  const { activityId, qrToken } = useParams();
  const [activity, setActivity] = useState(null);
  const [joinStatus, setJoinStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        const actRes = await fetch(`${API_URL}/api/activities/${activityId}`);
        const actData = await actRes.json();
        setActivity(actData);

        const statusRes = await fetch(`${API_URL}/api/join/${activityId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const statusData = await statusRes.json();
        setJoinStatus(statusData.status);

        if (statusData.status === "checked_in") setDone(true);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activityId]);

  const handleCheckIn = async () => {
    const token = localStorage.getItem("token");
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
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      setDone(true);
      setJoinStatus("checked_in");
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setCheckinLoading(false);
    }
  };

  if (loading) return (
    <div className="checkin-page">
      <p className="loading-text">กำลังโหลด...</p>
    </div>
  );

  return (
    <div className="checkin-page">
      <div className="checkin-card">

        <div className="checkin-icon">
          {done ? (
            <div className="icon-success">✓</div>
          ) : (
            <div className="icon-qr">📍</div>
          )}
        </div>

        {done ? (
          <>
            <h2 className="checkin-title">ยืนยันการเข้าร่วมสำเร็จ!</h2>
            <p className="checkin-subtitle">{activity?.activityName}</p>
            <button className="checkin-btn done" onClick={() => navigate("/")}>
              กลับหน้าหลัก
            </button>
          </>
        ) : (
          <>
            <h2 className="checkin-title">{activity?.activityName}</h2>
            <div className="checkin-info">
              <p>📅 {activity?.date || "-"}</p>
              <p>⏰ {activity?.time || "-"} - {activity?.endTime || "-"}</p>
              <p>📍 {activity?.location || "-"}</p>
            </div>

            {joinStatus === "approved" ? (
              <button
                className="checkin-btn"
                onClick={handleCheckIn}
                disabled={checkinLoading}
              >
                {checkinLoading ? "กำลังยืนยัน..." : "ยืนยันการเข้าร่วม"}
              </button>
            ) : (
              <div className="checkin-error">
                <p>ไม่สามารถ check-in ได้</p>
                <p className="checkin-error-sub">
                  {joinStatus === "pending" ? "คำขอยังรอการอนุมัติ" :
                   joinStatus === "rejected" ? "คำขอถูกปฏิเสธ" :
                   joinStatus === "cancelled" ? "คำขอถูกยกเลิกแล้ว" :
                   "ยังไม่ได้ส่งคำขอเข้าร่วม"}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default CheckIn;