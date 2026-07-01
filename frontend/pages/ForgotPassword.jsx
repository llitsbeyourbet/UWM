import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import "./ForgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(600);

  const startTimer = () => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleSendOTP = async () => {
    if (!email) { setError("กรุณากรอกอีเมล"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forgot/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setStep(2);
      setTimer(600);
      startTimer();
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  // 👈 เพิ่มฟังก์ชันยืนยัน OTP
  const handleVerifyOTP = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) { setError("กรุณากรอก OTP ให้ครบ"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forgot/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setStep(3); // 👈 ไป step 3
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) { setError("กรุณากรอกรหัสผ่านใหม่"); return; }
    if (newPassword !== confirmPassword) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forgot/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.join(""), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      alert("รีเซ็ตรหัสผ่านสำเร็จ!");
      navigate("/login");
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp(["", "", "", "", "", ""]);
    setTimer(600);
    await handleSendOTP();
  };

  return (
    <div className="forgot-page">

      <div className="forgot-back" onClick={() => step === 1 ? navigate("/login") : setStep(step - 1)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </div>

      {/* Step 1 — กรอกอีเมล */}
      {step === 1 && (
        <div className="forgot-content">
          <p className="forgot-sub">ลืมรหัสผ่าน</p>
          <h1 className="forgot-title">กรอกอีเมล<br/>ของคุณ</h1>
          <p className="forgot-desc">เราจะส่งรหัส OTP ไปที่อีเมลของคุณ</p>

          <div className="forgot-card">
            <div className="forgot-input-wrap">
              <p className="forgot-input-label">อีเมล</p>
              <input
                type="email"
                className="forgot-input"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="forgot-error">{error}</p>}
            <button className="forgot-btn" onClick={handleSendOTP} disabled={loading}>
              {loading ? "กำลังส่ง..." : "ส่ง OTP →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — กรอก OTP */}
      {step === 2 && (
        <div className="forgot-content">
          <p className="forgot-sub">ยืนยัน OTP</p>
          <h1 className="forgot-title">กรอกรหัส<br/>OTP</h1>
          <p className="forgot-desc">ส่งไปที่ {email} แล้ว</p>

          <div className="forgot-card">
            <div className="otp-boxes">
              {otp.map((val, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  maxLength={1}
                  className={`otp-box ${val ? "filled" : ""}`}
                  value={val}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                />
              ))}
            </div>

            <p className="otp-timer">
              รหัสหมดอายุใน{" "}
              <span style={{ color: timer < 60 ? "#FF6B6B" : "#4A6FFF", fontWeight: 600 }}>
                {formatTime(timer)}
              </span>
            </p>

            {error && <p className="forgot-error">{error}</p>}

            <button className="forgot-btn" onClick={handleVerifyOTP} disabled={loading}>
              {loading ? "กำลังยืนยัน..." : "ยืนยัน OTP →"}
            </button>

            <p className="resend-text">
              ไม่ได้รับรหัส?{" "}
              <span className="resend-link" onClick={handleResend}>ส่งอีกครั้ง</span>
            </p>
          </div>
        </div>
      )}

      {/* Step 3 — ตั้งรหัสผ่านใหม่ */}
      {step === 3 && (
        <div className="forgot-content">
          <p className="forgot-sub">รีเซ็ตรหัสผ่าน</p>
          <h1 className="forgot-title">ตั้งรหัสผ่าน<br/>ใหม่</h1>
          <p className="forgot-desc">กรอกรหัสผ่านใหม่ของคุณ</p>

          <div className="forgot-card">
            <div className="forgot-input-wrap">
              <p className="forgot-input-label">รหัสผ่านใหม่</p>
              <input
                type="password"
                className="forgot-input"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="forgot-input-wrap">
              <p className="forgot-input-label">ยืนยันรหัสผ่านใหม่</p>
              <input
                type="password"
                className="forgot-input"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p className="forgot-error">{error}</p>}

            <button className="forgot-btn" onClick={handleResetPassword} disabled={loading}>
              {loading ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน →"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ForgotPassword;