import API_URL from "../config";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EditProfile.css";

function EditProfile() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [bio, setBio] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

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
          setPreview(data.profileImage);
        }
      } catch (err) {
        console.log(err);
      }
    };

    fetchUser();
  }, []);

  const handleImageChange = async (e) => {
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
      setProfileImage(data.filename);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

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
          profileImage,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      // อัปเดต localStorage
      const user = JSON.parse(localStorage.getItem("user"));
      localStorage.setItem("user", JSON.stringify({
        ...user,
        username,
        name,
        phone,
        birthdate,
        bio,
        profileImage: profileImage || user.profileImage,
      }));

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
      <div className="edit-header">
        <div className="back-btn" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <p className="edit-title">แก้ไขโปรไฟล์</p>
      </div>

      <div className="edit-content">

        <div className="avatar-section">
          <label className="avatar-wrapper" htmlFor="avatarInput">
            {preview ? (
              <img src={preview} alt="avatar" className="avatar-img" />
            ) : (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="#bbb">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            )}
            <div className="avatar-overlay">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </label>
          <input id="avatarInput" type="file" accept="image/*" onChange={handleImageChange} hidden />
          <p className="change-photo-text">เปลี่ยนรูปโปรไฟล์</p>
        </div>

        <div className="edit-form">
          <div className="form-group">
            <label>ชื่อผู้ใช้</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="form-group">
            <label>ชื่อ - นามสกุล</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="form-group">
            <label>อีเมล</label>
            <input type="email" value={email} disabled className="disabled-input" />
          </div>

          <div className="form-group">
            <label>เบอร์โทรศัพท์</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="form-group">
            <label>วันเกิด</label>
            <input type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
          </div>

          <div className="form-group">
            <label>แนะนำตัว</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
        </div>

        <button className="save-btn" onClick={handleSave} disabled={loading}>
          {loading ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}

export default EditProfile;