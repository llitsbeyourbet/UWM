import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import "./ScanQR.css";

function ScanQR() {
  const scannerRef = useRef(null);
  const [activityId, setActivityId] = useState(null);
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState("");
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

              const url = new URL(decodedText);

              const parts = url.pathname.split("/");
                if (parts.length < 4) {
                  alert("QR ไม่ถูกต้อง");
                  return;
                }

              const activityId = parts[2];
              const qrToken = parts[3];

              setActivityId(activityId);

              const token = localStorage.getItem("token");

              try {

                const res = await fetch(
                  `https://uwm-production.up.railway.app/api/join/${activityId}/checkin`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      qrToken,
                    }),
                  }
                );

                const data = await res.json();

                setMessage(data.message);

                if (res.ok) {
                  setShowSuccess(true);
                } else {
                  alert(data.message);
                }

              } catch (err) {
                console.log(err);
                alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
              }
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
      {showSuccess && (
        <div className="modal-overlay">
          <div className="success-modal">
            <h2>✅ เช็คอินสำเร็จ</h2>

            <p>{message}</p>

            <button
              onClick={() => {
                setShowSuccess(false);
                navigate(`/activities?id=${activityId}`);
              }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScanQR;