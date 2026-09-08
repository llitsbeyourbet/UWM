import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import API_URL from "../config";
import { useAlert } from "../hooks/useAlert";
import "../styles/ScanQR.css";

function ScanQR() {
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const isStartedRef = useRef(false);
  const isMountedRef = useRef(false);

  const [showHelp, setShowHelp] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [cameraError, setCameraError] = useState("");

  /* ===============================
     LOAD CHECK-IN HISTORY
  =============================== */

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const token = sessionStorage.getItem("token");

        if (!token) {
          setHistory([]);
          return;
        }

        const res = await fetch(
          `${API_URL}/api/join/checkin-history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          console.log(data);
          return;
        }

        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.log("load history error:", err);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, []);

  /* ===============================
     START QR CAMERA
  =============================== */

  useEffect(() => {
    if (isMountedRef.current) return;

    isMountedRef.current = true;

    let scanner;

    const startScanner = async () => {
      try {
        setCameraError("");

        scanner = new Html5Qrcode("reader");

        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 230,
              height: 230,
            },
          },

          /* ===== SCAN SUCCESS ===== */

          async (decodedText) => {
            if (scannedRef.current) return;

            scannedRef.current = true;

            if (
              scannerRef.current &&
              isStartedRef.current
            ) {
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

              if (
                !url.pathname.startsWith("/checkin/")
              ) {
                showAlert({
                  type: 'warning',
                  title: 'QR ไม่ถูกต้อง',
                  message: 'QR นี้ไม่ใช่ QR สำหรับเช็คอิน',
                });

                scannedRef.current = false;
                window.location.reload();

                return;
              }

              const parts =
                url.pathname.split("/");

              if (parts.length !== 4) {
                showAlert({
                  type: 'error',
                  title: 'QR ไม่ถูกต้อง',
                  message: 'ข้อมูลใน QR Code ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
                });

                scannedRef.current = false;
                window.location.reload();

                return;
              }

              const activityId = parts[2];
              const qrToken = parts[3];

              if (!activityId || !qrToken) {
                showAlert({
                  type: 'error',
                  title: 'QR ไม่ถูกต้อง',
                  message: 'ข้อมูลใน QR Code ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง',
                });

                scannedRef.current = false;
                window.location.reload();

                return;
              }

              navigate(
                `/checkin/${activityId}/${qrToken}`
              );
            } catch (err) {
              console.log(err);

              showAlert({
                type: 'error',
                title: 'QR ไม่ถูกต้อง',
                message: 'เกิดข้อผิดพลาดในการอ่าน QR Code กรุณาลองใหม่อีกครั้ง',
              });

              scannedRef.current = false;
              window.location.reload();
            }
          }
        );

        isStartedRef.current = true;
      } catch (err) {
        console.log("Camera error:", err);

        setCameraError(
          "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องแล้วลองอีกครั้ง"
        );
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
          .then(() =>
            scannerRef.current?.clear()
          )
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

  /* ===============================
     BACK
  =============================== */

  const handleBack = async () => {
    if (
      scannerRef.current &&
      isStartedRef.current
    ) {
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

  /* ===============================
     TORCH
  =============================== */

  const toggleTorch = async () => {
    try {
      const scanner =
        scannerRef.current;

      if (!scanner) return;

      const newValue = !torchOn;

      await scanner.applyVideoConstraints({
        advanced: [
          {
            torch: newValue,
          },
        ],
      });

      setTorchOn(newValue);
    } catch (err) {
      console.log("Torch not supported:", err);

      showAlert({
        type: 'info',
        title: 'ไม่รองรับไฟฉาย',
        message: 'อุปกรณ์นี้ไม่รองรับการเปิดไฟฉายผ่านเว็บไซต์',
      });
    }
  };

  /* ===============================
     FORMAT DATE
  =============================== */

  const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString(
      "th-TH",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString(
      "th-TH",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  return (
    <div className="scan-page">

      {/* ================= HEADER ================= */}

      <header className="scan-header">

        <button
          type="button"
          className="scan-header-btn"
          onClick={handleBack}
          aria-label="กลับ"
        >
          <span className="material-icons">
            arrow_back_ios_new
          </span>
        </button>

        <div className="scan-header-center">
          <h1>สแกนคิวอาร์โค้ด</h1>

          <p>
            สแกน QR Code เพื่อเช็คอินเข้าร่วมกิจกรรม
          </p>
        </div>

        <button
          type="button"
          className={`scan-header-btn help ${
            showHelp ? "active" : ""
          }`}
          onClick={() =>
            setShowHelp((prev) => !prev)
          }
          aria-label="วิธีใช้งาน"
        >
          <span className="material-icons">
            help_outline
          </span>
        </button>

      </header>

      {/* ================= HELP ================= */}

      {showHelp && (
        <div className="scan-help-card">

          <div className="scan-help-icon">
            <span className="material-icons">
              help_outline
            </span>
          </div>

          <div className="scan-help-content">
            <strong>วิธีการใช้งาน</strong>

            <ul>
              <li>
                สแกน QR Code
                จากหน้าจอผู้จัดกิจกรรม
              </li>

              <li>
                วาง QR Code
                ให้อยู่ภายในกรอบ
              </li>

              <li>
                ระบบจะนำไปยังหน้ายืนยัน
                การเข้าร่วมกิจกรรม
              </li>
            </ul>
          </div>

          <button
            type="button"
            className="scan-help-close"
            onClick={() =>
              setShowHelp(false)
            }
          >
            <span className="material-icons">
              close
            </span>
          </button>

        </div>
      )}

      {/* ================= CAMERA ================= */}

      <section className="scan-camera-card">

        <button
          type="button"
          className={`scan-torch-btn ${
            torchOn ? "active" : ""
          }`}
          onClick={toggleTorch}
        >
          <span className="material-icons">
            {torchOn
              ? "flashlight_on"
              : "flashlight_off"}
          </span>

          {torchOn
            ? "ปิดไฟฉาย"
            : "เปิดไฟฉาย"}
        </button>

        <div className="scan-camera-area">

          <div
            id="reader"
            className="scan-camera"
          />

          <div className="scan-overlay">

            <div className="scan-target">

              <span className="scan-corner top-left" />
              <span className="scan-corner top-right" />
              <span className="scan-corner bottom-left" />
              <span className="scan-corner bottom-right" />

              <div className="scan-center-icon">
                <span className="material-icons">
                  qr_code_scanner
                </span>
              </div>

              <div className="scan-laser" />

            </div>

          </div>

        </div>

        {cameraError ? (
          <div className="camera-error">
            <span className="material-icons">
              videocam_off
            </span>

            <p>{cameraError}</p>
          </div>
        ) : (
          <div className="scan-camera-text">
            <strong>
              สแกน QR Code ให้อยู่ในกรอบ
            </strong>

            <span>
              เพื่อเช็คอินเข้าร่วมกิจกรรม
            </span>
          </div>
        )}

      </section>

      {/* ================= HISTORY ================= */}

      <section className="scan-history-card">

        <div className="scan-section-title">

          <div>
            <span className="material-icons">
              history
            </span>

            <h2>
              ประวัติการเช็คอินล่าสุดของคุณ
            </h2>
          </div>

          {history.length > 3 && (
            <button
              type="button"
              onClick={() =>
                navigate("/activity-summary")
              }
            >
              ดูทั้งหมด
              <span className="material-icons">
                chevron_right
              </span>
            </button>
          )}

        </div>

        {historyLoading ? (
          <div className="scan-history-empty">
            กำลังโหลด...
          </div>
        ) : history.length === 0 ? (
          <div className="scan-history-empty">

            <span className="material-icons">
              history
            </span>

            <p>
              ยังไม่มีประวัติการเช็คอิน
            </p>

          </div>
        ) : (
          <div className="scan-history-list">

            {history
              .slice(0, 3)
              .map((item) => (

                <button
                  type="button"
                  className="scan-history-item"
                  key={item.id}
                  onClick={() =>
                    navigate(
                      `/activity-detail?id=${item.activityId}`
                    )
                  }
                >

                  <div className="scan-history-image">

                    {item.cover ? (
                      <img
                        src={item.cover}
                        alt={item.activityName}
                      />
                    ) : (
                      <div className="history-placeholder">
                        <span className="material-icons">
                          event
                        </span>
                      </div>
                    )}

                  </div>

                  <div className="scan-history-info">

                    <strong>
                      {item.activityName}
                    </strong>

                    <p>
                      {formatDate(
                        item.checkedAt
                      )}

                      {item.checkedAt && (
                        <>
                          {" "}•{" "}
                          {formatTime(
                            item.checkedAt
                          )}
                        </>
                      )}
                    </p>

                  </div>

                  <div className="scan-history-status">
                    <span>
                      <span className="material-icons">
                        check
                      </span>

                      เช็คอินแล้ว
                    </span>
                  </div>

                  <span className="material-icons scan-history-arrow">
                    chevron_right
                  </span>

                </button>
              ))}

          </div>
        )}

      </section>

      {/* ================= TIP ================= */}

      <section className="scan-tip-card">

        <div className="scan-tip-icon">
          <span className="material-icons">
            lightbulb
          </span>
        </div>

        <div>
          <h3>เคล็ดลับ</h3>

          <ul>
            <li>
              วาง QR Code ให้อยู่ในกรอบ
            </li>

            <li>
              ให้แสงเพียงพอและไม่สะท้อน
            </li>

            <li>
              หากสแกนไม่ได้
              ลองขยับระยะห่างหรือมุมกล้อง
            </li>
          </ul>
        </div>

      </section>

    </div>
  );
}

export default ScanQR;