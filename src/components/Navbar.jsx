import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef();
  const navigate = useNavigate();

  // 🔹 mock user (ตอนนี้ยังไม่มีระบบ auth จริง)
  const user = JSON.parse(localStorage.getItem("user")) || {
    name: "Guest",
    profileImage: null,
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔥 Logout Function
  const handleLogout = () => {
    localStorage.removeItem("user"); // ลบ user ออกจาก storage
    setOpen(false);                  // ปิด dropdown
    navigate("/login");              // ไปหน้า login
  };

  return (
    <nav className="navbar">
      {/* LEFT */}
      <div className="nav-left">
        <Link to="/" className="logo">
          <img src="/logo.png" alt="Logo" className="logo-image" />
        </Link>

        <div className="menu">
          <Link to="/">หน้าหลัก</Link>
          <Link to="/activities">กิจกรรม</Link>
          <Link to="/create">สร้างกิจกรรม</Link>
        </div>
      </div>

      {/* CENTER */}
      <div className="nav-center">
        <input type="text" placeholder="ค้นหากิจกรรม..." />
      </div>

      {/* RIGHT */}
      <div className="nav-right">
        <div className="notification">
          🔔
          <span className="badge">3</span>
        </div>

        <div
          className="profile"
          ref={dropdownRef}
          onClick={() => setOpen(!open)}
        >
          {/* ถ้ามีรูปใช้รูป ถ้าไม่มีใช้ตัวอักษร */}
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt="profile"
              className="nav-avatar"
            />
          ) : (
            <div className="avatar-placeholder">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}

          {open && (
            <div className="dropdown">
              <Link to="/profile">โปรไฟล์</Link>
              <Link to="/my-activities">กิจกรรมของฉัน</Link>
              <Link to="/activity">กิจกรรมที่เข้าร่วม</Link>
              <Link to="/settings">ตั้งค่า</Link>

              <button className="logout" onClick={handleLogout}>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
