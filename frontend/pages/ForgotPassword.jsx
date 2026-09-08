import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import { useAlert } from "../hooks/useAlert";
import "../styles/ForgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(600);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (step !== 2 || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

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
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digits = value.replace(/\D/g, "");

    // วาง OTP 6 หลักทีเดียวได้
    if (digits.length > 1) {
      const pasted = digits.slice(0, 6).split("");
      const nextOtp = ["", "", "", "", "", ""];
      pasted.forEach((digit, i) => { nextOtp[i] = digit; });
      setOtp(nextOtp);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = digits;
    setOtp(nextOtp);

    if (digits && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
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
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      await showAlert({
        type: 'success',
        title: 'รีเซ็ตรหัสผ่านสำเร็จ!',
        message: 'คุณได้เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว',
      });
      navigate("/login");
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (loading || timer > 0) return;

    setOtp(["", "", "", "", "", ""]);
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/forgot/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "ไม่สามารถส่ง OTP ได้");
        return;
      }

      setTimer(600);
      otpRefs.current[0]?.focus();
    } catch {
      setError("ไม่สามารถเชื่อมต่อ server ได้");
    } finally {
      setLoading(false);
    }
  };

  return (

    <div className="forgot-page">


      <img src="/logo.png" alt="Until We Meet" className="forgot-logo" />

      <div className="forgot-step-label">ขั้นตอนที่ {step} จาก 3</div>

      <div className="forgot-steps">
        <div className={`step-item ${step >= 1 ? "active" : ""}`}>
          <span className="step-number">{step > 1 ? "✓" : "1"}</span>
          <span>กรอกอีเมล</span>
        </div>
        <div className={`step-line ${step >= 2 ? "active" : ""}`} />
        <div className={`step-item ${step >= 2 ? "active" : ""}`}>
          <span className="step-number">{step > 2 ? "✓" : "2"}</span>
          <span>ยืนยันตัวตน</span>
        </div>
        <div className={`step-line ${step >= 3 ? "active" : ""}`} />
        <div className={`step-item ${step >= 3 ? "active" : ""}`}>
          <span className="step-number">3</span>
          <span>ตั้งรหัสใหม่</span>
        </div>
      </div>



      {/* Step 1 — กรอกอีเมล */}
      {step === 1 && (
        <div className="forgot-content">
          <p className="forgot-sub">ลืมรหัสผ่าน</p>
          <h1 className="forgot-title">กรอกอีเมลของคุณ</h1>
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
              {loading ? "กำลังส่ง..." : "ส่ง OTP"}
            </button>
          </div>
          <p className="back-login-text">
            จำรหัสผ่านได้แล้ว?{" "}
            <span
              className="back-login-link"
              onClick={() => navigate("/login")}
            >
              เข้าสู่ระบบ
            </span>
          </p>
        </div>

      )}

      {/* Step 2 — กรอก OTP */}
      {step === 2 && (
        <div className="forgot-content">
          <p className="forgot-sub">ยืนยัน OTP</p>
          <h1 className="forgot-title">กรอกรหัส OTP</h1>
          <p className="forgot-desc">ส่ง OTP ไปที่ {email} แล้ว</p>

          <div className="forgot-card">
            <div className="otp-boxes">
              {otp.map((val, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={6}
                  ref={(el) => { otpRefs.current[i] = el; }}
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
              {loading ? "กำลังยืนยัน..." : "ยืนยัน OTP"}
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
          <h1 className="forgot-title">ตั้งรหัสผ่านใหม่</h1>
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
              {loading ? "กำลังรีเซ็ต..." : "รีเซ็ตรหัสผ่าน"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ForgotPassword;