import "./Register.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const Register = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setError("");
    navigate("/login");
  };

  return (
    <div className="register-page">
      {/* Logo */}
      <div className="register-logo">
        <img src="/logo.png" alt="Until We Meet" />
      </div>

      <div className="register-container">
        <div className="register-card">
          <h2>สร้างบัญชี</h2>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input type="text" placeholder="ชื่อผู้ใช้" required />
            </div>

            <div className="input-group">
              <input type="text" placeholder="ชื่อ - นามสกุล" required />
            </div>

            <div className="input-group">
              <input type="date" required />
            </div>

            <div className="input-group">
              <input type="email" placeholder="อีเมล" required />
            </div>

            <div className="input-group">
              <input type="tel" placeholder="เบอร์โทรศัพท์" />
            </div>

            {/* Password */}
            <div className="input-group password-group">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="รหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span
                className="eye-icon"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            {/* Confirm Password */}
            <div className="input-group password-group">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="ยืนยันรหัสผ่าน"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <span
                className="eye-icon"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-primary">
              สมัครสมาชิก
            </button>
          </form>

          <p className="login-text">
            มีบัญชีผู้ใช้แล้ว?{" "}
            <span onClick={() => navigate("/login")}>
              เข้าสู่ระบบ
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
