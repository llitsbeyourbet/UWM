import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ChangePassword.css";
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
  const otpInputsRef = useRef([]);

  const [step, setStep] = useState("email");
  const [userEmail, setUserEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      const token = sessionStorage.getItem("token");

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

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setInterval(() => {
      setResendSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendSeconds]);

  const maskEmail = (email) => {
    if (!email) return "";

    const [local, domain] = email.split("@");

    if (!domain) return email;
    if (local.length <= 3) return `***@${domain}`;

    return `${local.slice(0, 3)}****@${domain}`;
  };

  const getStepNumber = () => {
    if (step === "email") return 1;
    if (step === "otp") return 2;
    return 3;
  };

  const requestOTP = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const token = sessionStorage.getItem("token");

      const data = await safeFetch(`${API_URL}/api/auth/change-password/otp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage(data.message || "ส่งรหัส OTP แล้ว");
      setOtp("");
      setStep("otp");
      setResendSeconds(60);

      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(
        err.message === "ไม่สามารถเชื่อมต่อระบบได้ หรือเซิร์ฟเวอร์ส่งข้อมูลกลับมาไม่ถูกต้อง"
          ? "ไม่สามารถเชื่อมต่อระบบส่ง OTP ได้"
          : err.message
      );
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
    setMessage("");

    try {
      const token = sessionStorage.getItem("token");

      const data = await safeFetch(`${API_URL}/api/auth/change-password/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp }),
      });

      if (data.verified) {
        setStep("password");
      }
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
    setMessage("");

    try {
      const token = sessionStorage.getItem("token");

      const data = await safeFetch(`${API_URL}/api/auth/change-password/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp, newPassword, confirmPassword }),
      });

      setMessage(data.message || "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      setStep("success");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = Array.from({ length: 6 }, (_, i) => otp[i] || "");

    digits[index] = digit;
    setOtp(digits.join(""));
    setError("");

    if (digit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    event.preventDefault();
    setOtp(pasted);
    setError("");

    setTimeout(() => {
      otpInputsRef.current[Math.min(pasted.length - 1, 5)]?.focus();
    }, 0);
  };

  const currentStep = getStepNumber();

  return (
    <div className="change-password-page">
      <header className="cp-topbar">
        <button
          type="button"
          className="cp-back-btn"
          onClick={() => navigate(-1)}
          aria-label="ย้อนกลับ"
        >
          <span className="material-icons">chevron_left</span>
        </button>

        <h1>เปลี่ยนรหัสผ่าน</h1>
      </header>

      <main className="cp-container">
        <div className="cp-logo">
          <img src="/logo.png" alt="Until We Meet" />
        </div>
        <div className="cp-stepper">
          {[
            { number: 1, label: "ตรวจสอบอีเมล" },
            { number: 2, label: "ยืนยันตัวตน" },
            { number: 3, label: "เปลี่ยนรหัสผ่าน" },
          ].map((item, index, items) => {
            const completed = step === "success" || currentStep > item.number;
            const active = step !== "success" && currentStep === item.number;

            return (
              <div className="cp-stepper-part" key={item.number}>
                <div
                  className={`cp-stepper-item ${active ? "active" : ""} ${completed ? "completed" : ""
                    }`}
                >
                  <span className="cp-step-circle">
                    {completed ? (
                      <span className="material-icons">check</span>
                    ) : (
                      item.number
                    )}
                  </span>

                  <span className="cp-step-label">{item.label}</span>
                </div>

                {index < items.length - 1 && (
                  <span
                    className={`cp-step-line ${currentStep > item.number || step === "success"
                        ? "completed"
                        : ""
                      }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="cp-alert error">
            <span className="material-icons">error_outline</span>
            <span>{error}</span>
          </div>
        )}

        {message && step !== "success" && (
          <div className="cp-alert info">
            <span className="material-icons">info_outline</span>
            <span>{message}</span>
          </div>
        )}

        {step === "email" && (
          <section className="cp-screen">
            <div className="cp-illustration email">
              <span className="material-icons">mark_email_unread</span>
            </div>

            <div className="cp-heading">
              <h2>ตรวจสอบอีเมลของคุณ</h2>
              <p>
                เราจะส่งรหัส OTP ไปที่อีเมลของคุณ
                <br />
                เพื่อดำเนินการเปลี่ยนรหัสผ่าน
              </p>
            </div>

            <div className="cp-email-box">
              <span className="material-icons">mail_outline</span>
              <strong>{maskEmail(userEmail)}</strong>
            </div>

            <button
              type="button"
              className="cp-primary-btn"
              onClick={requestOTP}
              disabled={loading || !userEmail}
            >
              {loading ? "กำลังส่ง..." : "ส่งรหัส OTP"}
            </button>
          </section>
        )}

        {step === "otp" && (
          <section className="cp-screen">
            <div className="cp-heading">
              <h2>ยืนยันตัวตนด้วยรหัส OTP</h2>
              <p>
                เราได้ส่งรหัส OTP ไปที่
                <br />
                <strong>{maskEmail(userEmail)}</strong>
              </p>
            </div>

            <div className="otp-input-group" onPaste={handleOtpPaste}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  ref={(element) => (otpInputsRef.current[index] = element)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  className="otp-digit"
                  value={otp[index] || ""}
                  onChange={(event) =>
                    handleOtpChange(index, event.target.value)
                  }
                  onKeyDown={(event) => handleOtpKeyDown(event, index)}
                />
              ))}
            </div>

            <div className="cp-resend-row">
              <span>ไม่ได้รับอีเมล?</span>

              <button
                type="button"
                onClick={requestOTP}
                disabled={loading || resendSeconds > 0}
              >
                {resendSeconds > 0
                  ? `ส่งอีกครั้ง (${resendSeconds} วินาที)`
                  : "ส่งรหัส OTP อีกครั้ง"}
              </button>
            </div>

            <button
              type="button"
              className="cp-primary-btn"
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
            </button>
          </section>
        )}

        {step === "password" && (
          <section className="cp-screen">

            <div className="cp-heading">
              <h2>ตั้งรหัสผ่านใหม่</h2>
              <p>กรอกรหัสผ่านใหม่ที่คุณต้องการใช้สำหรับบัญชีนี้</p>
            </div>

            <div className="cp-password-fields">
              <label className="cp-password-field">
                <span>รหัสผ่านใหม่</span>

                <div className="password-wrap">
                  <span className="material-icons cp-input-icon">
                    lock_outline
                  </span>

                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                  />

                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    <span className="material-icons">
                      {showPassword ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              </label>

              <label className="cp-password-field">
                <span>ยืนยันรหัสผ่านใหม่</span>

                <div className="password-wrap">
                  <span className="material-icons cp-input-icon">
                    lock_outline
                  </span>

                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setError("");
                    }}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                  />

                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() =>
                      setShowConfirmPassword((prev) => !prev)
                    }
                    aria-label={
                      showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
                    }
                  >
                    <span className="material-icons">
                      {showConfirmPassword ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              </label>
            </div>

            <button
              type="button"
              className="cp-primary-btn"
              onClick={handleSubmitPassword}
              disabled={loading}
            >
              {loading ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </section>
        )}

        {step === "success" && (
          <section className="cp-screen cp-success-screen">
            <div className="cp-success-icon">
              <span className="material-icons">check</span>
            </div>

            <div className="cp-heading">
              <h2>เปลี่ยนรหัสผ่านเรียบร้อยแล้ว</h2>
              <p>คุณสามารถใช้งานบัญชีต่อได้ด้วยรหัสผ่านใหม่</p>
            </div>

            <button
              type="button"
              className="cp-primary-btn"
              onClick={() =>
                navigate("/profile", { state: { message } })
              }
            >
              ไปยังหน้าบัญชีของฉัน
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default ChangePassword;
