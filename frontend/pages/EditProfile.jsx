import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EditProfile.css";
import API_URL from "../config";

function EditProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [bio, setBio] = useState("");
  const [preview, setPreview] = useState(null);
  const [profileImageFilename, setProfileImageFilename] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUsername(data.username || "");
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setBirthdate(data.birthdate || "");
        setBio(data.bio || "");
        if (data.profileImage) {
          // 👈 แก้ตรงนี้
          setPreview(data.profileImage);
        }
      } catch (err) {
        console.log(err);
      }
    };
    fetchUser();
  }, []);

  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setProfileImageFilename(data.filename);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          name,
          phone,
          birthdate,
          bio,
          ...(profileImageFilename && { profileImage: profileImageFilename }),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      alert("บันทึกสำเร็จ");
      navigate("/profile");
    } catch (err) {
      alert("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-header">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <p className="edit-profile-title">แก้ไขโปรไฟล์</p>
        <button className="save-btn" onClick={handleSave} disabled={loading}>
          {loading ? "..." : "บันทึก"}
        </button>
      </div>

      <div className="edit-profile-content">
        {/* Avatar */}
        <div className="avatar-section">
          <div className="avatar-wrap">
            {preview ? (
              <img src={preview} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar-placeholder">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#bbb">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            )}
            <label className="avatar-edit-btn">
              📷
              <input type="file" accept="image/*" onChange={handleImage} hidden />
            </label>
          </div>
          <p className="change-photo-text">เปลี่ยนรูปโปรไฟล์</p>
        </div>

        {/* Form */}
        <div className="edit-form">
          <div className="form-group">
            <label>ชื่อ</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>USERNAME</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="form-group">
            <label>EMAIL</label>
            <input type="email" value={email} disabled className="disabled-input" />
          </div>

          <div className="form-group">
            <label>เบอร์โทร</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label>วันเกิด</label>
            <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          </div>

          <div className="form-group">
            <label>BIO</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="เขียนเกี่ยวกับตัวเอง..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditProfile;