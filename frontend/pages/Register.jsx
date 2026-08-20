import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../config";
import "../styles/Register.css";

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
    const cleanName = name.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.replace(/\D/g, "");

    if (
      !cleanName ||
      !cleanUsername ||
      !cleanEmail ||
      !cleanPhone ||
      !password ||
      !confirmPassword
    ) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    // username ขั้นต่ำ 3 ตัว
    if (/[\u0E00-\u0E7F]/.test(username)) {
      setError("ชื่อบัญชีผู้ใช้ไม่สามารถใช้ภาษาไทยได้ กรุณาใช้ภาษาอังกฤษหรือตัวเลข");
      return;
    }
    
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setError(
        "ชื่อผู้ใช้ต้องมี 3-20 ตัว และใช้ได้เฉพาะตัวอักษร ตัวเลข หรือ _"
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("กรุณากรอกอีเมลให้ถูกต้อง");
      return;
    }

    if (!/^0\d{9}$/.test(cleanPhone)) {
      setError("กรุณากรอกเบอร์โทรศัพท์ 10 หลัก");
      return;
    }

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // ตรวจชื่อผู้ใช้ อีเมล และเบอร์โทรก่อนส่ง OTP
      const checkRes = await fetch(
        `${API_URL}/api/auth/check-register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: cleanUsername,
            email: cleanEmail,
            phone: cleanPhone,
          }),
        }
      );

      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.message || "ข้อมูลนี้ถูกใช้งานแล้ว");
        return;
      }

      // ผ่านแล้วค่อยส่ง OTP
      const res = await fetch(
        `${API_URL}/api/forgot/send-otp-register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "ไม่สามารถส่ง OTP ได้");
        return;
      }

      setName(cleanName);
      setUsername(cleanUsername);
      setEmail(cleanEmail);
      setPhone(cleanPhone);

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
      await fetch(`${API_URL}/api/forgot/send-otp-register`, {
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
      <div className="register-container">

        {/* ================= LEFT SIDE ================= */}
        <section className="register-left">
          <img
            src="/logo.png"
            alt="Until We Meet"
            className="register-main-logo"
          />

          <div className="register-hero">
            <h1>
              Meet Friends,
              <br />
              <span>Meet Activities</span>
            </h1>

            <p>
              สร้างบัญชีเพื่อค้นหากิจกรรมที่น่าสนใจ
              <br />
              เชื่อมต่อกับเพื่อนใหม่ และสร้างความทรงจำดี ๆ
              <br />
              ไปด้วยกัน
            </p>
          </div>

          {/* ให้เหมือนฝั่งซ้ายหน้า Login */}
          <div className="register-decoration">

            <div className="register-mini-card register-sport">
              <span>🏐</span>
              <div>
                <b>วอลเลย์บอล</b>
                <small>กิจกรรมกีฬา</small>
              </div>
            </div>

            <div className="register-mini-card register-photo">
              <span>📷</span>
              <div>
                <b>ถ่ายรูป</b>
                <small>งานอดิเรก</small>
              </div>
            </div>

            <div className="register-mini-card register-art">
              <span>🎨</span>
              <div>
                <b>ศิลปะ</b>
                <small>กิจกรรมสร้างสรรค์</small>
              </div>
            </div>

            <div className="register-mini-card register-music">
              <span>🎵</span>
              <div>
                <b>ดนตรี</b>
                <small>กิจกรรมดนตรี</small>
              </div>
            </div>

          </div>
        </section>

        {/* ================= RIGHT SIDE ================= */}
        <section className="register-right">

          <div className="register-form-box">

            {/* โลโก้แสดงเฉพาะมือถือ */}
            <img
              src="/logo.png"
              alt="Until We Meet"
              className="register-mobile-logo"
            />

            {step === 1 ? (
              <>
                {/* ================= STEP 1 ================= */}

                <div className="register-heading">
                  <h2>สร้างบัญชีใหม่</h2>
                  <p>กรอกข้อมูลของคุณเพื่อเริ่มต้นใช้งาน Until We Meet</p>
                </div>

                <div className="register-steps">
                  <div className="register-step active">
                    <span>1</span>
                    <p>ข้อมูลส่วนตัว</p>
                  </div>

                  <div className="step-line"></div>

                  <div className="register-step">
                    <span>2</span>
                    <p>ยืนยันตัวตน</p>
                  </div>
                </div>

                <div className="register-form-grid">

                  {/* ชื่อ */}
                  <div className="register-field full">
                    <label>ชื่อ - นามสกุล</label>

                    <div className="register-input-box">
                      <span className="material-icons">person</span>

                      <input
                        type="text"
                        placeholder="เช่น นภัสสร ใจดี"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="register-field">
                    <label>ชื่อผู้ใช้ (Username)</label>

                    <div className="register-input-box">
                      <span className="material-icons">person_outline</span>

                      <input
                        type="text"
                        placeholder="เช่น happyday_"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="register-field">
                    <label>อีเมล</label>

                    <div className="register-input-box">
                      <span className="material-icons">mail_outline</span>

                      <input
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="register-field">
                    <label>เบอร์โทรศัพท์</label>

                    <div className="register-input-box">
                      <span className="material-icons">phone</span>

                      <input
                        type="tel"
                        placeholder="เช่น 081-234-5678"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Birthdate */}
                  <div className="register-field">
                    <label>วันเกิด</label>

                    <div className="register-input-box">
                      <span className="material-icons">calendar_today</span>

                      <input
                        type="date"
                        value={birthdate}
                        onChange={(e) => {
                          setBirthdate(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="register-field">
                    <label>รหัสผ่าน</label>

                    <div className="register-input-box">
                      <span className="material-icons">lock_outline</span>

                      <input
                        type="password"
                        placeholder="อย่างน้อย 6 ตัวอักษร"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div className="register-field">
                    <label>ยืนยันรหัสผ่าน</label>

                    <div className="register-input-box">
                      <span className="material-icons">lock_outline</span>

                      <input
                        type="password"
                        placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError("");
                        }}
                      />
                    </div>
                  </div>

                </div>

                {error && (
                  <p className="reg-error">
                    {error}
                  </p>
                )}

                <button
                  className="reg-btn"
                  onClick={handleNext}
                  disabled={loading}
                >
                  {loading ? "กำลังส่ง OTP..." : "ถัดไป →"}
                </button>

                <p className="reg-login-text">
                  มีบัญชีอยู่แล้ว?{" "}
                  <span onClick={() => navigate("/login")}>
                    เข้าสู่ระบบ
                  </span>
                </p>
              </>
            ) : (
              <>
                {/* ================= STEP 2 OTP ================= */}

                <div className="register-heading otp-heading">
                  <h2>ยืนยันอีเมลของคุณ</h2>

                  <p>
                    เราได้ส่งรหัส OTP 6 หลักไปยังอีเมลของคุณ
                  </p>
                </div>

                <div className="register-steps">
                  <div className="register-step completed">
                    <span>✓</span>
                    <p>ข้อมูลส่วนตัว</p>
                  </div>

                  <div className="step-line active"></div>

                  <div className="register-step active">
                    <span>2</span>
                    <p>ยืนยันตัวตน</p>
                  </div>
                </div>

                <div className="otp-section">

                  <div className="otp-mail-icon">
                    <span className="material-icons">
                      mark_email_read
                    </span>
                  </div>

                  <p className="otp-message">
                    กรอกรหัสยืนยันที่ส่งไปยัง
                  </p>

                  <p className="otp-email">
                    {email}
                  </p>

                  {/* OTP เดิม */}
                  <div className="otp-boxes">
                    {otp.map((val, i) => (
                      <input
                        key={i}
                        id={`reg-otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        className={`otp-box ${val ? "filled" : ""}`}
                        value={val}
                        onChange={(e) =>
                          handleOtpChange(i, e.target.value)
                        }
                        onKeyDown={(e) =>
                          handleOtpKeyDown(i, e)
                        }
                      />
                    ))}
                  </div>

                  <p className="otp-timer">
                    รหัสหมดอายุใน{" "}
                    <span
                      className={timer < 60 ? "timer-warning" : ""}
                    >
                      {formatTime(timer)}
                    </span>
                  </p>

                  {error && (
                    <p className="reg-error">
                      {error}
                    </p>
                  )}

                  <button
                    className="reg-btn"
                    onClick={handleVerifyAndRegister}
                    disabled={loading}
                  >
                    {loading
                      ? "กำลังยืนยัน..."
                      : "ยืนยัน OTP →"}
                  </button>

                  <p className="resend-text">
                    ไม่ได้รับรหัส?{" "}
                    <span
                      className={`resend-link ${timer > 0 ? "disabled" : ""
                        }`}
                      onClick={() => {
                        if (timer === 0) handleResend();
                      }}
                    >
                      ส่งอีกครั้ง
                    </span>
                  </p>

                  <button
                    type="button"
                    className="register-back"
                    onClick={() => {
                      setStep(1);
                      setError("");
                      setOtp(["", "", "", "", "", ""]);
                    }}
                  >
                    ← กลับไปแก้ไขข้อมูล
                  </button>

                </div>
              </>
            )}

          </div>
        </section>
      </div>
    </div>
  );
}

export default Register;