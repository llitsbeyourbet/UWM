import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateActivities.css";

function CreateActivities() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState([]);
  const [coverFilename, setCoverFilename] = useState(null); // 👈 เพิ่ม
  const [activityName, setActivityName] = useState("");
  const [detail, setDetail] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [participantCount, setParticipantCount] = useState(1);
  const [activityType, setActivityType] = useState("public");
  const [category, setCategory] = useState("กีฬา");
  const [checkinStart, setCheckinStart] = useState("");
  const [checkinEnd, setCheckinEnd] = useState("");


  // 👈 แก้ handleImage ให้อัปโหลดรูปไป server
  const handleImage = async (e) => {
    const files = Array.from(e.target.files);
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreview(urls);

    if (files[0]) {
      const formData = new FormData();
      formData.append("image", files[0]);

      try {
        const res = await fetch("http://localhost:5000/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        setCoverFilename(data.filename); // 👈 เก็บแค่ชื่อไฟล์
      } catch (err) {
        console.log(err);
      }
    }
  };

  const handleSubmit = async () => {
    if (!activityName) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("กรุณาเข้าสู่ระบบก่อน");
      navigate("/login");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activityName,
          detail,
          date,
          time,
          endTime,
          location,
          participantCount,
          activityType,
          cover: coverFilename || null, // 👈 ส่งแค่ชื่อไฟล์
          category,
          checkinStart,
          checkinEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      localStorage.setItem("currentActivity", JSON.stringify(data));

      setActivityName("");
      setDetail("");
      setDate("");
      setTime("");
      setEndTime("");
      setLocation("");
      setParticipantCount(1);
      setActivityType("public");
      setPreview([]);
      setCoverFilename(null); // 👈 reset coverFilename ด้วย

      navigate("/activity-detail");
    } catch (err) {
      console.log(err);
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    }
  };

  return (
    <div className="create-page">
      <div className="cover-image">
        {preview.length > 0 ? (
          <img src={preview[0]} alt="cover" className="cover-img" />
        ) : (
          <div className="cover-placeholder" />
        )}
        <label className="change-image-btn">
          Change Image
          <input type="file" accept="image/*" multiple onChange={handleImage} hidden />
        </label>
      </div>

      <div className="detail-card">
        <label>ชื่อกิจกรรม</label>
        <input
          type="text"
          className="title-input"
          value={activityName}
          onChange={(e) => setActivityName(e.target.value)}
        />

        <label>รายละเอียดกิจกรรม</label>
        <textarea
          className="detail-textarea"
          rows={2}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />

        <label>หมวดหมู่</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="กีฬา">⚽ กีฬา</option>
          <option value="ดนตรี">🎵 ดนตรี</option>
          <option value="ท่องเที่ยว">🏔 ท่องเที่ยว</option>
          <option value="อาหาร">🍜 อาหาร</option>
          <option value="ศิลปะ">🎨 ศิลปะ</option>
          <option value="เกม">🎮 เกม</option>
          <option value="คาเฟ่">☕ คาเฟ่</option>
        </select>

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

        <div className="row-group">
          <div className="input-group">
            <label>เวลาเริ่มเช็คอิน</label>
            <input type="time" value={checkinStart} onChange={(e) => setCheckinStart(e.target.value)} />
          </div>
          <div className="input-group">
            <label>เวลาสิ้นสุดเช็คอิน</label>
            <input type="time" value={checkinEnd} onChange={(e) => setCheckinEnd(e.target.value)} />
          </div>
        </div>

        <label>สถานที่</label>
        <input
          type="text"
          placeholder="กรอกสถานที่"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <label>จำนวนผู้เข้าร่วม</label>
        <div className="slider-container">
          <span>Number of people {participantCount}</span>
          <input
            type="range"
            min={1}
            max={100}
            value={participantCount}
            onChange={(e) => setParticipantCount(Number(e.target.value))}
          />
        </div>

        <div className="input-group">
          <label>ประเภทกิจกรรม</label>
          <select
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
          >
            <option value="public">สาธารณะ</option>
            <option value="private">ส่วนตัว</option>
          </select>
        </div>

        {preview.length > 1 && (
          <div className="image-preview-container">
            {preview.slice(1).map((url, index) => (
              <img key={index} src={url} alt={`preview-${index}`} className="image-preview" />
            ))}
          </div>
        )}

        <button className="submit-btn" type="button" onClick={handleSubmit}>
          Post
        </button>
      </div>
    </div>
  );
}

export default CreateActivities;