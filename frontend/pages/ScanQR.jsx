import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import "./ScanQR.css";

function ScanQR() {
  const scannerRef = useRef(null);
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
            console.log("QR :", decodedText);

            if (
              scannerRef.current &&
              isStartedRef.current
            ) {
              await scannerRef.current.stop();
              isStartedRef.current = false;
              scannerRef.current = null;
            }

            if (decodedText.includes("/checkin/")) {
              navigate(
                decodedText.replace(
                  window.location.origin,
                  ""
                )
              );
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
      if (
        scannerRef.current &&
        isStartedRef.current
      ) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            isStartedRef.current = false;
            isMountedRef.current = false;
          });
      }
    };
  }, [navigate]);

  const handleBack = async () => {
    try {
      if (
        scannerRef.current &&
        isStartedRef.current
      ) {
        await scannerRef.current.stop();
        isStartedRef.current = false;
        scannerRef.current = null;
      }
    } catch {}

    navigate(-1);
  };

  return (
    <div className="scan-page">
      <div className="scan-container">
        <button className="scan-back-btn"
          onClick={handleBack}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18L9 12L15 6" />
          </svg>
        </button>

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
    </div>
  );
}

export default ScanQR;