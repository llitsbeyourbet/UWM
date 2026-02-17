import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    navigate("/");
  };

  return (
    <div className="login-page">
      {/* LEFT */}
      <div className="login-left">
        <img src="/logo.png" alt="Logo" className="logo" />

        <h1>เจอเพื่อน เจอกิจกรรม</h1>
        <p>Until We Meet ช่วยให้คุณค้นหาและเข้าร่วมกิจกรรมได้ง่ายขึ้น</p>

        <img src="/bg.png" alt="bg" className="bg-img" />
      </div>

      {/* RIGHT */}
      <div className="login-right">
        <div className="login-card">
          {/* TAB */}
          <div className="tab">
            <button className="active">เข้าสู่ระบบ</button>
            <button onClick={() => navigate("/register")}>
              สร้างบัญชี
            </button>
          </div>

          <form onSubmit={handleLogin}>
            {/* EMAIL */}
            <label>อีเมล หรือ เบอร์โทรศัพท์</label>
            <div className="input-icon">
              <span className="material-icons">mail</span>
              <input
                type="text"
                placeholder="อีเมล หรือ เบอร์โทรศัพท์"
                required
              />
            </div>

            {/* PASSWORD */}
            <label>รหัสผ่าน</label>
            <div className="input-icon password">
              <span className="material-icons">lock</span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่าน"
                required
              />
              <span
                className="material-icons toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </div>

            <div className="forgot">ลืมรหัสผ่าน?</div>

            <button className="login-btn" type="submit">
              เข้าสู่ระบบ
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
  );
}
