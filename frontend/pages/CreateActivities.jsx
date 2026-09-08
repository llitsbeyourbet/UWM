import API_URL from "../config";
import { lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAlert } from "../hooks/useAlert";
import "../styles/CreateActivities.css";
import { getCategoryIcon } from "../utils/categoryIcons";

function CreateActivities() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [preview, setPreview] = useState([]);
  const [coverFilename, setCoverFilename] = useState(null); // 👈 เพิ่ม
  const [activityName, setActivityName] = useState("");
  const [detail, setDetail] = useState("");
  const now = new Date();

  const today = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const formatTime = (date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes()
    ).padStart(2, "0")}`;

  const endActivityTime = new Date(now);
  endActivityTime.setMinutes(endActivityTime.getMinutes() + 60);

  const endCheckinTime = new Date(now);
  endCheckinTime.setMinutes(endCheckinTime.getMinutes() + 15);

  const [date, setDate] = useState(today);
  const [time, setTime] = useState(formatTime(now));
  const [endTime, setEndTime] = useState(formatTime(endActivityTime));

  const [checkinStart, setCheckinStart] = useState(formatTime(now));
  const [checkinEnd, setCheckinEnd] = useState(formatTime(endCheckinTime));
  const [location, setLocation] = useState("");
  const [participantCount, setParticipantCount] = useState("1");
  const [activityType, setActivityType] = useState("public");
  const [category, setCategory] = useState([]);
  const [showCategory, setShowCategory] = useState(false);
  const [error, setError] = useState("");
  const isIOS = /iPhone|iPod|iPad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);


  // 👈 แก้ handleImage ให้อัปโหลดรูปไป server
  const handleImage = async (e) => {
    const files = Array.from(e.target.files);
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreview(urls);

    if (files[0]) {
      const formData = new FormData();
      formData.append("image", files[0]);

      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "อัปโหลดรูปไม่สำเร็จ");
        }

        setCoverFilename(data.filename); // 👈 เก็บแค่ชื่อไฟล์
      } catch (err) {
        console.error("Upload error:", err);
      }
    }
  };
  const categoryOptions = ["กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่", "ภาพยนตร์"];

  const toggleCategory = (val) => {
    setCategory((prev) =>
      prev.includes(val)
        ? prev.filter((c) => c !== val)
        : [...prev, val]
    );

    setShowCategory(false);
  };
  const handleSubmit = async () => {
    setError("");
    if (!activityName.trim()) {
      setError("กรุณากรอกชื่อกิจกรรม");
      return;
    }

    if (!detail.trim()) {
      setError("กรุณากรอกรายละเอียดกิจกรรม");
      return;
    }

    if (!activityType) {
      setError("กรุณาเลือกประเภทกิจกรรม");
      return;
    }

    if (!category || category.length === 0) {
      setError("กรุณาเลือกหมวดหมู่");
      return;
    }

    if (!date) {
      setError("กรุณาเลือกวันที่");
      return;
    }

    if (!time) {
      setError("กรุณาเลือกเวลาเริ่ม");
      return;
    }

    if (!endTime) {
      setError("กรุณาเลือกเวลาสิ้นสุด");
      return;
    }

    if (!location.trim()) {
      setError("กรุณากรอกสถานที่");
      return;
    }

    if (!coverFilename) {
      setError("กรุณาอัปโหลดรูปปกกิจกรรม");
      return;
    }

    if (endTime <= time) {
      await showAlert({
        type: 'warning',
        title: 'เวลาไม่ถูกต้อง',
        message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม',
      });
      return;
    }

    if (checkinStart && checkinEnd && checkinEnd <= checkinStart) {
      await showAlert({
        type: 'warning',
        title: 'เวลาไม่ถูกต้อง',
        message: 'เวลาเช็คอินไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
      });
      return;
    }

    const token = sessionStorage.getItem("token");
    if (!token) {
      await showAlert({
        type: 'info',
        title: 'เข้าสู่ระบบ',
        message: 'กรุณาเข้าสู่ระบบก่อนสร้างกิจกรรม',
      });
      navigate("/login");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/activities`, {
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
          participantCount: Number(participantCount) || 1,
          activityType,
          cover: coverFilename || null, // 👈 ส่งแค่ชื่อไฟล์
          category,
          checkinStart,
          checkinEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        await showAlert({
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: data.message || "เกิดข้อผิดพลาดในการสร้างกิจกรรม",
        });
        return;
      }


      setActivityName("");
      setDetail("");
      setDate("");
      setTime("");
      setEndTime("");
      setLocation("");
      setParticipantCount("1");
      setActivityType("public");
      setPreview([]);
      setCoverFilename(null); // 👈 reset coverFilename ด้วย

      await showAlert({
        type: 'success',
        title: 'สร้างกิจกรรมสำเร็จ!',
        message: 'กิจกรรมของคุณถูกสร้างเรียบร้อยแล้ว',
      });

      navigate(`/activity-detail?id=${data.id}`);

    } catch (err) {
      console.log(err);
      await showAlert({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถเชื่อมต่อ server ได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  return (
    <div className="create-page">

      {/* Header */}
      <div className="create-header">

        <div className="create-header-text">
          <h1>สร้างกิจกรรมใหม่</h1>
          <p>มาชวนเพื่อน ๆ มาทำกิจกรรมดี ๆ กันเถอะ!</p>
        </div>
      </div>

      <div className="create-form">

        {/* รูปกิจกรรม */}
        <section className="form-section cover-section">
          <div className="section-title">
            <h2>รูปภาพกิจกรรม</h2>
            <span>รูปปกกิจกรรม</span>
          </div>

          <div className="cover-upload">
            {preview.length > 0 ? (
              <div className="cover-preview">
                <img
                  src={preview[0]}
                  alt="รูปปกกิจกรรม"
                  className="cover-img"
                />

                <label className="change-image-btn">
                  เปลี่ยนรูป
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImage}
                    hidden
                  />
                </label>
              </div>
            ) : (
              <label className="upload-placeholder">
                <div className="upload-icon">↑</div>

                <strong>เพิ่มรูปภาพกิจกรรม</strong>

                <span>
                  คลิกเพื่อเลือกรูปภาพจากเครื่อง
                </span>

                <small>
                  รองรับ JPG, PNG และขนาดไม่เกิน 5MB
                </small>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImage}
                  hidden
                />
              </label>
            )}
          </div>
        </section>

        {/* ชื่อกิจกรรม */}
        <section className="form-section">
          <label className="form-label">
            ชื่อกิจกรรม <span>*</span>
          </label>

          <input
            type="text"
            className="form-input"
            placeholder="เช่น ไปเที่ยวด้วยกัน"
            value={activityName}
            onChange={(e) =>
              setActivityName(e.target.value.slice(0, 200))
            }
          />

          <div className="input-counter">
            {activityName.length}/200
          </div>
        </section>

        {/* รายละเอียด */}
        <section className="form-section">
          <label className="form-label">
            รายละเอียดกิจกรรม <span>*</span>
          </label>

          <textarea
            className="form-textarea"
            placeholder="รายละเอียดเกี่ยวกับกิจกรรม เช่น สิ่งที่ทำ, สิ่งที่ต้องเตรียม, ค่าใช้จ่าย ฯลฯ"
            value={detail}
            onChange={(e) =>
              setDetail(e.target.value.slice(0, 1000))
            }
          />

          <div className="input-counter">
            {detail.length}/1000
          </div>
        </section>

        {/* ประเภทกิจกรรม */}
        <section className="form-section">
          <label className="form-label">
            ประเภทกิจกรรม <span>*</span>
          </label>

          <div className="activity-type-group">

            <button
              type="button"
              className={`activity-type-btn ${activityType === "private" ? "active" : ""
                }`}
              onClick={() => setActivityType("private")}
            >
              🔒
              <span>แบบส่วนตัว</span>
            </button>

            <button
              type="button"
              className={`activity-type-btn ${activityType === "public" ? "active" : ""
                }`}
              onClick={() => setActivityType("public")}
            >
              👥
              <span>แบบสาธารณะ</span>
            </button>

          </div>
        </section>

        {/* หมวดหมู่ */}
        <section className="form-section">
          <label className="form-label">
            หมวดหมู่ <span>*</span>
          </label>

          <div className="dropdown-wrap">
            <button
              type="button"
              className="dropdown-trigger"
              onClick={() => setShowCategory(!showCategory)}
            >
              <span>
                {category.length === 0
                  ? "เลือกหมวดหมู่"
                  : category.length === 1
                    ? `${getCategoryIcon(category[0])} ${category[0]}`
                    : `${getCategoryIcon(category[0])} ${category[0]} +${category.length - 1
                    }`}
              </span>

              <span className="dropdown-arrow">
                {showCategory ? "⌃" : "⌄"}
              </span>
            </button>

            {showCategory && (
              <div className="dropdown-menu">
                {categoryOptions.map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    className={`dropdown-item ${category.includes(opt) ? "selected" : ""
                      }`}
                    onClick={() => toggleCategory(opt)}
                  >
                    <span>
                      {getCategoryIcon(opt)} {opt}
                    </span>

                    {category.includes(opt) && (
                      <span className="category-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {category.length > 0 && (
            <div className="category-badges">
              {category.map((item) => (
                <div className="category-badge" key={item}>
                  <span>
                    {getCategoryIcon(item)} {item}
                  </span>

                  <button
                    type="button"
                    className="category-badge-remove"
                    onClick={() => toggleCategory(item)}
                    aria-label={`ลบหมวดหมู่ ${item}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* วันที่ */}
        <section className="form-section">
          <label className="form-label">
            วันที่จัดกิจกรรม <span>*</span>
          </label>

          <div className="input-icon-wrap">
            <input
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </section>

        {/* เวลา */}
        <section className="form-section two-column">
          <div>
            <label className="form-label">
              เวลาเริ่มต้น <span>*</span>
            </label>

            <input
              type="time"
              className="form-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">
              เวลาสิ้นสุด <span>*</span>
            </label>

            <input
              type="time"
              className="form-input"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </section>

        {/* Check-in */}
        <section className="form-section">

          <div className="two-column">
            <div>
              <label className="form-label">
                เวลาเช็คอินเริ่ม
              </label>

              <input
                type="time"
                className="form-input"
                value={checkinStart}
                onChange={(e) =>
                  setCheckinStart(e.target.value)
                }
              />
            </div>

            <div>
              <label className="form-label">
                เวลาเช็คอินสิ้นสุด
              </label>

              <input
                type="time"
                className="form-input"
                value={checkinEnd}
                onChange={(e) =>
                  setCheckinEnd(e.target.value)
                }
              />
            </div>
          </div>
        </section>

        {/* สถานที่ */}
        <section className="form-section">
          <label className="form-label">
            สถานที่จัดกิจกรรม <span>*</span>
          </label>

          <input
            type="text"
            className="form-input"
            placeholder="เช่น มหาวิทยาลัย, สวนสาธารณะ, คาเฟ่..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </section>

        {/* จำนวนผู้เข้าร่วม */}
        <section className="form-section">
          <label className="form-label">
            จำนวนผู้เข้าร่วมสูงสุด
          </label>

          <div className="participant-control">
            <input
              type="range"
              min="1"
              max="100"
              value={Number(participantCount) || 1}
              onChange={(e) =>
                setParticipantCount(e.target.value)
              }
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

            <span>คน</span>
          </div>
        </section>

        {/* รูปเพิ่มเติม */}
        {preview.length > 1 && (
          <section className="form-section">
            <label className="form-label">
              รูปภาพเพิ่มเติม
            </label>

            <div className="image-preview-container">
              {preview.slice(1).map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`preview-${index}`}
                  className="image-preview"
                />
              ))}
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <p className="create-error">
            {error}
          </p>
        )}

        {/* ปุ่ม */}
        <div className="submit-area">
          <button
            type="button"
            className="cancel-btn"
            onClick={() => navigate(-1)}
          >
            ยกเลิก
          </button>

          <button
            className="submit-btn"
            type="button"
            onClick={handleSubmit}
          >
            <span>➤</span>
            สร้างกิจกรรม
          </button>
        </div>

      </div>
    </div>
  );
}

export default CreateActivities;