import API_URL from "../config";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAlert } from "../hooks/useAlert";
import "../styles/CreateActivities.css";
import { getCategoryIcon } from "../utils/categoryIcons";

function EditActivity() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
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
  const categoryOptions = ["กีฬา", "ดนตรี", "ท่องเที่ยว", "อาหาร", "ศิลปะ", "เกม", "คาเฟ่", "ภาพยนตร์", "เรียน", "สุขภาพ", "จิตอาสา"];

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
        const token = sessionStorage.getItem("token");
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
          await showAlert({
            type: 'error',
            title: 'ไม่มีสิทธิ์เข้าถึง',
            message: 'คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้',
          });
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

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_IMAGE_SIZE) {
      e.target.value = "";
      await showAlert({
        type: "warning",
        title: "รูปภาพมีขนาดใหญ่เกินไป",
        message: "รูปภาพต้องมีขนาดไม่เกิน 5 MB",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const formData = new FormData();
    formData.append("image", file);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setCoverFilename(data.filename);
      } else {
        await showAlert({
          type: 'error',
          title: 'อัปโหลดไม่สำเร็จ',
          message: data.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ",
        });
      }
    } catch (err) {
      console.error("Upload error:", err);
      await showAlert({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const handleSubmit = async () => {
    if (!activityName) {
      await showAlert({ type: 'warning', title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณากรอกชื่อกิจกรรม' });
      return;
    }
    if (!date || !time || !endTime) {
      await showAlert({ type: 'warning', title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณากรอกวันและเวลาให้ครบ' });
      return;
    }

    if (endTime <= time) {
      await showAlert({ type: 'warning', title: 'เวลาไม่ถูกต้อง', message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่ม' });
      return;
    }

    if (
      checkinStart &&
      checkinEnd &&
      checkinEnd <= checkinStart
    ) {
      await showAlert({ type: 'warning', title: 'เวลาไม่ถูกต้อง', message: 'เวลาสิ้นสุดเช็คอินต้องมากกว่าเวลาเริ่มเช็คอิน' });
      return;
    }

    const token = sessionStorage.getItem("token");
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
        await showAlert({
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
        });
        return;
      }

      await showAlert({
        type: 'success',
        title: 'แก้ไขกิจกรรมสำเร็จ!',
        message: 'ข้อมูลกิจกรรมของคุณได้รับการอัปเดตเรียบร้อยแล้ว',
      });

      // ส่งสัญญาณบอกหน้า ActivityDetail ให้รีเฟรชข้อมูล
      window.dispatchEvent(new Event("activityUpdated"));
      // กลับไปยังหน้าก่อนหน้า (ซึ่งคือหน้า ActivityDetail)
      navigate(-1);
    } catch (err) {
      console.error("Submit error:", err);
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
          <h1>แก้ไขกิจกรรม</h1>
          <p>อัปเดตรายละเอียดกิจกรรมของคุณให้เรียบร้อย</p>
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
            {preview ? (
              <div className="cover-preview">
                <img
                  src={preview}
                  alt="รูปปกกิจกรรม"
                  className="cover-img"
                />

                <label className="change-image-btn">
                  เปลี่ยนรูป
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImage}
                    hidden
                  />
                </label>
              </div>
            ) : (
              <label className="upload-placeholder">
                <div className="upload-icon">↑</div>

                <strong>เพิ่มรูปภาพกิจกรรม</strong>

                <span>คลิกเพื่อเลือกรูปภาพจากเครื่อง</span>

                <small>รองรับ JPG, PNG และขนาดไม่เกิน 5MB</small>

                <input
                  type="file"
                  accept="image/*"
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
              className={`activity-type-btn ${activityType === "private" ? "active" : ""}`}
              onClick={() => setActivityType("private")}
            >
              🔒
              <span>แบบส่วนตัว</span>
            </button>

            <button
              type="button"
              className={`activity-type-btn ${activityType === "public" ? "active" : ""}`}
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
                    : `${getCategoryIcon(category[0])} ${category[0]} +${category.length - 1}`}
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
                    className={`dropdown-item ${category.includes(opt) ? "selected" : ""}`}
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
                    onClick={() => removeCategory(item)}
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
                onChange={(e) => setCheckinStart(e.target.value)}
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
                onChange={(e) => setCheckinEnd(e.target.value)}
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

            <span>คน</span>
          </div>
        </section>

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
            บันทึกการแก้ไข
          </button>
        </div>

      </div>
    </div>
  );

}

export default EditActivity;
