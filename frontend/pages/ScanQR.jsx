import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import "./ScanQR.css";

function ScanQR() {
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const navigate = useNavigate();
  const isStartedRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    let scanner;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: 220,
          },
          async (decodedText) => {
            if (scannedRef.current) return;
            scannedRef.current = true;

            if (scannerRef.current && isStartedRef.current) {
              try {
                await scannerRef.current.stop();
              } catch {}

              try {
                await scannerRef.current.clear();
              } catch {}

              isStartedRef.current = false;
              scannerRef.current = null;
            }

            try {
              const url = new URL(decodedText);

              if (!url.pathname.startsWith("/checkin/")) {
                alert("QR นี้ไม่ใช่ QR สำหรับเช็คอิน");
                return;
              }

              const parts = url.pathname.split("/");

              if (parts.length !== 4) {
                alert("QR ไม่ถูกต้อง");
                return;
              }

              const activityId = parts[2];
              const qrToken = parts[3];

              if (!activityId || !qrToken) {
                alert("QR ไม่ถูกต้อง");
                return;
              }

              navigate(`/checkin/${activityId}/${qrToken}`);
            } catch (err) {
              console.log(err);
              alert("QR ไม่ถูกต้อง");
            }
          }
        );

        isStartedRef.current = true;
      } catch (err) {
        console.log(err);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && isStartedRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            isStartedRef.current = false;
            isMountedRef.current = false;
            scannedRef.current = false;
          });
      } else {
        isMountedRef.current = false;
        scannedRef.current = false;
      }
    };
  }, [navigate]);

  const handleBack = async () => {
    if (scannerRef.current && isStartedRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}

      try {
        await scannerRef.current.clear();
      } catch {}

      scannerRef.current = null;
      isStartedRef.current = false;
    }

    scannedRef.current = false;
    navigate(-1);
  };

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

      {/* Camera */}
      <div className="scanner-camera-wrap">

        <div
          id="reader"
          className="scanner-camera"
        ></div>

        <div className="scanner-overlay">

          <div className="scanner-frame">

            <div className="corner tl"></div>
            <div className="corner tr"></div>
            <div className="corner bl"></div>
            <div className="corner br"></div>

            <div className="scan-line"></div>

          </div>

        </div>

      </div>

      {/* Instruction */}
      <div className="scanner-card">

        <h3>How to Check in</h3>

        <div className="step">
          <div className="step-circle yellow">1</div>
          <p>ขอ QR Code จากผู้จัดกิจกรรม</p>
        </div>

        <div className="step">
          <div className="step-circle blue">2</div>
          <p>นำ QR Code เข้ากรอบด้านบน</p>
        </div>

        <div className="step">
          <div className="step-circle green">3</div>
          <p>กดยืนยันเพื่อ Check in</p>
        </div>

      </div>

    </div>
  );
}

export default ScanQR;