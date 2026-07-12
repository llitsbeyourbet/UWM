import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import "./ScanQR.css";

function ScanQR() {
  const navigate = useNavigate();
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 200 } },
      async (decodedText) => {
        try {
          const url = new URL(decodedText);
          const pathname = url.pathname;

          if (!pathname.startsWith("/checkin/")) {
            alert("QR นี้ไม่ใช่ QR สำหรับเช็คอิน");
            return;
          }

          const paths = pathname.split("/").filter(Boolean);
          if (paths.length < 2) {
            alert("QR ไม่ถูกต้อง");
            return;
          }

          const activityId = paths[1];
          if (!activityId) {
            alert("QR ไม่ถูกต้อง");
            return;
          }

          await scanner.stop();
          navigate(`/checkin/${activityId}`);
        } catch (err) {
          console.error("QR scan error:", err);
          alert("QR ไม่ถูกต้อง");
        }
      },
      () => {}
    ).catch((err) => console.error("Scanner error:", err));

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return (
    <div className="scanner-page">

      {/* Header */}
      <div className="scanner-header">
        <div className="scanner-back-btn" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </div>
        <div className="scanner-header-text">
          <p className="scanner-sub">Check-in</p>
          <p className="scanner-title">Scan QR Code</p>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Camera Box */}
      <div className="scanner-camera-wrap">
        <div id="qr-reader" className="scanner-camera" />
        <div className="scanner-overlay">
          <div className="scanner-top-fade" />
          <div className="scanner-bottom-fade" />
          <div className="scanner-frame-wrap">
            <div className="scanner-frame">
              <div className="corner tl" />
              <div className="corner tr" />
              <div className="corner bl" />
              <div className="corner br" />
              <div className="scan-line" id="scanLine" />
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="scanner-info">
        <div className="scanner-steps-card">
          <p className="scanner-steps-title">How to Check in</p>
          <div className="scanner-steps">
            <div className="scanner-step">
              <div className="step-num" style={{ background: "#FFF176" }}>1</div>
              <p className="step-text">ขอ QR Code จากผู้จัดกิจกรรม</p>
            </div>
            <div className="scanner-step">
              <div className="step-num" style={{ background: "#B8E0FF" }}>2</div>
              <p className="step-text">นำ QR Code เข้ากรอบด้านบน</p>
            </div>
            <div className="scanner-step">
              <div className="step-num" style={{ background: "#C8F5C8" }}>3</div>
              <p className="step-text">กดยืนยันเพื่อ Check in</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default ScanQR;