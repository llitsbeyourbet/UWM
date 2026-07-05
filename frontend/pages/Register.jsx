import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import "./Register.css";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
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

  const handleNext = async () => {
    if (!name || !username || !email || !password || !confirmPassword) {
      setError("กรุณากรอกข้อมูลให้ครบ"); return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน"); return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return;
    }

    setError("");
    setLoading(true);
    try {
      // ส่ง OTP ไปที่อีเมล
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
      document.getElementById(`reg-otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (newOtp[index]) {
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        newOtp[index - 1] = "";
        setOtp(newOtp);
        document.getElementById(`reg-otp-${index - 1}`).focus();
      }
    }
  };

  const handleVerifyAndRegister = async () => {
    const otpValue = otp.join("");
    if (otpValue.length < 6) { setError("กรุณากรอก OTP ให้ครบ"); return; }
    setError("");
    setLoading(true);
    try {
      // ยืนยัน OTP ก่อน
      const verifyRes = await fetch(`${API_URL}/api/forgot/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.message);
        setOtp(["", "", "", "", "", ""]); // 👈 เคลียร์ OTP ถ้าผิด
        document.getElementById("reg-otp-0")?.focus();
        return;
      }

      // สมัครสมาชิก
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password, phone, birthdate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }

      alert("สมัครสมาชิกสำเร็จ!");
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
    startTimer();
    try {
      await fetch(`${API_URL}/api/forgot/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setError("ไม่สามารถส่ง OTP ได้");
    }
  };

  return (
    <div className="register-page">

      {step === 1 ? (
        <div className="register-content">
          <p className="register-sub">สร้างบัญชี</p>
          <h1 className="register-title">ยินดีต้อนรับสู่<br/>Until We Meet 👋</h1>
          <p className="register-desc">กรอกข้อมูลเพื่อสร้างบัญชีใหม่</p>

          <div className="register-card">
            <div className="reg-input-wrap">
              <p className="reg-input-label">ชื่อ-นามสกุล</p>
              <input className="reg-input" type="text" placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">Username</p>
              <input className="reg-input" type="text" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">อีเมล</p>
              <input className="reg-input" type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">เบอร์โทรศัพท์</p>
              <input className="reg-input" type="tel" placeholder="089-123-4567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">วันเกิด</p>
              <input className="reg-input" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">รหัสผ่าน</p>
              <input className="reg-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="reg-input-wrap">
              <p className="reg-input-label">ยืนยันรหัสผ่าน</p>
              <input className="reg-input" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>

            {error && <p className="reg-error">{error}</p>}

            <button className="reg-btn" onClick={handleNext} disabled={loading}>
              {loading ? "กำลังส่ง OTP..." : "ถัดไป →"}
            </button>

            <p className="reg-login-text">
              มีบัญชีแล้ว?{" "}
              <span onClick={() => navigate("/login")}>เข้าสู่ระบบ</span>
            </p>
          </div>
        </div>
      ) : (
        <div className="register-content">
          <div className="reg-back-btn" onClick={() => setStep(1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </div>

          <p className="register-sub">ยืนยันอีเมล</p>
          <h1 className="register-title">ตรวจสอบ email<br/>ของคุณ 📧</h1>
          <p className="register-desc">ส่งรหัส OTP ไปที่ {email} แล้ว</p>

          <div className="register-card">
            <div className="otp-boxes">
              {otp.map((val, i) => (
                <input
                  key={i}
                  id={`reg-otp-${i}`}
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

            {error && <p className="reg-error">{error}</p>}

            <button className="reg-btn" onClick={handleVerifyAndRegister} disabled={loading}>
              {loading ? "กำลังยืนยัน..." : "ยืนยัน OTP →"}
            </button>

            <p className="resend-text">
              ไม่ได้รับรหัส?{" "}
              <span className="resend-link" onClick={handleResend}>ส่งอีกครั้ง</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;