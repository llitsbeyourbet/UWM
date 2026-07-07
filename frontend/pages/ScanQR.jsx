import { useEffect, useRef, useState } from "react";
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

            console.log("QR :", decodedText);

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
    <div className="scan-page">
      <button className="scan-back-btn" onClick={handleBack}>‹</button>
      

      <div className="scan-header">
        <h1 className="scan-title">สแกน QR</h1>
        <p className="scan-subtitle">
          นำ QR Code มาไว้ในกรอบเพื่อเช็คอินกิจกรรม
        </p>
      </div>

      <div className="reader-wrapper">
        <div id="reader"></div>
          <div className="scan-box">
            <div className="corner tl"></div>
            <div className="corner tr"></div>
            <div className="corner bl"></div>
            <div className="corner br"></div>
            <div className="scan-line"></div>
        </div>
      </div>

      <p className="scan-tip">
        วาง QR Code ให้อยู่ในกรอบสี่เหลี่ยม
        <br />
        ระบบจะสแกนให้อัตโนมัติ
      </p>
    </div>
  );
}

export default ScanQR;