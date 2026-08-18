import API_URL from "../config";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = (value) => /^0\d{9}$/.test(value);
  const isUsername = (value) => value.length >= 3;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!isEmail(identifier) && !isPhone(identifier) && !isUsername(identifier)) {
      setError("กรุณากรอกอีเมล, username หรือเบอร์โทรศัพท์ให้ถูกต้อง");
      return;
    }

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "เกิดข้อผิดพลาด");
        return;
      }

      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      if (data.user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">

        {/* LEFT SIDE */}
        <div className="login-left">
          <img src="/logo.png" alt="Until We Meet" className="logo" />

          <div className="login-hero">
            <h1>
              Meet Friends,
              <br />
              <span>Meet Activities</span>
            </h1>

            <p>
              Until We Meet ช่วยให้คุณค้นหาและเข้าร่วมกิจกรรมได้ง่ายขึ้น
              <br />
              เชื่อมต่อกับเพื่อนใหม่ และสร้างความทรงจำดี ๆ ไปด้วยกัน
            </p>
          </div>

          <div className="activity-decoration">
            <div className="mini-card sport">
              <span>🏐</span>
              <div>
                <b>วอลเลย์บอล</b>
                <small>กิจกรรมกีฬา</small>
              </div>
            </div>

            <div className="mini-card photo">
              <span>📷</span>
              <div>
                <b>ถ่ายรูป</b>
                <small>งานอดิเรก</small>
              </div>
            </div>

            <div className="mini-card art">
              <span>🎨</span>
              <div>
                <b>ศิลปะ</b>
                <small>กิจกรรมสร้างสรรค์</small>
              </div>
            </div>

            <div className="mini-card music">
              <span>🎵</span>
              <div>
                <b>ดนตรี</b>
                <small>กิจกรรมดนตรี</small>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="login-right">
          <div className="login-form-box">

            {/* MOBILE LOGO */}
            <img
              src="/logo.png"
              alt="Until We Meet"
              className="mobile-logo"
            />

            <div className="login-title">
              <h2>เข้าสู่ระบบ</h2>
              <p>ยินดีต้อนรับกลับมา!</p>
            </div>

            {location.state?.message && (
              <div className="login-success-alert">
                {location.state.message}
              </div>
            )}

            <div className="tab">
              <button className="active">
                เข้าสู่ระบบ
              </button>

              <button onClick={() => navigate("/register")}>
                สร้างบัญชี
              </button>
            </div>

            <form onSubmit={handleLogin}>
              <label>อีเมล, Username หรือเบอร์โทรศัพท์</label>

              <div className="input-icon">
                <span className="material-icons">mail</span>

                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  placeholder="อีเมล, Username หรือเบอร์โทรศัพท์"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError("");
                  }}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  required
                />
              </div>

              <label>รหัสผ่าน</label>

              <div className="input-icon password">
                <span className="material-icons">lock</span>

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={loading}
                  required
                />

                <span
                  className="material-icons toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </div>

              <div className="forgot">
                <p
                  className="forgot-link"
                  onClick={() => navigate("/forgot-password")}
                >
                  ลืมรหัสผ่าน?
                </p>
              </div>

              {error && <p className="error-text">{error}</p>}

              <button
                className="login-btn"
                type="submit"
                disabled={loading}
              >
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </form>

            <p className="register-text">
              ยังไม่มีบัญชีผู้ใช้?{" "}
              <span onClick={() => navigate("/register")}>
                สร้างบัญชีผู้ใช้
              </span>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}