import API_URL from "../config";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateActivities.css";
import { getCategoryIcon } from "../utils/categoryIcons";

function EditActivity() {
  const navigate = useNavigate();
  const { id } = useParams();
  const hasFetched = useRef(false);
  const isIOS = /iPhone|iPod|iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
  const [category, setCategory] = useState([]);
  const [showCategory, setShowCategory] = useState(false);
  const [checkinStart, setCheckinStart] = useState("");
  const [checkinEnd, setCheckinEnd] = useState("");
  const categoryOptions = ["กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่", "ภาพยนตร์"];

  const toggleCategory = (val) => {
    setCategory((prev) =>
      prev.includes(val)
        ? prev.filter((item) => item !== val)
        : [...prev, val]
    );

    setShowCategory(false);
  };

  const removeCategory = (val) => {
    setCategory((prev) => prev.filter((item) => item !== val));
  };

  useEffect(() => {
    const fetchActivity = async () => {
      if (hasFetched.current) return;
      hasFetched.current = true;

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        let user = null;
        try {
          const userRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userRes.ok) {
            user = await userRes.json();
          }
        } catch (err) {
          console.log("Error checking user context:", err);
        }

        const res = await fetch(`${API_URL}/api/activities/${id}`);
        if (!res.ok) return;
        const data = await res.json();

        if (!user || data.createdBy !== user.id) {
          alert("คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้");
          navigate("/");
          return;
        }

        setActivityName(data.activityName || "");
        setCoverFilename(data.cover || null);
        setDetail(data.detail || "");
        setDate(data.date || "");
        setTime(data.time || "");
        setEndTime(data.endTime || "");
        setLocation(data.location || "");
        setParticipantCount(data.participantCount || 1);
        setActivityType(data.activityType || "public");
        setCategory(Array.isArray(data.category) ? data.category : []);
        setCheckinStart(data.checkinStart || "");
        setCheckinEnd(data.checkinEnd || "");

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
    if (!date || !time || !endTime) {
      alert("กรุณากรอกวันและเวลาให้ครบ");
      return;
    }

    if (endTime <= time) {
      alert("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม");
      return;
    }

    if (
      checkinStart &&
      checkinEnd &&
      checkinEnd <= checkinStart
    ) {
      alert("เวลาสิ้นสุดเช็คอินต้องมากกว่าเวลาเริ่มเช็คอิน");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const payload = {
        activityName: activityName.trim(),
        detail,
        date,
        time,
        endTime,
        location,
        participantCount: Number(participantCount) || 1,
        activityType,
        category,
        checkinStart,
        checkinEnd,
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
        <input type="text" className="title-input" value={activityName} onChange={(e) => setActivityName(e.target.value.slice(0, 200))} />

        <label>รายละเอียดกิจกรรม</label>
        <textarea className="detail-textarea" rows={2} value={detail} onChange={(e) => setDetail(e.target.value.slice(0, 1000))} />

        <label>หมวดหมู่</label>

        <div className="dropdown-wrap">
          <div
            className="dropdown-trigger"
            onClick={() => setShowCategory((prev) => !prev)}
          >
            <span>
              {category.length === 0
                ? "เลือกหมวดหมู่"
                : (() => {
                  const first = category[0];

                  return category.length === 1
                    ? `${getCategoryIcon(first)} ${first}`
                    : `${getCategoryIcon(first)} ${first} +${category.length - 1}`;
                })()}
            </span>

            <span>{showCategory ? "▲" : "▼"}</span>
          </div>

          {showCategory && (
            <div className="dropdown-menu">
              {categoryOptions.map((option) => (
                <div
                  key={option}
                  className={`dropdown-item ${category.includes(option) ? "selected" : ""
                    }`}
                  onClick={() => toggleCategory(option)}
                >
                  <span>{getCategoryIcon(option)} {option}</span>
                  {category.includes(option) && <span>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {category.length > 0 && (
          <div className="category-badges">
            {category.map((item) => {
              return (
                <div className="category-badge" key={item}>
                  <span>{getCategoryIcon(item)} {item}</span>

                  <button
                    type="button"
                    className="category-badge-remove"
                    onClick={() => removeCategory(item)}
                    aria-label={`ลบหมวดหมู่ ${item}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}


        <div className={`row-group ${isIOS ? "ios" : ""}`}>
          <div className="input-group">
            <label>วันที่</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className={`row-group ${isIOS ? "ios" : ""}`}>
          <div className="input-group">
            <label>เวลาเริ่มต้น</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="input-group">
            <label>เวลาสิ้นสุด</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className={`row-group ${isIOS ? "ios" : ""}`}>
          <div className="input-group">
            <label>เวลาเริ่มเช็คอิน</label>
            <input
              type="time"
              value={checkinStart}
              onChange={(e) => setCheckinStart(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>เวลาสิ้นสุดเช็คอิน</label>
            <input
              type="time"
              value={checkinEnd}
              onChange={(e) => setCheckinEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="input-group">
          <label>สถานที่</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <div className="slider-container">
          <label>จำนวนผู้เข้าร่วม</label>

          <div className="participant-control">
            <input
              type="range"
              min="1"
              max="100"
              value={Number(participantCount) || 1}
              onChange={(e) => setParticipantCount(e.target.value)}
            />

            <input
              type="number"
              min="1"
              max="100"
              value={participantCount}
              onChange={(e) => {
                const value = e.target.value;

                if (value === "") {
                  setParticipantCount("");
                  return;
                }

                if (!/^\d+$/.test(value)) return;

                const num = Number(value);

                if (num <= 100) {
                  setParticipantCount(value);
                }
              }}
              onBlur={() => {
                if (
                  participantCount === "" ||
                  Number(participantCount) < 1
                ) {
                  setParticipantCount("1");
                }
              }}
            />
          </div>
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
