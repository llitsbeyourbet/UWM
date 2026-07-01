import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

function ScanQR() {
  const scannerRef = useRef(null);

  useEffect(() => {
    // ถ้าสร้างแล้ว ไม่สร้างซ้ำ
    if (scannerRef.current) return;

    const scanner = new Html5Qrcode("reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "user" },
        {
          fps: 10,
          qrbox: 250,
        },
        (decodedText) => {
          console.log("QR:", decodedText);
        }
      )
      .catch((err) => {
        console.log(err);
      });

    return () => {};
  }, []);

  return (
    <div className="scan-page">
      <h2>สแกน QR Code</h2>
      <div id="reader"></div>
    </div>
  );
}

export default ScanQR;