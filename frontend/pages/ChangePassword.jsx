import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./ChangePassword.css";
import API_URL from "../config";

async function safeFetch(url, options) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type");

  if (!response.ok || !contentType || !contentType.includes("application/json")) {
    throw new Error("ไม่สามารถเชื่อมต่อระบบได้ หรือเซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง");
  }

  return response.json();
}

function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("email"); // 'email' -> 'otp' -> 'password'
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const data = await safeFetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUserEmail(data.email);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchUser();
  }, [navigate]);

  const maskEmail = (email) => {
    if (!email) return "";
    const [local, domain] = email.split("@");
    if (local.length <= 3) return `***@${domain}`;
    return `${local.slice(0, 3)}****@${domain}`;
  };

  const requestOTP = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const data = await safeFetch(`${API_URL}/api/auth/change-password/otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage(data.message);
      setStep("otp");
    } catch (err) {
      setError(err.message === "ไม่สามารถเชื่อมต่อระบบได้ หรือเซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง"
        ? "ไม่สามารถเชื่อมต่อระบบส่ง OTP ได้"
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError("กรุณากรอก OTP ให้ครบ 6 หลัก");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      // Reuse logic from Forgot Password verify-otp
      const data = await safeFetch(`${API_URL}/api/forgot/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp }),
      });

      setMessage("ยืนยันตัวตนสำเร็จ กรุณาตั้งรหัสผ่านใหม่");
      setStep("password");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPassword = async () => {
    if (newPassword.length < 6) {
      setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const data = await safeFetch(`${API_URL}/api/auth/change-password/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ otp, newPassword, confirmPassword }),
      });

      localStorage.removeItem("token");
      navigate("/login", { state: { message: data.message } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="cp-container">
        <div className="cp-header">
          <div className="cp-icon">🔐</div>
          <h2>เปลี่ยนรหัสผ่าน</h2>
          <p>
            {step === "email" && "ยืนยันอีเมลเพื่อขอรหัส OTP"}
            {step === "otp" && "ยืนยันตัวตนด้วยรหัส OTP"}
            {step === "password" && "ตั้งรหัสผ่านใหม่ของคุณ"}
          </p>
        </div>

        {message && <div className="cp-alert info">{message}</div>}
        {error && <div className="cp-alert error">{error}</div>}

        <div className="cp-form">
          {step === "email" ? (
            <div className="cp-step">
              <div className="email-display-box">
                <p className="email-label">ระบบจะส่งรหัส OTP ไปที่</p>
                <p className="email-value">{maskEmail(userEmail)}</p>
              </div>
              <button className="cp-btn" onClick={requestOTP} disabled={loading}>
                {loading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
              </button>
            </div>
          ) : step === "otp" ? (
            <div className="cp-step">
              <div className="otp-input-group">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength="1"
                    className="otp-digit"
                    value={otp[i] || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const newOtp = otp.split("");
                        newOtp[i] = val;
                        setOtp(newOtp.join(""));
                      } else {
                        const newOtp = otp.split("");
                        newOtp[i] = "";
                        setOtp(newOtp.join(""));
                      }
                    }}
                  />
                ))}
              </div>
              <button className="cp-btn" onClick={handleVerifyOTP} disabled={loading || otp.length !== 6}>
                {loading ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
              </button>
              <button className="cp-btn secondary" onClick={requestOTP} disabled={loading}>
                ส่งรหัส OTP อีกครั้ง
              </button>
            </div>
          ) : (
            <div className="cp-step">
              <div className="input-group">
                <label>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>
              <div className="input-group">
                <label>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                />
              </div>
              <button className="cp-btn" onClick={handleSubmitPassword} disabled={loading}>
                {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
              </button>
              <button className="cp-btn secondary" onClick={() => setStep("otp")}>
                ย้อนกลับไปกรอก OTP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChangePassword;
