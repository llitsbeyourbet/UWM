import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateActivities.css";

function EditActivity() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activityName, setActivityName] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [activityType, setActivityType] = useState("public");
  const [coverFilename, setCoverFilename] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch(`${API_URL}/api/activities/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setActivityName(data.activityName || "");
        setCoverFilename(data.cover || null);
        setDetail(data.detail || "");
        setDate(data.date || "");
        setTime(data.time || "");
        setEndTime(data.endTime || "");
        setLocation(data.location || "");
        setParticipantCount(data.participantCount || 1);
        setActivityType(data.activityType || "public");

        if (data.cover) {
          const coverUrl = data.cover.startsWith("http")
            ? data.cover
            : `${API_URL}/uploads/${data.cover}`;
          setPreview(coverUrl);
        }
      } catch (err) {
        console.log("Error fetching activity:", err);
      }
    };
    fetchActivity();
  }, [id]);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCoverFilename(data.filename);
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("ไม่สามารถอัปโหลดรูปภาพได้");
    }
  };

  const handleSubmit = async () => {
    if (!activityName) {
      alert("กรุณากรอกชื่อกิจกรรม");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const payload = {
        activityName,
        detail,
        date,
        time,
        endTime,
        location,
        participantCount,
        activityType,
      };

      if (coverFilename) {
        payload.cover = coverFilename;
      }

      const res = await fetch(`${API_URL}/api/activities/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาดในการบันทึก");
        return;
      }

      alert("แก้ไขกิจกรรมสำเร็จ");

      // ส่งสัญญาณบอกหน้า ActivityDetail ให้รีเฟรชข้อมูล
      window.dispatchEvent(new Event("activityUpdated"));
      // กลับไปยังหน้าก่อนหน้า (ซึ่งคือหน้า ActivityDetail)
      navigate(-1);
    } catch (err) {
      console.error("Submit error:", err);
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  return (
    <div className="create-page">
      <div className="cover-image">
        {preview ? (
          <img src={preview} alt="cover" className="cover-img" />
        ) : (
          <div className="cover-placeholder" />
        )}
        <label className="change-image-btn">
          Change Image
          <input type="file" accept="image/*" onChange={handleImage} hidden />
        </label>
      </div>

      <div className="detail-card">
        <label>ชื่อกิจกรรม</label>
        <input type="text" className="title-input" value={activityName} onChange={(e) => setActivityName(e.target.value)} />

        <label>รายละเอียดกิจกรรม</label>
        <textarea className="detail-textarea" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />

        <div className="row-group">
          <div className="input-group">
            <label>วันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="row-group">
          <div className="input-group">
            <label>เวลาเริ่มต้น</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="input-group">
            <label>เวลาสิ้นสุด</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <label>สถานที่</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />

        <label>จำนวนผู้เข้าร่วม</label>
        <div className="slider-container">
          <span>Number of people {participantCount}</span>
          <input type="range" min={1} max={100} value={participantCount} onChange={(e) => setParticipantCount(Number(e.target.value))} />
        </div>

        <div className="input-group">
          <label>ประเภทกิจกรรม</label>
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            <option value="public">สาธารณะ</option>
            <option value="private">ส่วนตัว</option>
          </select>
        </div>

        <button className="submit-btn" type="button" onClick={handleSubmit}>
          บันทึกการแก้ไข
        </button>
      </div>
    </div>
  );
}

export default EditActivity;
